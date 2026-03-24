// Statistics endpoints

import { Hono } from 'hono';
import type { ServerStats } from '../types';
import { requireAdminAuth } from '../auth';

const statsApi = new Hono();

// GET /api/stats - Server statistics
statsApi.get('/stats', requireAdminAuth, async (c) => {
  const db = c.env.DB;
  
  try {
    const results = await Promise.allSettled([
      db.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM users WHERE last_seen_ts > ?')
        .bind(Date.now() - 24 * 60 * 60 * 1000).first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM rooms').first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM servers').first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM server_keys WHERE is_current = 1').first<{ count: number }>()
    ]);

    const totalUsers = results[0].status === 'fulfilled' ? results[0].value?.count || 0 : 0;
    const activeUsers = results[1].status === 'fulfilled' ? results[1].value?.count || 0 : 0;
    const totalRooms = results[2].status === 'fulfilled' ? results[2].value?.count || 0 : 0;
    const knownServers = results[3].status === 'fulfilled' ? results[3].value?.count || 0 : 0;
    const hasSigningKeys = results[4].status === 'fulfilled' && (results[4].value?.count || 0) > 0;

    return c.json<ServerStats>({
      totalUsers,
      activeUsers,
      totalRooms,
      federationOk: hasSigningKeys,
      knownServers
    });
  } catch (error) {
    console.error('Failed to fetch admin stats:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

// GET /api/stats/history - Time-series statistics
statsApi.get('/stats/history', requireAdminAuth, async (c) => {
  const db = c.env.DB;
  const period = c.req.query('period') || '7d';

  const days = period === '30d' ? 30 : 7;
  const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

  // Generate date keys for the period
  const dateKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dateKeys.push(date.toISOString().split('T')[0]);
  }

  // Query events by day
  const eventsQuery = await db.prepare(`
    SELECT DATE(origin_server_ts / 1000, 'unixepoch') as date, COUNT(*) as count
    FROM events
    WHERE origin_server_ts >= ?
    GROUP BY DATE(origin_server_ts / 1000, 'unixepoch')
    ORDER BY date
  `).bind(startTime).all<{ date: string; count: number }>();

  // Query registrations by day
  const registrationsQuery = await db.prepare(`
    SELECT DATE(created_at / 1000, 'unixepoch') as date, COUNT(*) as count
    FROM users
    WHERE created_at >= ?
    GROUP BY DATE(created_at / 1000, 'unixepoch')
    ORDER BY date
  `).bind(startTime).all<{ date: string; count: number }>();

  const eventsMap = new Map(eventsQuery.results.map(r => [r.date, r.count]));
  const registrationsMap = new Map(registrationsQuery.results.map(r => [r.date, r.count]));

  const data = dateKeys.map(date => ({
    date,
    events: eventsMap.get(date) || 0,
    registrations: registrationsMap.get(date) || 0,
  }));

  return c.json({ period, data });
});

export { statsApi };