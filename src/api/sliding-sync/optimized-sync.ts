// src/api/sliding-sync/optimized-sync.ts
import { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { CachedSlidingSyncHandler, createCachedSlidingSyncHandler } from './caching-strategy';
import { D1ConnectionPool, createConnectionPool } from './d1-pool';
import { PrecomputedListManager, createPrecomputedListManager } from './precomputed-lists';
import { SlidingSyncMonitor, createSlidingSyncMonitor } from './performance-monitor';

// ============================================
// Type Definitions
// ============================================

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  // Other bindings as needed
}

interface SlidingSyncRequest {
  lists?: Record<string, ListConfig>;
  extensions?: ExtensionsRequest;
  pos?: string;
  timeout?: number;
  room_subscriptions?: Record<string, RoomSubscription>;
}

interface ListConfig {
  ranges?: [number, number][];
  sort?: string[];
  required_state?: [string, string][];
  timeline_limit?: number;
  filters?: RoomFilter;
  room_subscription?: RoomSubscription;
}

interface RoomFilter {
  is_dm?: boolean;
  spaces?: string[];
  is_encrypted?: boolean;
  is_invite?: boolean;
  room_types?: string[];
  not_room_types?: string[];
  room_name_like?: string;
  tags?: string[];
  not_tags?: string[];
}

interface RoomSubscription {
  required_state?: [string, string][];
  timeline_limit?: number;
}

interface ExtensionsRequest {
  to_device?: { enabled?: boolean; since?: string; limit?: number };
  e2ee?: { enabled?: boolean };
  account_data?: { enabled?: boolean; rooms?: string[] };
  typing?: { enabled?: boolean; rooms?: string[] };
  receipts?: { enabled?: boolean; rooms?: string[] };
  presence?: { enabled?: boolean };
}

interface ListResult {
  count: number;
  ops?: RoomListOperation[];
  rooms?: Record<string, RoomResult>;
}

interface RoomListOperation {
  op: 'SYNC' | 'DELETE' | 'INSERT' | 'INVALIDATE';
  range?: [number, number];
  index?: number;
  room_ids?: string[];
}

interface RoomResult {
  room_id: string;
  name?: string;
  avatar?: string;
  topic?: string;
  canonical_alias?: string;
  heroes?: Array<{ user_id: string; displayname?: string; avatar_url?: string }>;
  required_state?: any[];
  timeline?: any[];
  prev_batch?: string;
  limited?: boolean;
  joined_count?: number;
  invited_count?: number;
  notification_count?: number;
  highlight_count?: number;
  timestamp?: number;
  bump_stamp?: number;
  is_dm?: boolean;
  membership?: string;
  state?: any[];
}

interface ExtensionsResponse {
  to_device?: { next_batch: string; events: any[] };
  e2ee?: { device_lists?: { changed: string[]; left: string[] } };
  account_data?: { rooms?: Record<string, any[]> };
  typing?: { rooms?: Record<string, { user_ids: string[] }> };
  receipts?: { rooms?: Record<string, any> };
  presence?: { events?: any[] };
}

export interface ListConfigWithId extends ListConfig {
  id: string;
}

// ============================================
// Main Optimized Sliding Sync Handler
// ============================================

export class OptimizedSlidingSyncHandler {
  private readonly MAX_CONCURRENT_LISTS = 5;
  private readonly MAX_TIMELINE_LIMIT = 100;
  
  private cache: CachedSlidingSyncHandler;
  private pool: D1ConnectionPool;
  private precomputed: PrecomputedListManager;
  private monitor: SlidingSyncMonitor;
  private db: D1Database;

  constructor(env: Env) {
    this.db = env.DB;
    this.cache = createCachedSlidingSyncHandler(env);
    this.pool = createConnectionPool(env);
    this.precomputed = createPrecomputedListManager(env);
    this.monitor = createSlidingSyncMonitor(env);
  }

