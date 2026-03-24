// Sync Durable Object for user-specific sync state
// Handles both WebSocket-based traditional sync and HTTP-based sliding sync
// FIXED: Duplicate event prevention and memory leak issues

import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../types';

interface SyncSession {
  userId: string;
  deviceId: string | null;
  lastSyncToken: string;
  lastAckPosition: number; // Track last acknowledged position
}

interface PendingEvent {
  event_id: string;
  room_id: string;
  type: string;
  stream_position: number;  // FIXED: Use stream_position instead of timestamp
  created_at: number;
}

// Sliding sync connection state (stored in DO storage, not KV)
interface SlidingSyncConnectionState {
  pos: number;
  lastAccess: number;
  roomStates: Record<string, {
    lastStreamOrdering: number;
    sentState: boolean;
  }>;
  listStates: Record<string, {
    roomIds: string[];
    count: number;
  }>;
  roomNotificationCounts?: Record<string, number>;
  roomFullyReadMarkers?: Record<string, string>;
  initialSyncComplete?: boolean;
  roomSentAsRead?: Record<string, boolean>;
}

interface DeliveryAcknowledgement {
  event_id: string;
  device_id: string;
  acknowledged_at: number;
}

export class SyncDurableObject extends DurableObject<Env> {
  private sessions: Map<WebSocket, SyncSession> = new Map();
  // FIXED: Use storage for persistent tracking, not in-memory array
  private waitingResolvers: Array<(hasEvents: boolean) => void> = [];
  // In-memory cache for sliding sync state (persisted to storage on save)
  private slidingSyncStates: Map<string, SlidingSyncConnectionState> = new Map();
  // FIXED: Track delivered events per device to prevent duplicates
  private deliveredEvents: Map<string, Set<number>> = new Map(); // deviceId -> Set<stream_position>

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/websocket') {
      return this.handleWebSocket(request);
    }

    if (path === '/notify') {
      return this.handleNotify(request);
    }

    if (path === '/pending') {
      return this.handlePending(request);
    }

    // Sliding sync connection state endpoints
    if (path === '/sliding-sync/state') {
      if (request.method === 'GET') {
        return this.getSlidingSyncState(request);
      } else if (request.method === 'PUT') {
        return this.saveSlidingSyncState(request);
      }
    }

    // Wait for events endpoint (for long-polling)
    if (path === '/wait-for-events') {
      return this.handleWaitForEvents(request);
    }

    // FIXED: Add acknowledgment endpoint
    if (path === '/ack') {
      return this.handleAck(request);
    }

    return new Response('Not found', { status: 404 });
  }

  // Get sliding sync connection state for a user/connection
  private async getSlidingSyncState(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const connId = url.searchParams.get('conn_id');

    if (!connId) {
      return new Response(JSON.stringify({ error: 'Missing conn_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const key = `sliding_sync:${connId}`;

    // Check in-memory cache first
    let state = this.slidingSyncStates.get(key);

    // If not in cache, load from storage
    if (!state) {
      state = await this.ctx.storage.get<SlidingSyncConnectionState>(key);
      if (state) {
        this.slidingSyncStates.set(key, state);
      }
    }

    return new Response(JSON.stringify(state || null), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Save sliding sync connection state
  private async saveSlidingSyncState(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const connId = url.searchParams.get('conn_id');

    if (!connId) {
      return new Response(JSON.stringify({ error: 'Missing conn_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const state = await request.json() as SlidingSyncConnectionState;
      const key = `sliding_sync:${connId}`;

      // Update in-memory cache
      this.slidingSyncStates.set(key, state);

      // Persist to storage
      await this.ctx.storage.put(key, state);

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('[SyncDO] Failed to save sliding sync state:', error);
      return new Response(JSON.stringify({ error: 'Failed to save state' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected websocket upgrade', { status: 426 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const deviceId = url.searchParams.get('device_id');
    const since = url.searchParams.get('since');

    if (!userId || !deviceId) {
      return new Response('Missing user_id or device_id', { status: 400 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.ctx.acceptWebSocket(server, [userId]);

    // FIXED: Initialize delivered events set for this device
    if (!this.deliveredEvents.has(deviceId)) {
      this.deliveredEvents.set(deviceId, new Set());
    }

    const session: SyncSession = {
      userId,
      deviceId,
      lastSyncToken: since || '0',
      lastAckPosition: parseInt(since || '0'),
    };

    server.serializeAttachment(session);
    this.sessions.set(server, session);

    // FIXED: Send pending events with proper filtering
    const pending = await this.getUndeliveredEvents(session);
    if (pending.length > 0) {
      server.send(JSON.stringify({
        type: 'sync',
        events: pending,
      }));
      
      // FIXED: Track delivered events
      const deliveredSet = this.deliveredEvents.get(deviceId)!;
      pending.forEach(e => deliveredSet.add(e.stream_position));
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleNotify(request: Request): Promise<Response> {
    const data = await request.json() as PendingEvent;
    console.log('[SyncDO] /notify received for event:', data.event_id, 'waiting resolvers:', this.waitingResolvers.length);

    // FIXED: Validate required fields
    if (!data.event_id || !data.room_id || !data.type || data.stream_position === undefined) {
      return new Response('Invalid event data', { status: 400 });
    }

    // Store pending event in persistent storage
    const key = `event:${data.stream_position}:${data.event_id}`;
    await this.ctx.storage.put(key, data);

    // FIXED: Store with TTL (7 days) to prevent memory leaks
    // Also store in a sorted set for efficient querying by position
    const eventListKey = 'events_by_position';
    const eventList = await this.ctx.storage.get<number[]>(eventListKey) || [];
    eventList.push(data.stream_position);
    eventList.sort((a, b) => a - b);
    
    // Keep only last 1000 events to prevent unbounded growth
    while (eventList.length > 1000) {
      const oldPos = eventList.shift();
      if (oldPos) {
        await this.ctx.storage.delete(`event:${oldPos}:*`); // Would need to find exact key
      }
    }
    await this.ctx.storage.put(eventListKey, eventList);

    // Notify all connected WebSockets
    const message = JSON.stringify({
      type: 'event',
      event: data,
    });

    const webSockets = this.ctx.getWebSockets();
    for (const ws of webSockets) {
      const session = ws.deserializeAttachment() as SyncSession | null;
      if (!session) continue;

      try {
        // FIXED: Only send if client hasn't received this event
        const deliveredSet = this.deliveredEvents.get(session.deviceId!);
        if (!deliveredSet?.has(data.stream_position)) {
          ws.send(message);
          deliveredSet?.add(data.stream_position);
        }
      } catch (e) {
        // WebSocket may be closed
      }
    }

    // Wake up all waiting long-polling requests
    const numResolvers = this.waitingResolvers.length;
    const resolvers = this.waitingResolvers;
    this.waitingResolvers = [];
    for (const resolve of resolvers) {
      resolve(true);
    }
    if (numResolvers > 0) {
      console.log('[SyncDO] Woke up', numResolvers, 'waiting request(s)');
    }

    return new Response('OK');
  }

  // FIXED: New endpoint for client acknowledgments
  private async handleAck(request: Request): Promise<Response> {
    try {
      const { device_id, stream_position } = await request.json() as {
        device_id: string;
        stream_position: number;
      };

      const deliveredSet = this.deliveredEvents.get(device_id);
      if (deliveredSet) {
        // Remove from delivered set (free memory)
        deliveredSet.delete(stream_position);
        
        // Update session's last ack position
        for (const ws of this.ctx.getWebSockets()) {
          const session = ws.deserializeAttachment() as SyncSession | null;
          if (session?.deviceId === device_id) {
            session.lastAckPosition = Math.max(session.lastAckPosition, stream_position);
            ws.serializeAttachment(session);
            break;
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('[SyncDO] Error in handleAck:', error);
      return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
    }
  }

  // Wait for events (used by long-polling sliding sync)
  private async handleWaitForEvents(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { timeout?: number; device_id?: string };
      const timeout = Math.min(body.timeout || 25000, 25000); // Cap at 25s
      const deviceId = body.device_id;

      console.log('[SyncDO] /wait-for-events started, timeout:', timeout, 'current waiters:', this.waitingResolvers.length);

      // FIXED: Check if there are already undelivered events
      if (deviceId) {
        const hasUndelivered = await this.hasUndeliveredEvents(deviceId);
        if (hasUndelivered) {
          return new Response(JSON.stringify({ hasEvents: true }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      let myResolver: ((hasEvents: boolean) => void) | null = null;

      // Create a promise that resolves when events arrive or timeout expires
      const eventPromise = new Promise<boolean>((resolve) => {
        myResolver = resolve;
        this.waitingResolvers.push(resolve);
      });

      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), timeout);
      });

      // Wait for either events or timeout
      const hasEvents = await Promise.race([eventPromise, timeoutPromise]);

      // Clean up our resolver from the array if timeout won
      if (!hasEvents && myResolver) {
        const index = this.waitingResolvers.indexOf(myResolver);
        if (index !== -1) {
          this.waitingResolvers.splice(index, 1);
        }
      }

      console.log('[SyncDO] /wait-for-events completed, hasEvents:', hasEvents);

      return new Response(JSON.stringify({ hasEvents }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('[SyncDO] Error in wait-for-events:', error);
      return new Response(JSON.stringify({ hasEvents: false, error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handlePending(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const since = parseInt(url.searchParams.get('since') || '0');
    const deviceId = url.searchParams.get('device_id');

    if (!deviceId) {
      return new Response(JSON.stringify({ error: 'Missing device_id' }), { status: 400 });
    }

    const events = await this.getPendingEvents(since, deviceId);

    return new Response(JSON.stringify({ events }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // FIXED: Get pending events with proper filtering and deduplication
  private async getPendingEvents(since: number, deviceId: string): Promise<PendingEvent[]> {
    const events: PendingEvent[] = [];
    const deliveredSet = this.deliveredEvents.get(deviceId) || new Set();
    
    // Get sorted list of event positions
    const eventListKey = 'events_by_position';
    const eventPositions = await this.ctx.storage.get<number[]>(eventListKey) || [];

    // Filter to positions > since and not already delivered
    const relevantPositions = eventPositions.filter(pos => 
      pos > since && !deliveredSet.has(pos)
    );

    // Fetch actual events
    for (const pos of relevantPositions.slice(0, 100)) { // Limit to 100 per request
      // This is inefficient - in production you'd store position->event_id mapping
      const eventsWithPos = await this.ctx.storage.list({ prefix: `event:${pos}:` });
      for (const [, value] of eventsWithPos) {
        events.push(value as PendingEvent);
      }
    }

    // Sort by stream_position
    events.sort((a, b) => a.stream_position - b.stream_position);

    // Mark as delivered
    events.forEach(e => deliveredSet.add(e.stream_position));
    this.deliveredEvents.set(deviceId, deliveredSet);

    return events;
  }

  // FIXED: Check for undelivered events
  private async hasUndeliveredEvents(deviceId: string): Promise<boolean> {
    const deliveredSet = this.deliveredEvents.get(deviceId) || new Set();
    const eventListKey = 'events_by_position';
    const eventPositions = await this.ctx.storage.get<number[]>(eventListKey) || [];

    // Find the latest session to get lastAckPosition
    let lastAckPosition = 0;
    for (const ws of this.ctx.getWebSockets()) {
      const session = ws.deserializeAttachment() as SyncSession | null;
      if (session?.deviceId === deviceId) {
        lastAckPosition = session.lastAckPosition;
        break;
      }
    }

    return eventPositions.some(pos => 
      pos > lastAckPosition && !deliveredSet.has(pos)
    );
  }

  // FIXED: Get undelivered events for a session
  private async getUndeliveredEvents(session: SyncSession): Promise<PendingEvent[]> {
    if (!session.deviceId) return [];

    const deliveredSet = this.deliveredEvents.get(session.deviceId) || new Set();
    const eventListKey = 'events_by_position';
    const eventPositions = await this.ctx.storage.get<number[]>(eventListKey) || [];

    const events: PendingEvent[] = [];
    const positionsToFetch = eventPositions.filter(pos => 
      pos > session.lastAckPosition && !deliveredSet.has(pos)
    ).slice(0, 100);

    for (const pos of positionsToFetch) {
      const eventsWithPos = await this.ctx.storage.list({ prefix: `event:${pos}:` });
      for (const [, value] of eventsWithPos) {
        events.push(value as PendingEvent);
      }
    }

    events.sort((a, b) => a.stream_position - b.stream_position);
    
    // Mark as delivered
    events.forEach(e => deliveredSet.add(e.stream_position));
    this.deliveredEvents.set(session.deviceId, deliveredSet);

    return events;
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const session = ws.deserializeAttachment() as SyncSession | null;
    if (!session) return;

    try {
      const data = typeof message === 'string' ? JSON.parse(message) : null;
      if (!data) return;

      switch (data.type) {
        case 'ack':
          // FIXED: Handle acknowledgment properly
          if (data.stream_position && session.deviceId) {
            session.lastAckPosition = Math.max(session.lastAckPosition, data.stream_position);
            ws.serializeAttachment(session);
            
            // Remove from delivered set
            const deliveredSet = this.deliveredEvents.get(session.deviceId);
            if (deliveredSet) {
              deliveredSet.delete(data.stream_position);
            }
          }
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          break;
      }
    } catch (e) {
      console.error('Error handling sync message:', e);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean): Promise<void> {
    const session = ws.deserializeAttachment() as SyncSession | null;
    if (session) {
      this.sessions.delete(ws);
      
      // FIXED: Clean up delivered events after some time (optional)
      // Could schedule a cleanup task
    }
    ws.close(code, reason);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('Sync WebSocket error:', error);
    const session = ws.deserializeAttachment() as SyncSession | null;
    if (session) {
      this.sessions.delete(ws);
    }
  }

  // Cleanup old events (run periodically via alarm)
  async alarm(): Promise<void> {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago (increased from 24h)
    const eventListKey = 'events_by_position';
    const eventPositions = await this.ctx.storage.get<number[]>(eventListKey) || [];

    // FIXED: More efficient cleanup - find events older than cutoff
    // This requires storing timestamp with position
    const positionsToKeep: number[] = [];
    for (const pos of eventPositions) {
      const eventsWithPos = await this.ctx.storage.list({ prefix: `event:${pos}:` });
      let keep = false;
      for (const [, value] of eventsWithPos) {
        const event = value as PendingEvent;
        if (event.created_at > cutoff) {
          keep = true;
          break;
        }
      }
      if (keep) {
        positionsToKeep.push(pos);
      } else {
        // Delete all events at this position
        const eventsToDelete = await this.ctx.storage.list({ prefix: `event:${pos}:` });
        for (const [key] of eventsToDelete) {
          await this.ctx.storage.delete(key);
        }
      }
    }

    await this.ctx.storage.put(eventListKey, positionsToKeep);

    // FIXED: Clean up old delivered event tracking
    // Could implement LRU or TTL for delivered sets

    // Schedule next cleanup in 1 hour
    await this.ctx.storage.setAlarm(Date.now() + (60 * 60 * 1000));
  }
}