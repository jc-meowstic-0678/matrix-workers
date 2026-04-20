// Room management endpoints

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import type { Room, PaginatedResponse, CreateRoomRequest } from '../types';
import { requireAdminAuth } from '../auth';
import { generateRoomId } from '../../utils/ids';
import { createRoom, createRoomAlias } from '../../services/database';

type AdminApiEnv = { Bindings: Env; Variables: Variables };

const roomsApi = new Hono<AdminApiEnv>();

// GET /api/rooms - List rooms
roomsApi.get('/rooms', requireAdminAuth, async (c) => {
  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10) || 50, 100);
  const offset = Math.max(parseInt(c.req.query('offset') || '0', 10) || 0, 0);
  const search = c.req.query('search');

  let query = `
    SELECT r.room_id, r.room_version, r.is_public, r.creator_id, r.created_at,
           (SELECT COUNT(*) FROM room_memberships WHERE room_id = r.room_id AND membership = 'join') as member_count,
           (SELECT COUNT(*) FROM events WHERE room_id = r.room_id) as event_count
    FROM rooms r
  `;
  const params: any[] = [];

  if (search) {
    query += ` WHERE r.room_id LIKE ?`;
    params.push(`%${search}%`);
  }

  query += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rooms = await db.prepare(query).bind(...params).all<Room>();

  // Get room names
  const roomsWithNames = await Promise.all(rooms.results.map(async (room) => {
    const nameEvent = await db.prepare(`
      SELECT e.content FROM room_state rs
      JOIN events e ON rs.event_id = e.event_id
      WHERE rs.room_id = ? AND rs.event_type = 'm.room.name'
    `).bind(room.room_id).first<{ content: string }>();

    return {
      ...room,
      name: nameEvent ? JSON.parse(nameEvent.content).name : null,
    };
  }));

  const total = await db.prepare('SELECT COUNT(*) as count FROM rooms').first<{ count: number }>();

  return c.json<PaginatedResponse<Room>>({
    items: roomsWithNames,
    total: total?.count || 0,
    limit,
    offset,
    next_offset: offset + limit < (total?.count || 0) ? offset + limit : undefined,
  });
});

// POST /api/rooms/create - Create room
roomsApi.post('/rooms/create', requireAdminAuth, async (c) => {
  const db = c.env.DB;
  const userId = c.get('userId');
  const body = await c.req.json<CreateRoomRequest>();

  const roomId = await generateRoomId(c.env.SERVER_NAME);
  const isPublic = body.preset === 'public_chat';

  await createRoom(db, roomId, '10', userId, isPublic);

  // Create room events - import database helpers
  const { storeEvent, updateMembership } = await import('../../services/database');
  const { generateEventId } = await import('../../utils/ids');
  const { calculateContentHash } = await import('../../utils/crypto');

  const hash1 = await calculateContentHash({ event_id: '', room_id: roomId, sender: userId } as Record<string, unknown>);
  const eventId1 = await generateEventId(c.env.SERVER_NAME);
  const now = Date.now();
  const createEvent = {
    event_id: eventId1,
    room_id: roomId,
    sender: userId,
    type: 'm.room.create',
    state_key: '',
    content: { creator: userId, room_version: '10' },
    origin_server_ts: now,
    depth: 0,
    auth_events: [],
    prev_events: [],
    hashes: { sha256: hash1 } as { sha256: string },
  };
  await storeEvent(db, createEvent as any);

  const hash2 = await calculateContentHash({ event_id: '', room_id: roomId, sender: userId } as Record<string, unknown>);
  const eventId2 = await generateEventId(c.env.SERVER_NAME);
  const memberEvent = {
    event_id: eventId2,
    room_id: roomId,
    sender: userId,
    type: 'm.room.member',
    state_key: userId,
    content: { membership: 'join' },
    origin_server_ts: now + 1,
    depth: 1,
    auth_events: [[eventId1, hash1]],
    prev_events: [[eventId1, hash1]],
    hashes: { sha256: hash2 } as { sha256: string },
  };
  await storeEvent(db, memberEvent as any);
  await updateMembership(db, roomId, userId, 'join', eventId2);

  const hash3 = await calculateContentHash({ event_id: '', room_id: roomId, sender: userId } as Record<string, unknown>);
  const eventId3 = await generateEventId(c.env.SERVER_NAME);
  const powerLevelsEvent = {
    event_id: eventId3,
    room_id: roomId,
    sender: userId,
    type: 'm.room.power_levels',
    state_key: '',
    content: {
      ban: 50, kick: 50, invite: 50, redact: 50, users_default: 0,
      users: { [userId]: 100 }, events: {}, events_default: 0, state_default: 50
    },
    origin_server_ts: now + 2,
    depth: 2,
    auth_events: [[eventId1, hash1], [eventId2, hash2]],
    prev_events: [[eventId2, hash2]],
    hashes: { sha256: hash3 } as { sha256: string },
  };
  await storeEvent(db, powerLevelsEvent as any);

  if (body.room_alias_local_part) {
    const alias = `#${body.room_alias_local_part}:${c.env.SERVER_NAME}`;
    await createRoomAlias(db, alias, roomId, userId);
  }

  return c.json({ success: true, room_id: roomId });
});

