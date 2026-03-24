// Security and session management endpoints

import { Hono } from 'hono';
import { requireAdminAuth } from '../auth';
import { generateSigningKeyPair } from '../../utils/crypto';

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

// POST /api/security/server-key - Generate a new server signing key
securityApi.post('/security/server-key', requireAdminAuth, async (c) => {
  const db = c.env.DB;

  // Generate a new Ed25519 key pair
  const { publicKey, privateKeyJwk, keyId } = await generateSigningKeyPair();

  // Mark any existing keys as not current
  await db.prepare('UPDATE server_keys SET is_current = 0').run();

  // Insert the new key
  await db.prepare(`
    INSERT INTO server_keys (key_id, public_key, private_key, private_key_jwk, valid_from, is_current, key_version)
    VALUES (?, ?, ?, ?, ?, 1, 2)
  `).bind(
    keyId,
    publicKey,
    '', // legacy format - not used
    JSON.stringify(privateKeyJwk),
    Date.now()
  ).run();

  return c.json({
    success: true,
    key_id: keyId,
    public_key: publicKey,
    message: 'Server signing key generated successfully. Restart workers to use new key.',
  });
});

// GET /api/security/server-key - Get current server signing key info
securityApi.get('/security/server-key', requireAdminAuth, async (c) => {
  const db = c.env.DB;

  const key = await db.prepare(`
    SELECT key_id, public_key, valid_from, is_current, key_version
    FROM server_keys
    ORDER BY is_current DESC, key_version DESC
    LIMIT 5
  `).all();

  return c.json({
    keys: key.results,
    current_key_version: 2,
  });
});

// GET /api/security/secrets-status - Check which secrets are configured
securityApi.get('/security/secrets-status', requireAdminAuth, async (c) => {
  const env = c.env as Record<string, unknown>;
  
  return c.json({
    secrets: {
      admin_password_hash: !!env.ADMIN_PASSWORD_HASH,
      oidc_encryption_key: !!env.OIDC_ENCRYPTION_KEY,
      turn_secret: !!env.TURN_SECRET,
      turn_credentials_secret: !!env.TURN_CREDENTIALS_SECRET,
    },
    server_config: {
      registration_enabled: true, // Check from DB if needed
      federation_enabled: true, // Always enabled
    }
  });
});

export { securityApi };