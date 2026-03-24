// Federation endpoints

import { Hono } from 'hono';
import type { FederationServer, FederationTest } from '../types';
import { requireAdminAuth } from '../auth';

const federationApi = new Hono();

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

// GET /api/federation/test - Run federation self-tests
federationApi.get('/federation/test', requireAdminAuth, async (c) => {
  const serverName = c.env.SERVER_NAME;
  const tests: FederationTest[] = [];

  // Test .well-known/matrix/server
  try {
    const wellKnownUrl = `https://${serverName}/.well-known/matrix/server`;
    const resp = await fetch(wellKnownUrl);
    if (resp.ok) {
      const data = await resp.json() as any;
      tests.push({
        name: '.well-known/matrix/server',
        passed: true,
        message: `Delegates to ${data['m.server'] || serverName}`,
      });
    } else {
      tests.push({
        name: '.well-known/matrix/server',
        passed: false,
        message: `HTTP ${resp.status}`,
      });
    }
  } catch (e: any) {
    tests.push({
      name: '.well-known/matrix/server',
      passed: false,
      message: e.message || 'Failed to fetch',
    });
  }

  // Test server keys endpoint
  try {
    const keysUrl = `https://${serverName}/_matrix/key/v2/server`;
    const resp = await fetch(keysUrl);
    if (resp.ok) {
      const data = await resp.json() as any;
      const hasSigningKeys = data.verify_keys && Object.keys(data.verify_keys).length > 0;
      tests.push({
        name: 'Server signing keys',
        passed: hasSigningKeys,
        message: hasSigningKeys ? `${Object.keys(data.verify_keys).length} key(s) published` : 'No signing keys found',
      });
    } else {
      tests.push({
        name: 'Server signing keys',
        passed: false,
        message: `HTTP ${resp.status}`,
      });
    }
  } catch (e: any) {
    tests.push({
      name: 'Server signing keys',
      passed: false,
      message: e.message || 'Failed to fetch',
    });
  }

  // Test federation API
  try {
    const versionUrl = `https://${serverName}/_matrix/federation/v1/version`;
    const resp = await fetch(versionUrl);
    if (resp.ok) {
      const data = await resp.json() as any;
      tests.push({
        name: 'Federation API',
        passed: true,
        message: `Server: ${data.server?.name || 'Unknown'} ${data.server?.version || ''}`,
      });
    } else {
      tests.push({
        name: 'Federation API',
        passed: false,
        message: `HTTP ${resp.status}`,
      });
    }
  } catch (e: any) {
    tests.push({
      name: 'Federation API',
      passed: false,
      message: e.message || 'Failed to fetch',
    });
  }

  return c.json({ tests });
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