  /**
   * Main entry point for sliding sync requests
   */
  async handleSlidingSync(request: Request, userId: string, deviceId: string): Promise<Response> {
    const startTime = Date.now(); //Added
    const nextPos = await getCurrentStreamPosition(this.db);
    const nextBatch = `s${nextPos}`;
    try {
      // Parse request
      const body = await this.parseRequestBody(request);
      const { lists = {}, extensions = {}, pos: _since, room_subscriptions = {} } = body;
      const since = _since ?? null;

      if (!deviceId) {
        console.warn(`No deviceId for user ${userId}, to-device messages will be empty`);
      }
       
      // Validate request
      this.validateRequest(body);
      
      // Process lists in parallel with concurrency control
      const listResults = await this.processListsConcurrently(
        userId,
        lists,
        since,
        this.MAX_CONCURRENT_LISTS
      );
      
      // Process room subscriptions (full room data for specific rooms)
      const subscriptionResults = await this.processRoomSubscriptions(
        userId,
        room_subscriptions,
        since
      );
      
      // Process extensions (to-device, typing, receipts, etc.)
      const extensionResults = await this.processExtensions(userId, deviceId, extensions, since);
      
      // Track performance metrics
      const processingTime = Date.now() - startTime;
      this.monitor.trackSyncDuration(userId, processingTime, Object.keys(lists).length);
      
      // Build response
      const response = this.buildResponse(listResults, extensionResults, nextBatch, subscriptionResults);
      
      return Response.json(response, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
    } catch (error) {
      console.error('Sliding sync failed:', error);
      return this.handleError(error);
    }
  }

  /**
   * Parse request body, handling both JSON and empty requests
   */
  private async parseRequestBody(request: Request): Promise<SlidingSyncRequest> {
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      try {
        const text = await request.text();
        // Handle empty body - this is valid for initial sync
        if (!text || text.trim() === '') {
          return {};
        }
        return JSON.parse(text);
      } catch (error) {
        console.error('Failed to parse JSON body:', error);
        throw new Error('Invalid JSON in request body');
      }
    }
    
    // Empty body is allowed (initial sync)
    return {};
  }

  /**
   * Validate request parameters
   */
  private validateRequest(body: SlidingSyncRequest): void {
    const { lists, timeout } = body;
    
    if (timeout && (timeout < 0 || timeout > 60000)) {
      throw new Error('Timeout must be between 0 and 60000 ms');
    }
    
    if (lists) {
      for (const [listId, config] of Object.entries(lists)) {
        if (!config.ranges && !config.room_subscription) {
          throw new Error(`List ${listId} must have ranges or room_subscription`);
        }
        
        if (config.timeline_limit && config.timeline_limit > this.MAX_TIMELINE_LIMIT) {
          config.timeline_limit = this.MAX_TIMELINE_LIMIT;
        }
      }
    }
  }

