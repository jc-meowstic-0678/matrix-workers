// Server settings endpoints

import { Hono } from 'hono';
import { requireAdminAuth } from '../auth';

const settingsApi = new Hono();

// GET /api/settings - Get server settings
settingsApi.get('/settings', requireAdminAuth, async (c) => {
  const db = c.env.DB;

  const config = await db.prepare(
    'SELECT key, value FROM server_config'
  ).all<{ key: string; value: string }>();

  const settings: Record<string, any> = {
    server_name: c.env.SERVER_NAME,
    version: c.env.SERVER_VERSION,
  };

  for (const row of config.results) {
    if (row.key === 'registration_enabled') {
      settings.registration_enabled = row.value === 'true';
    } else {
      settings[row.key] = row.value;
    }
  }

  return c.json(settings);
});

// PUT /api/settings/:key - Update setting
settingsApi.put('/settings/:key', requireAdminAuth, async (c) => {
  const key = c.req.param('key');
  const db = c.env.DB;

  let body: { value: any };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  if (body.value === undefined) {
    return c.json({ error: 'Missing value' }, 400);
  }

  const stringValue = typeof body.value === 'boolean' 
    ? String(body.value) 
    : typeof body.value === 'object' 
      ? JSON.stringify(body.value) 
      : String(body.value);

  await db.prepare(`
    INSERT INTO server_config (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT (key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).bind(key, stringValue, Date.now()).run();

  return c.json({ success: true });
});

// GET /api/settings/features - Get feature flags
settingsApi.get('/settings/features', requireAdminAuth, async (c) => {
  return c.json({
    features: {
      registration: true,
      federation: true,
      media_upload: true,
      voip: true,
      e2ee: true,
      push: true,
    },
  });
});

export { settingsApi };