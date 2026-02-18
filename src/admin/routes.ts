// src/admin/routes.ts
import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { requireAdminAuth, handleAdminLogin, handleAdminLogout, handleAdminStatus } from './auth';
import { hashPassword } from '../utils/crypto';
import { adminApi } from './index';

// Re-export the main admin API router
export { adminApi };

// Create a separate router for the specific endpoints needed by routes.ts
const adminAuthApi = new Hono<AppEnv>();

// Public endpoints
adminAuthApi.post('/api/login', handleAdminLogin);
adminAuthApi.get('/api/status', handleAdminStatus);

// Protected endpoints
adminAuthApi.post('/api/logout', requireAdminAuth, handleAdminLogout);

adminAuthApi.get('/api/stats', requireAdminAuth, async (c) => {
  const db = c.env.DB;
  
  try {
    const [totalUsers, activeUsers, totalRooms, federationStatus] = await Promise.all([
      db.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM users WHERE last_seen_ts > ?')
        .bind(Date.now() - 24 * 60 * 60 * 1000).first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM rooms').first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM servers WHERE last_successful_fetch > ?')
        .bind(Date.now() - 3600000).first<{ count: number }>()
    ]);

    return c.json({
      totalUsers: totalUsers?.count || 0,
      activeUsers: activeUsers?.count || 0,
      totalRooms: totalRooms?.count || 0,
      federationOk: (federationStatus?.count || 0) > 0
    });
  } catch (error) {
    console.error('Failed to fetch admin stats:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

// User management endpoints
adminAuthApi.get('/api/users', requireAdminAuth, async (c) => {
  const db = c.env.DB;
  const users = await db.prepare(
    `SELECT user_id, display_name, admin, is_deactivated, created_at 
     FROM users ORDER BY created_at DESC LIMIT 100`
  ).all();
  return c.json({ users: users.results });
});

adminAuthApi.post('/api/users', requireAdminAuth, async (c) => {
  const db = c.env.DB;
  const { username, password, admin } = await c.req.json();
  
  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  const userId = `@${username}:${c.env.SERVER_NAME}`;
  const passwordHash = await hashPassword(password);
  
  try {
    await db.prepare(
      `INSERT INTO users (user_id, localpart, password_hash, admin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      userId,
      username,
      passwordHash,
      admin ? 1 : 0,
      Date.now(),
      Date.now()
    ).run();

    return c.json({ success: true, user_id: userId });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return c.json({ error: 'Username already exists' }, 409);
    }
    throw error;
  }
});

export default adminAuthApi;