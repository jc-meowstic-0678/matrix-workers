// src/sliding-sync/precomputed-lists.ts
export class PrecomputedListManager {
  private db: D1Database;
  private cache: KVNamespace;
  
  async refreshUserLists(userId: string): Promise<void> {
    // Pre-compute common list types periodically or on membership changes
    const lists = {
      invites: await this.getInvitesList(userId),
      joined: await this.getJoinedList(userId),
      favourites: await this.getFavouritesList(userId),
      dms: await this.getDMList(userId),
      spaces: await this.getSpacesList(userId)
    };
    
    // Cache with user-specific TTL
    await this.cache.put(
      `sliding_sync:precomputed:${userId}`,
      JSON.stringify(lists),
      { expirationTtl: 300 } // 5 minutes
    );
  }
  
  async filterRoomsByList(
    userId: string,
    listConfig: ListConfig,
    since: string | null
  ): Promise<string[]> {
    // Get pre-computed list
    const cached = await this.cache.get(
      `sliding_sync:precomputed:${userId}`,
      'json'
    );
    
    if (cached && !since) {
      // Use pre-computed list for initial sync
      return cached[listConfig.type] || [];
    }
    
    // For incremental sync, use efficient database query with pagination
    return await this.getFilteredRoomsPaginated(userId, listConfig, since);
  }
  
  private async getFilteredRoomsPaginated(
    userId: string,
    listConfig: ListConfig,
    since: string | null
  ): Promise<string[]> {
    const { filters, limit = 100, sort = ['by_recency'] } = listConfig;
    
    // Build query based on filters
    let query = `
      SELECT room_id
      FROM room_members rm
      JOIN rooms r ON rm.room_id = r.room_id
      WHERE rm.user_id = ? AND rm.membership = 'join'
    `;
    
    const params: any[] = [userId];
    
    // Apply filters efficiently
    if (filters?.room_types) {
      query += ` AND r.type IN (${filters.room_types.map(() => '?').join(',')})`;
      params.push(...filters.room_types);
    }
    
    if (filters?.not_room_types) {
      query += ` AND r.type NOT IN (${filters.not_room_types.map(() => '?').join(',')})`;
      params.push(...filters.not_room_types);
    }
    
    if (filters?.is_encrypted !== undefined) {
      query += ` AND r.encrypted = ?`;
      params.push(filters.is_encrypted ? 1 : 0);
    }
    
    if (filters?.room_name_like) {
      query += ` AND r.name LIKE ?`;
      params.push(`%${filters.room_name_like}%`);
    }
    
    // Apply sorting efficiently
    if (sort.includes('by_recency')) {
      query += ` ORDER BY r.last_activity DESC`;
    } else if (sort.includes('by_name')) {
      query += ` ORDER BY r.name ASC`;
    }
    
    // Add pagination
    if (since) {
      const sinceTimestamp = await this.getSinceTimestamp(since);
      query += ` AND r.last_activity > ?`;
      params.push(sinceTimestamp);
    }
    
    query += ` LIMIT ?`;
    params.push(limit);
    
    const result = await this.db.prepare(query).bind(...params).all();
    return result.results.map(r => r.room_id);
  }
}