// Federation endpoints

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import type { FederationServer } from '../types';
import { requireAdminAuth } from '../auth';

type AdminApiEnv = { Bindings: Env; Variables: Variables };

const federationApi = new Hono<AdminApiEnv>();

// GET /api/federation/status - Get federation status
federationApi.get('/federation/status', requireAdminAuth, async (c) => {
  const db = c.env.DB;
  const serverName = c.env.SERVER_NAME;

  const serversCount = await db.prepare('SELECT COUNT(*) as count FROM servers').first<{ count: number }>();

  return c.json({
    server_name: serverName,
    federation_enabled: true,
    known_servers_count: serversCount?.count || 0,
  });
});

// GET /api/federation/servers - List known servers
federationApi.get('/federation/servers', requireAdminAuth, async (c) => {
  const db = c.env.DB;

  const servers = await db.prepare(`
    SELECT server_name, last_successful_fetch, retry_count
    FROM servers
    ORDER BY last_successful_fetch DESC
  `).all<FederationServer>();

  return c.json({ servers: servers.results });
});

export { federationApi };