  /**
   * Process multiple sync lists concurrently with controlled parallelism
   */
  private async processListsConcurrently(
    userId: string,
    lists: Record<string, ListConfig>,
    since: string | null,
    concurrency: number
  ): Promise<Record<string, ListResult>> {
    const listEntries = Object.entries(lists).map(([id, config]) => ({
      id,
      ...config
    }));
    
    const results: Record<string, ListResult> = {};
    
    // Process in chunks to control concurrency
    for (let i = 0; i < listEntries.length; i += concurrency) {
      const chunk = listEntries.slice(i, i + concurrency);
      
      const chunkPromises = chunk.map(async (listConfig) => {
        try {
          results[listConfig.id] = await this.processList(
            userId,
            listConfig,
            since
          );
        } catch (error) {
          console.error(`Failed to process list ${listConfig.id}:`, error);
          results[listConfig.id] = this.createErrorResult(error);
        }
      });
      
      await Promise.all(chunkPromises);
      
      // Small delay between chunks to prevent D1 throttling
      if (i + concurrency < listEntries.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }   
    return results;
  }

  /**
   * Process a single sync list
   */
  public async processList(  //was private
    userId: string,
    config: ListConfigWithId,
    since: string | null
  ): Promise<ListResult> {
    // Get room IDs for this list (from precomputed lists or filter)
    let roomIds: string[];
    
    if (config.filters) {
      // Complex filter - use precomputed lists if possible
      roomIds = await this.precomputed.filterRoomsByList(userId, config, since);
    } else {
      // Simple list - get from membership
      roomIds = await this.getUserRooms(userId, config.filters);
    }
    
    // Apply sorting
    const sortedRooms = await this.sortRooms(roomIds, config.sort);
    
    // Apply ranges to get subset of rooms
    const rangedRooms = this.applyRanges(sortedRooms, config.ranges || [[0, 99]]);
    
    // Fetch room data (with caching)
    const roomData = await this.cache.getRoomData(userId, rangedRooms, since);
    
    // Build room results
    const rooms: Record<string, RoomResult> = {};
    for (const roomId of rangedRooms) {
      const summary = roomData.get(roomId);
      if (summary) {
        rooms[roomId] = this.buildRoomResult(roomId, summary, config);
      }
    }
    
    // Generate list operations for incremental sync
    const ops = since ? await this.generateListOps(
      userId,
      config,
      sortedRooms,
      roomIds,
      since
    ) : undefined;
    
    return {
      count: roomIds.length,
      ops,
      rooms: Object.keys(rooms).length > 0 ? rooms : undefined
    };
  }

  /**
   * Get user's rooms with optional filtering
   */
  private async getUserRooms(
    userId: string,
    filters?: RoomFilter
  ): Promise<string[]> {
    let query = `
      SELECT room_id
      FROM room_memberships
      WHERE user_id = ?
    `;
    
    const params: any[] = [userId];
    
    if (filters?.is_invite) {
      query += ` AND membership = 'invite'`;
    } else {
      query += ` AND membership = 'join'`;
    }
    
    const results = await this.pool.executeQuery<{ room_id: string }>(
      query,
      params,
      'high' // User room list is high priority
    );
    
    return results.map(r => r.room_id);
  }

  /**
   * Sort rooms according to sort criteria
   */
  private async sortRooms(
    roomIds: string[],
    sort?: string[]
  ): Promise<string[]> {
    if (!sort || sort.length === 0) {
      return roomIds; // Default order
    }
    
    if (sort.includes('by_recency')) {
      // Get last activity timestamps
      const placeholders = roomIds.map(() => '?').join(',');
      const results = await this.pool.executeQuery<{
        room_id: string;
        last_activity: number;
      }>(
        `SELECT 
          room_id,
          COALESCE(
            (SELECT MAX(origin_server_ts) FROM events WHERE room_id = rooms.room_id),
            0
          ) as last_activity
        FROM rooms
        WHERE room_id IN (${placeholders})`,
        roomIds,
        'high'
      );
      
      // Sort by last activity descending
      const activityMap = new Map(results.map(r => [r.room_id, r.last_activity]));
      return [...roomIds].sort((a, b) => 
        (activityMap.get(b) || 0) - (activityMap.get(a) || 0)
      );
    }
    
    if (sort.includes('by_name')) {
      // Get room names from room_state
      const placeholders = roomIds.map(() => '?').join(',');
      const results = await this.pool.executeQuery<{
        room_id: string;
        name: string | null;
      }>(
        `SELECT rs.room_id, e.content as name 
         FROM room_state rs 
         JOIN events e ON rs.event_id = e.event_id 
         WHERE rs.room_id IN (${placeholders}) AND rs.event_type = 'm.room.name' AND rs.state_key = ''`,
        roomIds,
        'high'
      );
      
      // Sort by name
      const nameMap = new Map(results.map(r => [r.room_id, r.name ? JSON.parse(r.name).name : '']));
      return [...roomIds].sort((a, b) => 
        (nameMap.get(a) || '').localeCompare(nameMap.get(b) || '')
      );
    }
    
    return roomIds;
  }

  /**
   * Apply ranges to get a subset of rooms
   */
  private applyRanges(roomIds: string[], ranges: [number, number][]): string[] {
    const result: string[] = [];
    const seen = new Set<string>();
    
    for (const [start, end] of ranges) {
      for (let i = start; i <= end && i < roomIds.length; i++) {
        const roomId = roomIds[i];
        if (!seen.has(roomId)) {
          seen.add(roomId);
          result.push(roomId);
        }
      }
    }
    
    return result;
  }

  /**
   * Build room result from summary and config
   */
  private buildRoomResult(
    roomId: string,
    summary: any,
    config: ListConfig
  ): RoomResult {
    const result: RoomResult = {
      room_id: roomId,
      name: summary.name,
      avatar: summary.avatar,
      topic: summary.topic,
      canonical_alias: summary.canonicalAlias,
      heroes: summary.heroes,
      joined_count: summary.memberCount,
      is_dm: summary.isDM,
      membership: summary.membership,
      bump_stamp: summary.lastEventTimestamp
    };
    
    // Add timeline if requested
    if (config.timeline_limit && config.timeline_limit > 0) {
      // Timeline fetching would go here
      // This is complex and would need its own implementation
    }
    
    // Add required state if requested
    if (config.required_state && config.required_state.length > 0) {
      // State fetching would go here
    }
    
    return result;
  }

  /**
   * Generate list operations for incremental sync
   */
  private async generateListOps(
    _userId: string,
    _config: ListConfigWithId,
    currentRooms: string[],
    previousRooms: string[],
    _since: string
  ): Promise<RoomListOperation[]> {
    const ops: RoomListOperation[] = [];
    
    // Simple implementation: if rooms changed, send SYNC
    // A more sophisticated implementation would compute INSERT/DELETE
    
    if (JSON.stringify(currentRooms) !== JSON.stringify(previousRooms)) {
      ops.push({
        op: 'SYNC',
        range: [0, currentRooms.length - 1],
        room_ids: currentRooms
      });
    }
    
    return ops;
  }

  /**
    * Process room subscriptions - fetch full room data for specific rooms
    */
  private async processRoomSubscriptions(
    userId: string,
    subscriptions: Record<string, RoomSubscription>,
    _since: string | null
  ): Promise<Record<string, RoomResult>> {
    const results: Record<string, RoomResult> = {};
    
    if (Object.keys(subscriptions).length === 0) {
      return results;
    }
    
    // Process each subscription
    const roomIds = Object.keys(subscriptions);
    
    for (const roomId of roomIds) {
      const config = subscriptions[roomId];
      const timelineLimit = config.timeline_limit ?? 20;
      
      try {
        // Fetch room data from database
        const roomData = await this.fetchRoomData(userId, roomId, config, timelineLimit);
        results[roomId] = roomData;
        
      } catch (error) {
        console.error(`Failed to fetch room ${roomId}:`, error);
        results[roomId] = {
          room_id: roomId,
          name: 'Unknown Room',
          timeline: [],
          state: []
        };
      }
    }
    
    return results;
  }

  /**
    * Fetch room data from database
    */
  private async fetchRoomData(
    _userId: string,
    roomId: string,
    _config: RoomSubscription,
    timelineLimit: number
  ): Promise<RoomResult> {
    // Get room state
    const stateQuery = await this.db.prepare(`
      SELECT event_id, event_type, state_key, sender, content, origin_server_ts, depth
      FROM room_state
      WHERE room_id = ?
      ORDER BY depth ASC
      LIMIT 100
    `).bind(roomId).all();
    
    const state = (stateQuery.results || []).map((row: any) => ({
      event_id: row.event_id,
      type: row.type,
      state_key: row.state_key,
      sender: row.sender,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      origin_server_ts: row.origin_server_ts,
      depth: row.depth
    }));
    
    // Get room timeline
    const timelineQuery = await this.db.prepare(`
      SELECT event_id, type, state_key, sender, content, origin_server_ts, depth, unsigned
      FROM events
      WHERE room_id = ? AND event_type = 'm.room.message'
      ORDER BY origin_server_ts DESC
      LIMIT ?
    `).bind(roomId, timelineLimit).all();
    
    const timeline = (timelineQuery.results || []).reverse().map((row: any) => ({
      event_id: row.event_id,
      type: row.type,
      state_key: row.state_key,
      sender: row.sender,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      origin_server_ts: row.origin_server_ts,
      depth: row.depth,
      unsigned: row.unsigned
    }));
    
    // Get room metadata from room_state
    const roomQuery = await this.db.prepare(`
      SELECT 
        r.is_public,
        (SELECT JSON_EXTRACT(e.content, '$.name') FROM room_state rs JOIN events e ON rs.event_id = e.event_id 
         WHERE rs.room_id = ? AND rs.event_type = 'm.room.name' AND rs.state_key = '') as name,
        (SELECT JSON_EXTRACT(e.content, '$.topic') FROM room_state rs JOIN events e ON rs.event_id = e.event_id 
         WHERE rs.room_id = ? AND rs.event_type = 'm.room.topic' AND rs.state_key = '') as topic,
        (SELECT JSON_EXTRACT(e.content, '$.url') FROM room_state rs JOIN events e ON rs.event_id = e.event_id 
         WHERE rs.room_id = ? AND rs.event_type = 'm.room.avatar' AND rs.state_key = '') as avatar_url,
        (SELECT JSON_EXTRACT(e.content, '$.alias') FROM room_state rs JOIN events e ON rs.event_id = e.event_id 
         WHERE rs.room_id = ? AND rs.event_type = 'm.room.canonical_alias' AND rs.state_key = '') as canonical_alias
      FROM rooms r WHERE r.room_id = ?
    `).bind(roomId, roomId, roomId, roomId, roomId).first<{ is_public: number; name: string | null; topic: string | null; avatar_url: string | null; canonical_alias: string | null }>();
    
    return {
      room_id: roomId,
      name: roomQuery?.name ?? undefined,
      topic: roomQuery?.topic ?? undefined,
      avatar: roomQuery?.avatar_url ?? undefined,
      canonical_alias: roomQuery?.canonical_alias ?? undefined,
      required_state: state,
      timeline,
      prev_batch: timeline.length > 0 ? String(timeline[0].origin_server_ts) : undefined
    };
  }

  /**
   * Process sync extensions (to-device, typing, receipts, etc.)
   */
  private async processExtensions(
    userId: string,
    deviceId: string,
    extensions: ExtensionsRequest,
    since: string | null
  ): Promise<ExtensionsResponse> {
    const result: ExtensionsResponse = {};
    
    // Process in parallel
    const promises: Promise<void>[] = [];
    
    if (extensions.to_device?.enabled) {
      promises.push(
        this.processToDevice(userId, deviceId, extensions.to_device).then(r => { result.to_device = r; })
      );
    }
    
    if (extensions.e2ee?.enabled) {
      promises.push(
        this.processE2EE(userId, since).then(r => { result.e2ee = r; })
      );
    }
    
    if (extensions.typing?.enabled) {
      promises.push(
        this.processTyping(userId, extensions.typing.rooms || []).then(r => { result.typing = r; })
      );
    }
    
    if (extensions.receipts?.enabled) {
      promises.push(
        this.processReceipts(userId, extensions.receipts.rooms || []).then(r => { result.receipts = r; })
      );
    }
    
    await Promise.all(promises);
    
    return result;
  }

  /**
   * Process to-device messages extension
   */
private async processToDevice(
  userId: string,
  deviceId: string,
  config: { since?: string; limit?: number }
): Promise<{ next_batch: string; events: any[] }> {
  const limit = config.limit || 100;
  let sincePos = 0;
  if (config.since) {
    const stripped = config.since.startsWith('s') ? config.since.slice(1) : config.since;
    sincePos = parseInt(stripped, 10) || 0;
  }

  const messages = await this.pool.executeQuery(
    `SELECT id, sender_user_id, event_type, content, stream_position
     FROM to_device_messages
     WHERE recipient_user_id = ?
       AND recipient_device_id = ?  -- need device ID; will need to pass it
       AND stream_position > ?
     ORDER BY stream_position ASC
     LIMIT ?`,
    [userId, deviceId, sincePos, limit],
    'high'
  );

  // Format messages as Matrix to‑device events
  const events = messages.map(m => ({
    sender: m.sender_user_id,
    type: m.event_type,
    content: JSON.parse(m.content),
  }));

  // Get max stream position among returned messages for next_batch
  const nextPos = messages.length > 0
    ? Math.max(...messages.map(m => m.stream_position))
    : 0;
  
  return {
    next_batch: `s${nextPos}`,
    events,
  };
 }

  /**
   * Process E2EE extension (device list changes)
   */
private async processE2EE(
  userId: string,
  since: string | null
 ): Promise<{ device_lists?: { changed: string[]; left: string[] } }> {
  if (!since) return {}; // first sync – client will fetch all keys separately

  const sincePos = parseInt(since.startsWith('s') ? since.slice(1) : since, 10) || 0;

  const changed = await this.pool.executeQuery(
    `SELECT DISTINCT user_id
     FROM device_key_changes
     WHERE stream_position > ?
       AND (user_id IN (SELECT user_id FROM room_memberships WHERE room_id IN (
           SELECT room_id FROM room_memberships WHERE user_id = ?
         )) OR user_id = ?)`,
    [sincePos, userId, userId],
    'high'
  );

  return {
    device_lists: {
      changed: changed.map(c => c.user_id),
      left: [], // can be filled if you track users leaving shared rooms
    },
  };
}

  /**
   * Process typing notifications extension
   */
  private async processTyping(
    _userId: string,
    roomIds: string[]
  ): Promise<{ rooms?: Record<string, { user_ids: string[] }> }> {
    if (roomIds.length === 0) return {};
    
    //TODO: Implement via room durable objects
    // const placeholders = roomIds.map(() => '?').join(',');
    // const typing = await this.pool.executeQuery<{
    //   room_id: string;
    //   user_id: string;
    // }>(
    //   `SELECT room_id, user_id FROM typing 
    //    WHERE room_id IN (${placeholders})`,
    //   roomIds,
    //   'low'
    // );
    
    // const rooms: Record<string, { user_ids: string[] }> = {};
    // for (const t of typing) {
    //   if (!rooms[t.room_id]) {
    //     rooms[t.room_id] = { user_ids: [] };
    //   }
    //   rooms[t.room_id].user_ids.push(t.user_id);
    // }
    
    return { rooms: {} };
  }

  /**
   * Process receipts extension
   */
  private async processReceipts(
    _userId: string,
    _roomIds: string[]
  ): Promise<{ rooms?: Record<string, any> }> {
    // Implementation would fetch read receipts
    return {};
  }

  /**
   * Build final response
   */
  private buildResponse(
    lists: Record<string, ListResult>,
    extensions: ExtensionsResponse,
    nextBatch: string,
    roomSubscriptions: Record<string, RoomResult> = {}
  ): any {
    const response: any = {
      pos: nextBatch,
      lists,
      extensions
    };
    
    // Add room subscriptions if present
    if (Object.keys(roomSubscriptions).length > 0) {
      response.rooms = roomSubscriptions;
    }
    
    return response;
  }

  /**
   * Create error result for a list
   */
  private createErrorResult(_error: any): ListResult {
    return {
      count: 0,
      ops: [{
        op: 'INVALIDATE',
        range: [0, 0]
      }]
    };
  }

  /**
   * Handle errors and return appropriate Matrix error response
   */
  private handleError(error: any): Response {
    const errorCode = error.message.includes('timeout') ? 'M_TIMEOUT' :
                      error.message.includes('JSON') ? 'M_BAD_JSON' :
                      'M_UNKNOWN';
    
    return Response.json({
      errcode: errorCode,
      error: error.message
    }, {
      status: errorCode === 'M_BAD_JSON' ? 400 : 500
    });
  }
}

// Add helper to get current max stream position
async function getCurrentStreamPosition(db: D1Database): Promise<number> {
  const result = await db.prepare(
    `SELECT MAX(stream_ordering) as max_pos FROM events`
  ).first<{ max_pos: number }>();
  return result?.max_pos ?? 0;
}

// ============================================
// Factory function for easy instantiation
// ============================================

export function createOptimizedSlidingSyncHandler(env: Env): OptimizedSlidingSyncHandler {
  return new OptimizedSlidingSyncHandler(env);
}