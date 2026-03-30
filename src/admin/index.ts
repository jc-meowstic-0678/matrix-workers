// Main admin module exports

import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { handleAdminLogin, handleAdminLogout, handleAdminStatus, requireAdminAuth } from './auth';
import { statsApi } from './api/stats';
import { usersApi } from './api/users';
import { roomsApi } from './api/rooms';
import { federationApi } from './api/federation';
import { mediaApi } from './api/media';
import { reportsApi } from './api/reports';
import { securityApi } from './api/security';
import { settingsApi } from './api/settings';
import { adminDashboardHtml } from './ui/dashboard.html.js';
import { getUserById } from '../services/database';
import { Errors } from '../utils/errors';
import { generateOpaqueId } from '../utils/ids';
import { encryptSecret } from '../api/oidc-auth';
import { fetchOIDCDiscovery } from '../services/oidc';

// Create admin API router
export const adminApi = new Hono<AppEnv>();

// Public endpoints (must be before protected middleware)
adminApi.post('/api/login', handleAdminLogin);
adminApi.get('/api/status', handleAdminStatus);

// Mount API modules first (they have their own auth)
adminApi.route('/api', statsApi);
adminApi.route('/api', usersApi);
adminApi.route('/api', roomsApi);
adminApi.route('/api', federationApi);
adminApi.route('/api', mediaApi);
adminApi.route('/api', reportsApi);
adminApi.route('/api', securityApi);
adminApi.route('/api', settingsApi);

// Protected endpoints (after modules to avoid double-auth)
adminApi.post('/api/logout', requireAdminAuth, handleAdminLogout);

// IdP Providers API (mounted at /api/idp/providers)
const idpApi = new Hono<AppEnv>();

idpApi.get('/providers', requireAdminAuth, async (c) => {
  const db = c.env.DB;
  const result = await db.prepare(`
    SELECT id, name, issuer_url, client_id, scopes, enabled, auto_create_users,
           username_claim, display_order, icon_url, created_at, updated_at
    FROM idp_providers
    ORDER BY display_order ASC, name ASC
  `).all();
  const providers = await Promise.all(result.results.map(async (p: any) => {
    const countResult = await db.prepare(`SELECT COUNT(*) as count FROM idp_user_links WHERE provider_id = ?`).bind(p.id).first<{ count: number }>();
    return { ...p, enabled: p.enabled === 1, auto_create_users: p.auto_create_users === 1, linked_users: countResult?.count || 0 };
  }));
  return c.json({ providers });
});

idpApi.post('/providers', requireAdminAuth, async (c) => {
  const db = c.env.DB;
  let body: any;
  try { body = await c.req.json(); } catch { return Errors.badJson().toResponse(); }
  const { name, issuer_url, client_id, client_secret, scopes, auto_create_users, username_claim, icon_url } = body;
  if (!name || !issuer_url || !client_id || !client_secret) return Errors.missingParam('name, issuer_url, client_id, and client_secret are required').toResponse();
  try { await fetchOIDCDiscovery(issuer_url); } catch (err) { return c.json({ errcode: 'M_INVALID_PARAM', error: `Failed to fetch OIDC discovery: ${err}` }, 400); }
  const id = await generateOpaqueId(12);
  const encryptedSecret = await encryptSecret(client_secret, c.env);
  await db.prepare(`INSERT INTO idp_providers (id, name, issuer_url, client_id, client_secret_encrypted, scopes, enabled, auto_create_users, username_claim, icon_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`).bind(id, name, issuer_url.replace(/\/$/, ''), client_id, encryptedSecret, scopes || 'openid profile email', auto_create_users !== false ? 1 : 0, username_claim || 'email', icon_url || null, Date.now(), Date.now()).run();
  return c.json({ id, name, issuer_url, client_id, scopes: scopes || 'openid profile email', enabled: true, auto_create_users: auto_create_users !== false, username_claim: username_claim || 'email', icon_url: icon_url || null });
});

idpApi.get('/providers/:id', requireAdminAuth, async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  const p = await db.prepare(`SELECT id, name, issuer_url, client_id, scopes, enabled, auto_create_users, username_claim, display_order, icon_url, created_at, updated_at FROM idp_providers WHERE id = ?`).bind(id).first();
  if (!p) return Errors.notFound('Provider not found').toResponse();
  const countResult = await db.prepare(`SELECT COUNT(*) as count FROM idp_user_links WHERE provider_id = ?`).bind(id).first<{ count: number }>();
  return c.json({ ...p, enabled: p.enabled === 1, auto_create_users: p.auto_create_users === 1, linked_users: countResult?.count || 0 });
});

idpApi.put('/providers/:id', requireAdminAuth, async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  const existing = await db.prepare('SELECT id FROM idp_providers WHERE id = ?').bind(id).first();
  if (!existing) return Errors.notFound('Provider not found').toResponse();
  let body: any;
  try { body = await c.req.json(); } catch { return Errors.badJson().toResponse(); }
  const { name, issuer_url, client_id, client_secret, scopes, auto_create_users, username_claim, icon_url, enabled } = body;
  const updates: string[] = []; const values: any[] = [];
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (issuer_url !== undefined) { updates.push('issuer_url = ?'); values.push(issuer_url.replace(/\/$/, '')); }
  if (client_id !== undefined) { updates.push('client_id = ?'); values.push(client_id); }
  if (client_secret) { updates.push('client_secret_encrypted = ?'); values.push(await encryptSecret(client_secret, c.env)); }
  if (scopes !== undefined) { updates.push('scopes = ?'); values.push(scopes); }
  if (auto_create_users !== undefined) { updates.push('auto_create_users = ?'); values.push(auto_create_users ? 1 : 0); }
  if (username_claim !== undefined) { updates.push('username_claim = ?'); values.push(username_claim); }
  if (icon_url !== undefined) { updates.push('icon_url = ?'); values.push(icon_url || null); }
  if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }
  updates.push('updated_at = ?'); values.push(Date.now());
  values.push(id);
  await db.prepare(`UPDATE idp_providers SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  return c.json({ id, success: true });
});

idpApi.delete('/providers/:id', requireAdminAuth, async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  const existing = await db.prepare('SELECT id FROM idp_providers WHERE id = ?').bind(id).first();
  if (!existing) return Errors.notFound('Provider not found').toResponse();
  await db.prepare('DELETE FROM idp_providers WHERE id = ?').bind(id).run();
  return c.json({ id, success: true });
});

idpApi.post('/providers/:id/test', requireAdminAuth, async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  const p = await db.prepare('SELECT issuer_url FROM idp_providers WHERE id = ?').bind(id).first<{ issuer_url: string }>();
  if (!p) return Errors.notFound('Provider not found').toResponse();
  try { await fetchOIDCDiscovery(p.issuer_url); return c.json({ success: true, message: 'Connection successful' }); }
  catch (err) { return c.json({ success: false, message: `Connection failed: ${err}` }, 400); }
});

adminApi.route('/api/idp', idpApi);

// Export dashboard HTML generator
export { adminDashboardHtml };

// Export types for use elsewhere
export * from './types';