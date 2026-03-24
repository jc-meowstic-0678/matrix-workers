// User management endpoints

import { Hono } from 'hono';
import type { User, CreateUserRequest, UpdateUserRequest, ResetPasswordRequest, PaginatedResponse } from '../types';
import { requireAdminAuth } from '../auth';
import { hashPassword } from '../../utils/crypto';
import { formatUserId } from '../../utils/ids';

const usersApi = new Hono();

// GET /api/users - List users
usersApi.get('/users', requireAdminAuth, async (c) => {
  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = parseInt(c.req.query('offset') || '0');
  const search = c.req.query('search');

  let query = `
    SELECT user_id, localpart, display_name, avatar_url, admin, is_deactivated, created_at
    FROM users
  `;
  const params: any[] = [];

  if (search) {
    query += ' WHERE localpart LIKE ? OR display_name LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const users = await db.prepare(query).bind(...params).all<User>();

  let countQuery = 'SELECT COUNT(*) as count FROM users';
  if (search) {
    countQuery += ' WHERE localpart LIKE ? OR display_name LIKE ?';
  }
  const total = search
    ? await db.prepare(countQuery).bind(`%${search}%`, `%${search}%`).first<{ count: number }>()
    : await db.prepare(countQuery).first<{ count: number }>();

  return c.json<PaginatedResponse<User>>({
    items: users.results,
    total: total?.count || 0,
    limit,
    offset,
    next_offset: offset + limit < (total?.count || 0) ? offset + limit : undefined,
  });
});

// POST /api/users - Create user
usersApi.post('/users', requireAdminAuth, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<CreateUserRequest>();
  
  if (!body.username || !body.password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  const userId = formatUserId(body.username, c.env.SERVER_NAME);
  const passwordHash = await hashPassword(body.password);
  
  try {
    await db.prepare(
      `INSERT INTO users (user_id, localpart, password_hash, display_name, admin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      userId,
      body.username,
      passwordHash,
      body.display_name || null,
      body.admin ? 1 : 0,
      Date.now(),
      Date.now()
    ).run();

    return c.json({ success: true, user_id: userId });
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint')) {
      return c.json({ error: 'Username already exists' }, 409);
    }
    throw error;
  }
});

// GET /api/users/:userId - Get user details
usersApi.get('/users/:userId', requireAdminAuth, async (c) => {
  const userId = decodeURIComponent(c.req.param('userId'));
  const db = c.env.DB;

  const user = await db.prepare(`
    SELECT user_id, localpart, display_name, avatar_url, admin, is_deactivated, created_at
    FROM users WHERE user_id = ?
  `).bind(userId).first<User>();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const devices = await db.prepare(
    'SELECT device_id, display_name, last_seen_ts, last_seen_ip FROM devices WHERE user_id = ?'
  ).bind(userId).all();

  const rooms = await db.prepare(`
    SELECT room_id, membership FROM room_memberships WHERE user_id = ?
  `).bind(userId).all();

  return c.json({
    ...user,
    devices: devices.results,
    rooms: rooms.results,
  });
});

// PUT /api/users/:userId - Update user
usersApi.put('/users/:userId', requireAdminAuth, async (c) => {
  const userId = decodeURIComponent(c.req.param('userId'));
  const db = c.env.DB;
  const body = await c.req.json<UpdateUserRequest>();

  const updates: string[] = [];
  const params: any[] = [];

  if (body.display_name !== undefined) {
    updates.push('display_name = ?');
    params.push(body.display_name);
  }
  if (body.admin !== undefined) {
    updates.push('admin = ?');
    params.push(body.admin ? 1 : 0);
  }
  if (body.deactivated !== undefined) {
    updates.push('is_deactivated = ?');
    params.push(body.deactivated ? 1 : 0);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  updates.push('updated_at = ?');
  params.push(Date.now());
  params.push(userId);

  await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`).bind(...params).run();

  return c.json({ success: true });
});

// DELETE /api/users/:userId - Deactivate user
usersApi.delete('/users/:userId', requireAdminAuth, async (c) => {
  const userId = decodeURIComponent(c.req.param('userId'));
  const db = c.env.DB;

  await db.prepare('UPDATE users SET is_deactivated = 1, updated_at = ? WHERE user_id = ?')
    .bind(Date.now(), userId).run();

  await db.prepare('DELETE FROM access_tokens WHERE user_id = ?').bind(userId).run();

  return c.json({ success: true });
});

// POST /api/users/:userId/reset-password - Reset password
usersApi.post('/users/:userId/reset-password', requireAdminAuth, async (c) => {
  const userId = decodeURIComponent(c.req.param('userId'));
  const db = c.env.DB;
  const body = await c.req.json<ResetPasswordRequest>();

  if (!body.password) {
    return c.json({ error: 'Password required' }, 400);
  }

  const passwordHash = await hashPassword(body.password);

  await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE user_id = ?')
    .bind(passwordHash, Date.now(), userId).run();

  await db.prepare('DELETE FROM access_tokens WHERE user_id = ?').bind(userId).run();

  return c.json({ success: true });
});

// POST /api/users/:userId/reactivate - Reactivate user
usersApi.post('/users/:userId/reactivate', requireAdminAuth, async (c) => {
  const userId = decodeURIComponent(c.req.param('userId'));
  const db = c.env.DB;

  await db.prepare('UPDATE users SET is_deactivated = 0, updated_at = ? WHERE user_id = ?')
    .bind(Date.now(), userId).run();

  return c.json({ success: true });
});

// GET /api/users/:userId/sessions - Get user sessions
usersApi.get('/users/:userId/sessions', requireAdminAuth, async (c) => {
  const userId = decodeURIComponent(c.req.param('userId'));
  const db = c.env.DB;

  const sessions = await db.prepare(`
    SELECT token_id as id, device_id, created_at
    FROM access_tokens
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).bind(userId).all();

  return c.json({ sessions: sessions.results });
});

export { usersApi };