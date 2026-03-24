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

// Export dashboard HTML generator
export { adminDashboardHtml };

// Export types for use elsewhere
export * from './types';