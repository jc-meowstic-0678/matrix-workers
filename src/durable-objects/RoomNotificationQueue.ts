// src/durable-objects/RoomNotificationQueue.ts
// Handles batched fan-out of room notifications to user SyncDurableObjects

import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../types';

interface QueuedNotification {
  roomId: string;
  eventId: string;
  eventType: string;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  memberIds: string[];
  processedCount: number;
  failedMembers: string[];
}

export class RoomNotificationQueue extends DurableObject<Env> {
  private readonly BATCH_SIZE = 50; // Cloudflare subrequest limit
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/queue-notification') {
      return this.handleQueueNotification(request);
    }

    if (path === '/process-queue') {
      return this.handleProcessQueue();
    }

    if (path === '/status') {
      return this.handleStatus();
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Queue a new room notification for fan-out
   */
  private async handleQueueNotification(request: Request): Promise<Response> {
    try {
      const { roomId, eventId, eventType, timestamp, memberIds } = await request.json() as {
        roomId: string;
        eventId: string;
        eventType: string;
        timestamp: number;
        memberIds: string[];
      };

      const notificationId = `${roomId}:${eventId}:${timestamp}`;

      const queued: QueuedNotification = {
        roomId,
        eventId,
        eventType,
        timestamp,
        status: 'pending',
        retryCount: 0,
        memberIds,
        processedCount: 0,
        failedMembers: []
      };

      // Store in Durable Object storage
      await this.ctx.storage.put(`notification:${notificationId}`, queued);
      
      // Add to processing queue index
      const pendingQueue = await this.ctx.storage.get<string[]>('pending-queue') || [];
      pendingQueue.push(notificationId);
      await this.ctx.storage.put('pending-queue', pendingQueue);

      // Trigger processing alarm if not already set
      const currentAlarm = await this.ctx.storage.getAlarm();
      if (!currentAlarm || currentAlarm > Date.now() + 100) {
        await this.ctx.storage.setAlarm(Date.now() + 100);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        notificationId,
        totalMembers: memberIds.length 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('[RoomNotificationQueue] Error queueing notification:', error);
      return new Response(JSON.stringify({ error: 'Failed to queue notification' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Process the notification queue in batches
   */
  private async handleProcessQueue(): Promise<Response> {
    await this.processQueue();
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get queue status for monitoring
   */
  private async handleStatus(): Promise<Response> {
    const pendingQueue = await this.ctx.storage.get<string[]>('pending-queue') || [];
    const processing = await this.ctx.storage.get<string[]>('processing-queue') || [];
    
    const stats = {
      pending: pendingQueue.length,
      processing: processing.length,
      completed: await this.ctx.storage.get<number>('completed-count') || 0,
      failed: await this.ctx.storage.get<number>('failed-count') || 0
    };

    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Alarm handler for queue processing
   */
  async alarm(): Promise<void> {
    console.log('[RoomNotificationQueue] Alarm triggered, processing queue');
    await this.processQueue();
  }

  /**
   * Process notifications in batches
   */
  private async processQueue(): Promise<void> {
    // Get pending notifications
    let pendingQueue = await this.ctx.storage.get<string[]>('pending-queue') || [];
    let processingQueue = await this.ctx.storage.get<string[]>('processing-queue') || [];

    if (pendingQueue.length === 0 && processingQueue.length === 0) {
      return;
    }

    // Move pending to processing
    const batch = pendingQueue.slice(0, 5); // Process 5 notifications at a time
    pendingQueue = pendingQueue.slice(5);
    processingQueue = [...processingQueue, ...batch];

    await this.ctx.storage.put('pending-queue', pendingQueue);
    await this.ctx.storage.put('processing-queue', processingQueue);

    // Process each notification in the batch
    for (const notificationId of batch) {
      const notification = await this.ctx.storage.get<QueuedNotification>(`notification:${notificationId}`);
      if (!notification) continue;

      try {
        await this.processNotification(notification);
        
        // Move to completed
        processingQueue = processingQueue.filter(id => id !== notificationId);
        await this.ctx.storage.put('processing-queue', processingQueue);
        
        await this.ctx.storage.delete(`notification:${notificationId}`);
        await this.ctx.storage.put('completed-count', (await this.ctx.storage.get<number>('completed-count') || 0) + 1);

      } catch (error) {
        console.error(`[RoomNotificationQueue] Failed to process notification ${notificationId}:`, error);
        
        notification.retryCount++;
        
        if (notification.retryCount >= this.MAX_RETRIES) {
          // Max retries exceeded, move to failed
          processingQueue = processingQueue.filter(id => id !== notificationId);
          await this.ctx.storage.put('processing-queue', processingQueue);
          await this.ctx.storage.put(`failed:${notificationId}`, notification);
          await this.ctx.storage.put('failed-count', (await this.ctx.storage.get<number>('failed-count') || 0) + 1);
        } else {
          // Requeue for retry
          pendingQueue.push(notificationId);
        }
      }
    }

    // Update queues
    await this.ctx.storage.put('pending-queue', pendingQueue);
    await this.ctx.storage.put('processing-queue', processingQueue);

    // Schedule next processing if there are pending items
    if (pendingQueue.length > 0 || processingQueue.length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + this.RETRY_DELAY);
    }
  }

  /**
   * Process a single notification by fanning out to members in batches
   */
  private async processNotification(notification: QueuedNotification): Promise<void> {
    const { roomId, eventId, eventType, timestamp, memberIds } = notification;
    
    console.log(`[RoomNotificationQueue] Processing notification for room ${roomId}, ${memberIds.length} members`);

    // Process members in batches of 50
    for (let i = 0; i < memberIds.length; i += this.BATCH_SIZE) {
      const batch = memberIds.slice(i, i + this.BATCH_SIZE);
      
      try {
        await this.notifyMemberBatch(batch, roomId, eventId, eventType, timestamp);
        notification.processedCount += batch.length;
        
        // Update progress in storage
        await this.ctx.storage.put(`notification:${roomId}:${eventId}:${timestamp}`, notification);
        
      } catch (error) {
        console.error(`[RoomNotificationQueue] Batch failed for members ${i}-${i + batch.length}:`, error);
        notification.failedMembers.push(...batch);
        
        // If too many failures, throw to trigger retry
        if (notification.failedMembers.length > memberIds.length * 0.1) { // More than 10% failed
          throw error;
        }
      }

      // Small delay between batches to avoid overwhelming the system
      if (i + this.BATCH_SIZE < memberIds.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    console.log(`[RoomNotificationQueue] Completed notification for room ${roomId}, ` +
      `processed: ${notification.processedCount}, failed: ${notification.failedMembers.length}`);
  }

  /**
   * Notify a batch of users by calling their SyncDurableObjects
   */
  private async notifyMemberBatch(
    memberIds: string[],
    roomId: string,
    eventId: string,
    eventType: string,
    timestamp: number
  ): Promise<void> {
    const promises = memberIds.map(async (userId) => {
      try {
        const syncDO = this.env.SYNC.get(this.env.SYNC.idFromName(userId));
        await syncDO.fetch(new Request('http://internal/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventId,
            room_id: roomId,
            type: eventType,
            timestamp
          })
        }));
      } catch (error) {
        console.error(`[RoomNotificationQueue] Failed to notify user ${userId}:`, error);
        throw error;
      }
    });

    await Promise.all(promises);
  }
}