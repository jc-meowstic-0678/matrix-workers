// Full-Text Search indexing helpers for D1
// Manages FTS5 virtual tables since D1 doesn't support FTS triggers

export async function indexUserFts(
  db: D1Database,
  userId: string,
  localpart: string,
  displayName?: string
): Promise<void> {
  await db.prepare(
    `INSERT OR REPLACE INTO users_fts (user_id, localpart, display_name) VALUES (?, ?, ?)`
  ).bind(userId, localpart, displayName ?? '').run();
}

export async function removeUserFts(
  db: D1Database,
  userId: string
): Promise<void> {
  await db.prepare(
    `DELETE FROM users_fts WHERE user_id = ?`
  ).bind(userId).run();
}

export async function indexEventFts(
  db: D1Database,
  eventId: string,
  roomId: string,
  sender: string,
  body?: string
): Promise<void> {
  if (!body) {
    body = '';
  }
  await db.prepare(
    `INSERT OR REPLACE INTO events_fts (event_id, room_id, sender, body) VALUES (?, ?, ?, ?)`
  ).bind(eventId, roomId, sender, body).run();
}

export async function searchUsersFts(
  db: D1Database,
  query: string,
  limit: number = 10
): Promise<Array<{ user_id: string; localpart: string; display_name: string }>> {
  const sanitized = query.replace(/['"*()]/g, ' ').trim();
  
  const results = await db.prepare(
    `SELECT user_id, localpart, display_name FROM users_fts 
     WHERE users_fts MATCH ? 
     LIMIT ?`
  ).bind(sanitized, limit).all<{ user_id: string; localpart: string; display_name: string }>();
  
  return results.results;
}

export async function searchEventsFts(
  db: D1Database,
  query: string,
  roomId?: string,
  sender?: string,
  limit: number = 50
): Promise<Array<{ event_id: string; room_id: string; sender: string; body: string }>> {
  const sanitized = query.replace(/['"*()]/g, ' ').trim();
  
  let sql = `SELECT event_id, room_id, sender, body FROM events_fts WHERE events_fts MATCH ?`;
  const bindings: (string | number)[] = [sanitized];
  
  if (roomId) {
    sql += ` AND room_id = ?`;
    bindings.push(roomId);
  }
  
  if (sender) {
    sql += ` AND sender = ?`;
    bindings.push(sender);
  }
  
  sql += ` LIMIT ?`;
  bindings.push(limit);
  
  const results = await db.prepare(sql).bind(...bindings).all<{
    event_id: string;
    room_id: string;
    sender: string;
    body: string;
  }>();
  
  return results.results;
}
