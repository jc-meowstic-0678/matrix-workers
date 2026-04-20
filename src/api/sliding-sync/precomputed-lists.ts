// src/api/sliding-sync/precomputed-lists.ts
import { D1Database, KVNamespace } from '@cloudflare/workers-types';

// ============================================
// Type Definitions
// ============================================

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
}

interface ListConfig {
  type?: 'invites' | 'joined' | 'favourites' | 'dms' | 'spaces';
  filters?: RoomFilter;
  limit?: number;
  sort?: string[];
  ranges?: [number, number][];
}

interface RoomFilter {
  room_types?: string[];
  not_room_types?: string[];
  is_encrypted?: boolean;
  room_name_like?: string;
  is_dm?: boolean;
  spaces?: string[];
  tags?: string[];
  not_tags?: string[];
}

interface PrecomputedLists {
  invites: string[];
  joined: string[];
  favourites: string[];
  dms: string[];
  spaces: string[];
  lastUpdated: number;
  version: number;
}

// ============================================
// Main Precomputed List Manager
// ============================================

export class PrecomputedListManager {
  private db: D1Database;
  private cache: KVNamespace;
  private readonly CACHE_VERSION = 1;
  private readonly DEFAULT_TTL = 300; // 5 minutes
  private readonly MAX_LIST_SIZE = 1000;
  private readonly BATCH_SIZE = 100;

  constructor(env: Env) {
    this.db = env.DB;
    this.cache = env.CACHE;
  }

  /**
   * Refresh all precomputed lists for a user
   * Should be called on membership changes and periodically
   */
  async refreshUserLists(userId: string): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Fetch all list types in parallel for efficiency
      const [invites, joined, favourites, dms, spaces] = await Promise.all([
        this.getInvitesList(userId),
        this.getJoinedList(userId),
        this.getFavouritesList(userId),
        this.getDMList(userId),
        this.getSpacesList(userId)
      ]);

      const lists: PrecomputedLists = {
        invites: invites.slice(0, this.MAX_LIST_SIZE),
        joined: joined.slice(0, this.MAX_LIST_SIZE),
        favourites: favourites.slice(0, this.MAX_LIST_SIZE),
        dms: dms.slice(0, this.MAX_LIST_SIZE),
        spaces: spaces.slice(0, this.MAX_LIST_SIZE),
        lastUpdated: Date.now(),
        version: this.CACHE_VERSION
      };

      // Cache the combined result
      await this.cache.put(
        this.getCacheKey(userId),
        JSON.stringify(lists),
        { expirationTtl: this.DEFAULT_TTL }
      );

