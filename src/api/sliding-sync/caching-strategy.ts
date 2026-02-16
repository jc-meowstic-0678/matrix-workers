// src/api/sliding-sync/caching-strategy.ts
import { KVNamespace, D1Database } from '@cloudflare/workers-types';

// ============================================
// Type Definitions
// ============================================

interface RoomSummary {
  roomId: string;
  name?: string;
  topic?: string;
  avatar?: string;
  canonicalAlias?: string;
  memberCount: number;
  lastEventId?: string;
  lastEventTimestamp: number;
  membership?: 'join' | 'invite' | 'leave' | 'ban' | 'knock';
  heroes?: Array<{
    userId: string;
    displayName?: string;
    avatarUrl?: string;
  }>;
  isDM?: boolean;
}

interface RoomCacheEntry {
  summary: RoomSummary;
  lastEventId: string;
  lastEventTimestamp: number;
  memberCount: number;
  cachedAt: number;
  version: number;
}

interface RoomRow {
  room_id: string;
  name: string | null;
  topic: string | null;
  avatar_url: string | null;
  canonical_alias: string | null;
  member_count: number;
  last_event_id: string | null;
  last_timestamp: number | null;
  membership: 'join' | 'invite' | 'leave' | 'ban' | 'knock' | null;
}

interface Env {
  CACHE: KVNamespace;
  DB: D1Database;
}

// ============================================
// Main Class
// ============================================

export class CachedSlidingSyncHandler {
  private cache: KVNamespace;
  private db: D1Database;
  private readonly CACHE_TTL = 30_000; // 30 seconds
  private readonly ROOM_BATCH_SIZE = 50;
  private readonly CACHE_VERSION = 1;

  constructor(env: Env) {
    this.cache = env.CACHE;
    this.db = env.DB;
  }

