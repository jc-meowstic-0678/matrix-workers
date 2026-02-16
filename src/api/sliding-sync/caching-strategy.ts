// src/sliding-sync/caching-strategy.ts
interface RoomCacheEntry {
  summary: RoomSummary;
  lastEventId: string;
  lastEventTimestamp: number;
  memberCount: number;
  cachedAt: number;
  version: number; // For cache invalidation
}

export class CachedSlidingSyncHandler {
  private cache: KVNamespace;
  private db: D1Database;
  private readonly CACHE_TTL = 30_000; // 30 seconds
  private readonly ROOM_BATCH_SIZE = 50;
  
  async getRoomData(
    userId: string,
    roomIds: string[],
    since: string | null
  ): Promise<Map<string, RoomSummary>> {
    const results = new Map();
    const uncachedRooms: string[] = [];
    
    // Try cache first
    for (const roomId of roomIds) {
      const cached = await this.getCachedRoomSummary(userId, roomId, since);
      if (cached && !this.isStale(cached)) {
        results.set(roomId, cached.summary);
      } else {
        uncachedRooms.push(roomId);
      }
    }
    
    // Batch fetch uncached rooms
    if (uncachedRooms.length > 0) {
      const freshData = await this.batchFetchRooms(userId, uncachedRooms, since);
      
      // Update cache and results
      for (const [roomId, summary] of freshData) {
        await this.cacheRoomSummary(userId, roomId, summary);
        results.set(roomId, summary);
      }
    }
    
    return results;
  }
  
  private async batchFetchRooms(
    userId: string,
    roomIds: string[],
    since: string | null
  ): Promise<Map<string, RoomSummary>> {
    const results = new Map();
    
    // Process in optimal batches for D1
    for (let i = 0; i < roomIds.length; i += this.ROOM_BATCH_SIZE) {
      const batch = roomIds.slice(i, i + this.ROOM_BATCH_SIZE);
      
      // Single query for multiple rooms using IN clause
      const rooms = await this.db.prepare(`
        SELECT 
          r.room_id,
          r.name,
          r.topic,
          r.avatar_url,
          r.canonical_alias,
          (SELECT COUNT(*) FROM room_members WHERE room_id = r.room_id) as member_count,
          (SELECT event_id FROM room_events 
           WHERE room_id = r.room_id 
           ORDER BY origin_server_ts DESC 
           LIMIT 1) as last_event_id,
          (SELECT origin_server_ts FROM room_events 
           WHERE room_id = r.room_id 
           ORDER BY origin_server_ts DESC 
           LIMIT 1) as last_timestamp,
          (SELECT membership FROM room_members 
           WHERE room_id = r.room_id AND user_id = ?) as membership
        FROM rooms r
        WHERE r.room_id IN (${batch.map(() => '?').join(',')})
      `).bind(userId, ...batch).all();
      
      for (const room of rooms.results) {
        results.set(room.room_id, this.formatRoomSummary(room));
      }
    }
    
    return results;
  }
  
  private async getCachedRoomSummary(
    userId: string,
    roomId: string,
    since: string | null
  ): Promise<RoomCacheEntry | null> {
    const cacheKey = `sliding_sync:room:${userId}:${roomId}`;
    const cached = await this.cache.get(cacheKey, 'json');
    
    if (!cached) return null;
    
    // If client provided a since token, check if anything changed after that
    if (since) {
      const lastChange = await this.getLastRoomChange(roomId);
      if (lastChange <= parseInt(since)) {
        return cached; // Cache is still fresh for this client
      }
    }
    
    return cached;
  }
  
  private isStale(entry: RoomCacheEntry): boolean {
    return Date.now() - entry.cachedAt > this.CACHE_TTL;
  }
}