// GET /api/rooms/:roomId - Get room details
roomsApi.get('/rooms/:roomId', requireAdminAuth, async (c) => {
  const roomId = decodeURIComponent(c.req.param('roomId') || '');
  const db = c.env.DB;

  const room = await db.prepare(`
    SELECT room_id, room_version, is_public, creator_id, created_at
    FROM rooms WHERE room_id = ?
  `).bind(roomId).first<Room>();

  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  // Get room name
  const nameEvent = await db.prepare(`
    SELECT e.content FROM room_state rs
    JOIN events e ON rs.event_id = e.event_id
    WHERE rs.room_id = ? AND rs.event_type = 'm.room.name'
  `).bind(roomId).first<{ content: string }>();

  // Get room topic
  const topicEvent = await db.prepare(`
    SELECT e.content FROM room_state rs
    JOIN events e ON rs.event_id = e.event_id
    WHERE rs.room_id = ? AND rs.event_type = 'm.room.topic'
  `).bind(roomId).first<{ content: string }>();

  // Get join rules
  const joinRulesEvent = await db.prepare(`
    SELECT e.content FROM room_state rs
    JOIN events e ON rs.event_id = e.event_id
    WHERE rs.room_id = ? AND rs.event_type = 'm.room.join_rules'
  `).bind(roomId).first<{ content: string }>();

  // Get member count
  const memberCount = await db.prepare(`
    SELECT COUNT(*) as count FROM room_memberships WHERE room_id = ? AND membership = 'join'
  `).bind(roomId).first<{ count: number }>();

  // Get aliases
  const aliases = await db.prepare(
    'SELECT alias FROM room_aliases WHERE room_id = ?'
  ).bind(roomId).all<{ alias: string }>();

  return c.json({
    ...room,
    name: nameEvent ? JSON.parse(nameEvent.content).name : null,
    topic: topicEvent ? JSON.parse(topicEvent.content).topic : null,
    join_rule: joinRulesEvent ? JSON.parse(joinRulesEvent.content).join_rule : 'invite',
    member_count: memberCount?.count || 0,
    aliases: aliases.results.map(a => a.alias),
  });
});

// DELETE /api/rooms/:roomId - Delete room
roomsApi.delete('/rooms/:roomId', requireAdminAuth, async (c) => {
  const roomId = decodeURIComponent(c.req.param('roomId') || '');
  const db = c.env.DB;

  await db.prepare('DELETE FROM room_aliases WHERE room_id = ?').bind(roomId).run();
  await db.prepare('DELETE FROM room_memberships WHERE room_id = ?').bind(roomId).run();
  await db.prepare('DELETE FROM room_state WHERE room_id = ?').bind(roomId).run();
  await db.prepare('DELETE FROM events WHERE room_id = ?').bind(roomId).run();
  await db.prepare('DELETE FROM rooms WHERE room_id = ?').bind(roomId).run();

  return c.json({ success: true });
});

export { roomsApi };