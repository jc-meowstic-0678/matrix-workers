// Security and session management endpoints

import { Hono } from 'hono';
import { requireAdminAuth } from '../auth';

const securityApi = new Hono();

// GET /api/security/sessions - List active sessions
securityApi.get('/security/sessions', requireAdminAuth, async (c) => {
  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500);

  const sessions = await db.prepare(`
    SELECT 
      at.token_id as id,
      at.user_id,
      at.device_id,
      at.created_at,
      d.display_name as device_name,
      d.last_seen_ts,
      d.last_seen_ip
    FROM access_tokens at
    LEFT JOIN devices d ON at.user_id = d.user_id AND at.device_id = d.device_id
    ORDER BY at.created_at DESC
    LIMIT ?
  `).bind(limit).all();

  const total = await db.prepare('SELECT COUNT(*) as count FROM access_tokens').first<{ count: number }>();

  return c.json({
    sessions: sessions.results,
    total: total?.count || 0,
  });
});

// GET /api/security/sessions/:sessionId - Get session details
securityApi.get('/security/sessions/:sessionId', requireAdminAuth, async (c) => {
  const sessionId = c.req.param('sessionId');
  const db = c.env.DB;

  const session = await db.prepare(`
    SELECT 
      at.token_id as id,
      at.user_id,
      at.device_id,
      at.created_at,
      d.display_name as device_name,
      d.last_seen_ts,
      d.last_seen_ip
    FROM access_tokens at
    LEFT JOIN devices d ON at.user_id = d.user_id AND at.device_id = d.device_id
    WHERE at.token_id = ?
  `).bind(sessionId).first();

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  return c.json(session);
});

// DELETE /api/security/sessions/:sessionId - Revoke session
securityApi.delete('/security/sessions/:sessionId', requireAdminAuth, async (c) => {
  const sessionId = c.req.param('sessionId');
  const db = c.env.DB;

  const result = await db.prepare('DELETE FROM access_tokens WHERE token_id = ?')
    .bind(sessionId).run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Session not found' }, 404);
  }

  return c.json({ success: true });
});

// GET /api/security/rate-limits - Get rate limit configuration
securityApi.get('/security/rate-limits', requireAdminAuth, async (c) => {
  return c.json({
    limits: {
      login: { requests: 10, window_ms: 60000 },
      register: { requests: 5, window_ms: 60000 },
      sync: { requests: 300, window_ms: 60000 },
      default: { requests: 100, window_ms: 60000 },
      send_message: { requests: 60, window_ms: 60000 },
      create_room: { requests: 10, window_ms: 60000 },
    },
  });
});

export { securityApi };