      const duration = Date.now() - startTime;
      console.log(`Refreshed lists for ${userId} in ${duration}ms`, {
        invites: invites.length,
        joined: joined.length,
        dms: dms.length
      });

    } catch (error) {
      console.error(`Failed to refresh lists for ${userId}:`, error);
      // Don't throw - stale cache is better than no cache
    }
  }

  /**
   * Get filtered rooms by list type, using cache when possible
   */
  async filterRoomsByList(
    userId: string,
    listConfig: ListConfig,
    since: string | null
  ): Promise<string[]> {
    // For initial sync with no since token, try cache
    if (!since && listConfig.type) {
      const cached = await this.getCachedLists(userId);
      if (cached) {
        // Return the appropriate list type
        switch (listConfig.type) {
          case 'invites': return cached.invites;
          case 'joined': return cached.joined;
          case 'favourites': return cached.favourites;
          case 'dms': return cached.dms;
          case 'spaces': return cached.spaces;
        }
      }
    }

    // For incremental sync or complex filters, use paginated query
    return await this.getFilteredRoomsPaginated(userId, listConfig, since);
  }

  /**
   * Get cached precomputed lists if available and fresh
   */
  private async getCachedLists(userId: string): Promise<PrecomputedLists | null> {
    try {
      const cached = await this.cache.get(
        this.getCacheKey(userId),
        'json'
      );

      if (!cached) return null;

      const lists = cached as PrecomputedLists;

      // Check cache version
      if (lists.version !== this.CACHE_VERSION) {
        return null;
      }

      // Check if cache is stale (should have TTL, but double-check)
      if (Date.now() - lists.lastUpdated > this.DEFAULT_TTL * 1000) {
        // Trigger background refresh without blocking
        this.refreshUserLists(userId).catch(err =>
          console.error('Background refresh failed:', err)
        );
        return lists; // Return stale data while refreshing
      }

      return lists;
    } catch (error) {
      console.error(`Failed to get cached lists for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get invites list for a user
   */
  private async getInvitesList(userId: string): Promise<string[]> {
    const result = await this.db.prepare(`
      SELECT room_id
      FROM room_memberships
      WHERE user_id = ? AND membership = 'invite'
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(userId, this.MAX_LIST_SIZE).all<{ room_id: string }>();

    return result.results?.map(r => r.room_id) || [];
  }

  /**
   * Get joined rooms list for a user
   */
  private async getJoinedList(userId: string): Promise<string[]> {
    const result = await this.db.prepare(`
      SELECT rm.room_id
      FROM room_memberships rm
      JOIN rooms r ON rm.room_id = r.room_id
      WHERE rm.user_id = ? AND rm.membership = 'join'
      ORDER BY (
        SELECT MAX(origin_server_ts) 
        FROM events 
        WHERE room_id = rm.room_id
      ) DESC
      LIMIT ?
    `).bind(userId, this.MAX_LIST_SIZE).all<{ room_id: string }>();

    return result.results?.map(r => r.room_id) || [];
  }

  /**
   * Get favourites list (rooms with m.favourite tag)
   */
  private async getFavouritesList(userId: string): Promise<string[]> {
    const result = await this.db.prepare(`
      SELECT ad.room_id
      FROM account_data ad
      WHERE ad.user_id = ? 
        AND ad.event_type = 'm.tag'
        AND JSON_EXTRACT(ad.content, '$.tags.m.favourite') IS NOT NULL
      ORDER BY ad.created_at DESC
      LIMIT ?
    `).bind(userId, this.MAX_LIST_SIZE).all<{ room_id: string }>();

    return result.results?.map(r => r.room_id) || [];
  }

  /**
   * Get spaces list (rooms where user is a member and room is a space)
   */
  private async getSpacesList(userId: string): Promise<string[]> {
    // Spaces are rooms with m.space.child state events
    const result = await this.db.prepare(`
      SELECT DISTINCT rm.room_id
      FROM room_memberships rm
      JOIN room_state rs ON rm.room_id = rs.room_id
      WHERE rm.user_id = ? 
        AND rm.membership = 'join'
        AND rs.event_type = 'm.space.child'
      ORDER BY rm.created_at DESC
      LIMIT ?
    `).bind(userId, this.MAX_LIST_SIZE).all<{ room_id: string }>();

    return result.results?.map(r => r.room_id) || [];
  }

  /**
   * Get DM rooms list (rooms with exactly 2 members)
   */
  private async getDMList(userId: string): Promise<string[]> {
    const result = await this.db.prepare(`
      SELECT rm.room_id
      FROM room_memberships rm
      JOIN rooms r ON rm.room_id = r.room_id
      WHERE rm.user_id = ? 
        AND rm.membership = 'join'
        AND r.member_count = 2
      ORDER BY (
        SELECT MAX(origin_server_ts) 
        FROM events 
        WHERE room_id = rm.room_id
      ) DESC
      LIMIT ?
    `).bind(userId, this.MAX_LIST_SIZE).all<{ room_id: string }>();

    return result.results?.map(r => r.room_id) || [];
  }

  /**
   * Get filtered rooms with pagination for incremental sync
   */
  private async getFilteredRoomsPaginated(
    userId: string,
    listConfig: ListConfig,
    since: string | null
  ): Promise<string[]> {
    const { filters, limit = 100, sort = ['by_recency'] } = listConfig;
    
    // Build the base query
    let query = `
      SELECT DISTINCT rm.room_id
      FROM room_memberships rm
      JOIN rooms r ON rm.room_id = r.room_id
      WHERE rm.user_id = ? AND rm.membership = 'join'
    `;
    
    const params: any[] = [userId];
    
    // Apply filters if present
    if (filters) {
      const filterClauses = this.buildFilterClauses(userId, filters, params);
      if (filterClauses) {
        query += ` AND ${filterClauses}`;
      }
    }

    // Add sorting
    query += this.buildSortClause(sort);

    //Implement Stream Position Pagination
    if (since) {
    let sincePos = 0;
    const stripped = since.startsWith('s') ? since.slice(1) : since;
    sincePos = parseInt(stripped, 10) || 0;
    if (sincePos > 0) {
      query += ` AND (SELECT MAX(stream_ordering) FROM events WHERE room_id = rm.room_id) > ?`;
      params.push(sincePos);
    }
  }

    // Add limit
    query += ` LIMIT ?`;
    params.push(Math.min(limit, this.MAX_LIST_SIZE));

    // Execute query
    const result = await this.db.prepare(query).bind(...params).all<{ room_id: string }>();
    
    return result.results?.map(r => r.room_id) || [];
  }

  /**
   * Build SQL filter clauses from filter object
   */
  private buildFilterClauses(userId: string, filters: RoomFilter, params: any[]): string | null {
    const clauses: string[] = [];

    if (filters.room_types && filters.room_types.length > 0) {
      clauses.push(`EXISTS (
        SELECT 1 FROM room_state rs 
        WHERE rs.room_id = r.room_id AND rs.event_type IN (${filters.room_types.map(() => '?').join(',')})
      )`);
      params.push(...filters.room_types);
    }

    if (filters.not_room_types && filters.not_room_types.length > 0) {
      clauses.push(`NOT EXISTS (
        SELECT 1 FROM room_state rs 
        WHERE rs.room_id = r.room_id AND rs.event_type IN (${filters.not_room_types.map(() => '?').join(',')})
      )`);
      params.push(...filters.not_room_types);
    }

    if (filters.is_encrypted !== undefined) {
      clauses.push(`EXISTS (
        SELECT 1 FROM room_state rs 
        WHERE rs.room_id = r.room_id AND rs.event_type = 'm.room.encryption'
      ) = ?`);
      params.push(filters.is_encrypted ? 1 : 0);
    }

    if (filters.room_name_like) {
      clauses.push(`EXISTS (
        SELECT 1 FROM room_state rs 
        JOIN events e ON rs.event_id = e.event_id
        WHERE rs.room_id = r.room_id AND rs.event_type = 'm.room.name' AND rs.state_key = ''
        AND JSON_EXTRACT(e.content, '$.name') LIKE ?
      )`);
      params.push(`%${filters.room_name_like}%`);
    }

    if (filters.is_dm !== undefined) {
      if (filters.is_dm) {
        clauses.push(`NOT EXISTS (
          SELECT 1 FROM room_state rs 
          WHERE rs.room_id = r.room_id AND rs.event_type = 'm.room.name' AND rs.state_key = ''
        ) AND (
          SELECT COUNT(*) 
          FROM room_memberships 
          WHERE room_id = r.room_id AND membership = 'join'
        ) = 2`);
      } else {
        clauses.push(`(EXISTS (
          SELECT 1 FROM room_state rs 
          WHERE rs.room_id = r.room_id AND rs.event_type = 'm.room.name' AND rs.state_key = ''
        ) OR (
          SELECT COUNT(*) 
          FROM room_memberships 
          WHERE room_id = r.room_id AND membership = 'join'
        ) != 2)`);
      }
    }

    if (filters.spaces && filters.spaces.length > 0) {
      // This requires a more complex query for space hierarchy
      // For now, we'll handle it with a simpler approach
      clauses.push(`EXISTS (
        SELECT 1 FROM room_state 
        WHERE room_id = r.room_id 
          AND event_type = 'm.space.child'
          AND state_key IN (${filters.spaces.map(() => '?').join(',')})
      )`);
      params.push(...filters.spaces);
    }

    if (filters.tags && filters.tags.length > 0) {
    const conditions = filters.tags.map(tag => 
    `EXISTS (
      SELECT 1 FROM account_data
      WHERE user_id = ? 
        AND room_id = r.room_id
        AND event_type = 'm.tag'
        AND json_extract(content, '$.tags.${tag}') IS NOT NULL
    )`
  );
  clauses.push(`(${conditions.join(' OR ')})`);
  // Push userId once per tag? No, each condition needs its own param.
  // Better to loop and push params accordingly.
  filters.tags.forEach(() => params.push(userId));
}

    return clauses.length > 0 ? clauses.join(' AND ') : null;
  }

  /**
   * Build ORDER BY clause from sort array
   */
  private buildSortClause(sort: string[]): string {
    if (sort.includes('by_recency')) {
      return ` ORDER BY (
        SELECT MAX(origin_server_ts) 
        FROM events 
        WHERE room_id = rm.room_id
      ) DESC`;
    } else if (sort.includes('by_name')) {
      return ` ORDER BY (
        SELECT JSON_EXTRACT(e.content, '$.name') 
        FROM room_state rs 
        JOIN events e ON rs.event_id = e.event_id
        WHERE rs.room_id = r.room_id AND rs.event_type = 'm.room.name' AND rs.state_key = ''
      ) ASC`;
    } else if (sort.includes('by_importance')) {
      return ` ORDER BY 
        CASE 
          WHEN EXISTS (SELECT 1 FROM account_data WHERE user_id = rm.user_id AND room_id = rm.room_id AND event_type = 'm.tag' AND JSON_EXTRACT(content, '$.tags.m.favourite') IS NOT NULL) THEN 1
          ELSE 2
        END,
        (
          SELECT MAX(origin_server_ts) 
          FROM events 
          WHERE room_id = rm.room_id
        ) DESC`;
    }
    
    return ''; // Default ordering
  }

  /**
   * Get cache key for user's precomputed lists
   */
  private getCacheKey(userId: string): string {
    return `sliding_sync:precomputed:v${this.CACHE_VERSION}:${userId}`;
  }

  /**
   * Invalidate cache for a user (call on membership changes)
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      await this.cache.delete(this.getCacheKey(userId));
    } catch (error) {
      console.error(`Failed to invalidate cache for ${userId}:`, error);
    }
  }

  /**
   * Batch refresh for multiple users (useful for maintenance)
   */
  async batchRefreshUsers(userIds: string[]): Promise<void> {
    for (let i = 0; i < userIds.length; i += this.BATCH_SIZE) {
      const batch = userIds.slice(i, i + this.BATCH_SIZE);
      await Promise.allSettled(
        batch.map(userId => this.refreshUserLists(userId))
      );
      
      // Small delay between batches to avoid overwhelming the database
      if (i + this.BATCH_SIZE < userIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Get statistics about precomputed lists
   */
  async getStats(): Promise<{
    cachedUsers: number;
    totalRooms: number;
    averageListSize: number;
  }> {
    // This would list all cache keys and aggregate stats
    // Implementation depends on KV list operation limits
    return {
      cachedUsers: 0,
      totalRooms: 0,
      averageListSize: 0
    };
  }
}

// ============================================
// Factory function for easy instantiation
// ============================================

export function createPrecomputedListManager(env: Env): PrecomputedListManager {
  return new PrecomputedListManager(env);
}