  /**
   * Get room data for multiple rooms, using cache when possible
   */
  async getRoomData(
    userId: string,
    roomIds: string[],
    since: string | null
  ): Promise<Map<string, RoomSummary>> {
    const results = new Map<string, RoomSummary>();
    const uncachedRooms: string[] = [];

    // Try cache first for each room
    for (const roomId of roomIds) {
      try {
        const cached = await this.getCachedRoomSummary(userId, roomId, since);
        if (cached && !this.isStale(cached)) {
          results.set(roomId, cached.summary);
        } else {
          uncachedRooms.push(roomId);
        }
      } catch (error) {
        // If cache fails, fall back to fetching fresh data
        console.error(`Cache error for room ${roomId}:`, error);
        uncachedRooms.push(roomId);
      }
    }

    // Batch fetch uncached rooms
    if (uncachedRooms.length > 0) {
      try {
        const freshData = await this.batchFetchRooms(userId, uncachedRooms, since);
        
        // Update cache and results
        for (const [roomId, summary] of freshData) {
          // Cache in background - don't await
          this.cacheRoomSummary(userId, roomId, summary).catch(err => 
            console.error(`Failed to cache room ${roomId}:`, err)
          );
          results.set(roomId, summary);
        }
      } catch (error) {
        console.error('Batch fetch failed:', error);
        // Re-throw to let caller handle
        throw new Error(`Failed to fetch room data: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Batch fetch multiple rooms in a single D1 query
   */
  private async batchFetchRooms(
    userId: string,
    roomIds: string[],
    since: string | null
  ): Promise<Map<string, RoomSummary>> {
    if (roomIds.length === 0) {
      return new Map();
    }

    const results = new Map<string, RoomSummary>();
    
    // Process in optimal batches for D1
    for (let i = 0; i < roomIds.length; i += this.ROOM_BATCH_SIZE) {
      const batch = roomIds.slice(i, i + this.ROOM_BATCH_SIZE);
      const placeholders = batch.map(() => '?').join(',');
      
      // Build query with optional since filter
      let query = `
        SELECT 
          r.room_id,
          r.name,
          r.topic,
          r.avatar_url,
          r.canonical_alias,
          COALESCE(
            (SELECT COUNT(*) FROM room_memberships WHERE room_id = r.room_id AND membership = 'join'),
            0
          ) as member_count,
          (
            SELECT event_id FROM events 
            WHERE room_id = r.room_id 
            ORDER BY origin_server_ts DESC 
            LIMIT 1
          ) as last_event_id,
          (
            SELECT origin_server_ts FROM events 
            WHERE room_id = r.room_id 
            ORDER BY origin_server_ts DESC 
            LIMIT 1
          ) as last_timestamp,
          (
            SELECT membership FROM room_memberships 
            WHERE room_id = r.room_id AND user_id = ?
          ) as membership
        FROM rooms r
        WHERE r.room_id IN (${placeholders})
      `;

      const params: any[] = [userId, ...batch];

      // Add since filter if provided (only return rooms with activity after since)
      if (since) {
        const sinceTimestamp = parseInt(since);
        if (!isNaN(sinceTimestamp)) {
          query += ` AND EXISTS (
            SELECT 1 FROM events 
            WHERE room_id = r.room_id AND origin_server_ts > ?
          )`;
          params.push(sinceTimestamp);
        }
      }

      const stmt = this.db.prepare(query);
      const rooms = await stmt.bind(...params).all<RoomRow>();

      for (const room of rooms.results || []) {
        const summary = this.formatRoomSummary(room);
        results.set(room.room_id, summary);
      }
    }
    
    return results;
  }

  /**
   * Get cached room summary if available and fresh
   */
  private async getCachedRoomSummary(
    userId: string,
    roomId: string,
    since: string | null
  ): Promise<RoomCacheEntry | null> {
    const cacheKey = `sliding_sync:room:${userId}:${roomId}`;
    
    try {
      const cached = await this.cache.get(cacheKey, 'json');
      if (!cached) return null;

      const entry = cached as RoomCacheEntry;

      // Validate cache version
      if (entry.version !== this.CACHE_VERSION) {
        return null;
      }

      // If client provided a since token, check if anything changed after that
      if (since) {
        const sinceTimestamp = parseInt(since);
        if (!isNaN(sinceTimestamp)) {
          const lastChange = await this.getLastRoomChange(roomId);
          if (lastChange && lastChange <= sinceTimestamp) {
            return entry; // Cache is still fresh for this client
          }
        }
      }
      
      return entry;
    } catch (error) {
      console.error(`Error reading cache for ${roomId}:`, error);
      return null; // Cache read failed, treat as uncached
    }
  }

  /**
   * Cache a room summary
   */
  private async cacheRoomSummary(
    userId: string,
    roomId: string,
    summary: RoomSummary
  ): Promise<void> {
    const cacheKey = `sliding_sync:room:${userId}:${roomId}`;
    
    const entry: RoomCacheEntry = {
      summary,
      lastEventId: summary.lastEventId || '',
      lastEventTimestamp: summary.lastEventTimestamp,
      memberCount: summary.memberCount,
      cachedAt: Date.now(),
      version: this.CACHE_VERSION
    };

    try {
      await this.cache.put(cacheKey, JSON.stringify(entry), {
        expirationTtl: Math.ceil(this.CACHE_TTL / 1000) // Convert to seconds
      });
    } catch (error) {
      console.error(`Failed to cache room ${roomId}:`, error);
      // Non-critical, don't throw
    }
  }

  /**
   * Check if cache entry is stale
   */
  private isStale(entry: RoomCacheEntry): boolean {
    return Date.now() - entry.cachedAt > this.CACHE_TTL;
  }

  /**
   * Get timestamp of last change in a room
   */
  private async getLastRoomChange(roomId: string): Promise<number | null> {
    try {
      const result = await this.db.prepare(`
        SELECT MAX(origin_server_ts) as last_change
        FROM events
        WHERE room_id = ?
      `).bind(roomId).first<{ last_change: number | null }>();

      return result?.last_change || null;
    } catch (error) {
      console.error(`Failed to get last change for room ${roomId}:`, error);
      return null;
    }
  }

  /**
   * Format raw database row into RoomSummary
   */
  private formatRoomSummary(room: RoomRow): RoomSummary {
    // Determine if this is a DM (room with 2 members and no name)
    const isDM = room.member_count === 2 && !room.name;

    // Get heroes (sample of members for display)
    const heroes = this.getRoomHeroes(room.room_id, room.membership === 'join' ? 5 : 3);

    return {
      roomId: room.room_id,
      name: room.name || undefined,
      topic: room.topic || undefined,
      avatar: room.avatar_url || undefined,
      canonicalAlias: room.canonical_alias || undefined,
      memberCount: room.member_count,
      lastEventId: room.last_event_id || undefined,
      lastEventTimestamp: room.last_timestamp || 0,
      membership: room.membership || undefined,
      heroes: heroes.slice(0, room.membership === 'join' ? 5 : 3),
      isDM
    };
  }

  /**
   * Get heroes (sample members) for a room
   * Note: This would ideally be cached or batched, but kept simple for now
   */
  private getRoomHeroes(
    roomId: string,
    limit: number
  ): Array<{ userId: string; displayName?: string; avatarUrl?: string }> {
    // This is a placeholder - in a real implementation, you'd query the database
    // For now, we'll return an empty array and let the caller handle it
    // The actual implementation would be:
    /*
    const result = await this.db.prepare(`
      SELECT 
        rm.user_id,
        u.display_name,
        u.avatar_url
      FROM room_memberships rm
      JOIN users u ON rm.user_id = u.user_id
      WHERE rm.room_id = ? AND rm.membership = 'join'
      LIMIT ?
    `).bind(roomId, limit).all();
    
    return result.results.map(row => ({
      userId: row.user_id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url
    }));
    */
    
    // Temporary implementation to avoid errors
    return [];
  }

  /**
   * Invalidate cache for a room (call when room state changes)
   */
  async invalidateRoomCache(userId: string, roomId: string): Promise<void> {
    const cacheKey = `sliding_sync:room:${userId}:${roomId}`;
    try {
      await this.cache.delete(cacheKey);
    } catch (error) {
      console.error(`Failed to invalidate cache for ${roomId}:`, error);
    }
  }

  /**
   * Bulk invalidate cache for multiple rooms
   */
  async invalidateBulk(userId: string, roomIds: string[]): Promise<void> {
    await Promise.allSettled(
      roomIds.map(roomId => this.invalidateRoomCache(userId, roomId))
    );
  }
}

// ============================================
// Export factory function for easy instantiation
// ============================================

export function createCachedSlidingSyncHandler(env: Env): CachedSlidingSyncHandler {
  return new CachedSlidingSyncHandler(env);
}