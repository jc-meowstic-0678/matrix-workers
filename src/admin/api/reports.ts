// Reports management endpoints

import { Hono } from 'hono';
import type { Report, PaginatedResponse } from '../types';
import { requireAdminAuth } from '../auth';

const reportsApi = new Hono();

// GET /api/reports - List reports
reportsApi.get('/reports', requireAdminAuth, async (c) => {
  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = parseInt(c.req.query('offset') || '0');
  const resolved = c.req.query('resolved');

  let query = `
    SELECT cr.*, e.sender as reported_user_id, e.event_type, e.content
    FROM content_reports cr
    LEFT JOIN events e ON cr.event_id = e.event_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (resolved === 'true') {
    query += ` AND cr.resolved = 1`;
  } else if (resolved === 'false') {
    query += ` AND cr.resolved = 0`;
  }

  query += ` ORDER BY cr.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const reports = await db.prepare(query).bind(...params).all<Report>();

  let countQuery = 'SELECT COUNT(*) as count FROM content_reports WHERE 1=1';
  if (resolved === 'true') {
    countQuery += ` AND resolved = 1`;
  } else if (resolved === 'false') {
    countQuery += ` AND resolved = 0`;
  }
  const total = await db.prepare(countQuery).first<{ count: number }>();

  return c.json<PaginatedResponse<Report>>({
    items: reports.results,
    total: total?.count || 0,
    limit,
    offset,
    next_offset: offset + limit < (total?.count || 0) ? offset + limit : undefined,
  });
});

// GET /api/reports/unresolved/count - Get unresolved count
reportsApi.get('/reports/unresolved/count', requireAdminAuth, async (c) => {
  const db = c.env.DB;

  const result = await db.prepare(
    'SELECT COUNT(*) as count FROM content_reports WHERE resolved = 0'
  ).first<{ count: number }>();

  return c.json({ count: result?.count || 0 });
});

// GET /api/reports/:reportId - Get specific report
reportsApi.get('/reports/:reportId', requireAdminAuth, async (c) => {
  const reportId = c.req.param('reportId');
  const db = c.env.DB;

  const report = await db.prepare(`
    SELECT cr.*, e.sender as reported_user_id, e.event_type, e.content
    FROM content_reports cr
    LEFT JOIN events e ON cr.event_id = e.event_id
    WHERE cr.id = ?
  `).bind(parseInt(reportId)).first<Report>();

  if (!report) {
    return c.json({ error: 'Report not found' }, 404);
  }

  return c.json(report);
});

// POST /api/reports/:reportId/resolve - Resolve report
reportsApi.post('/reports/:reportId/resolve', requireAdminAuth, async (c) => {
  const userId = c.get('userId');
  const reportId = c.req.param('reportId');
  const db = c.env.DB;

  let body: { note?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    // Body optional
  }

  const result = await db.prepare(`
    UPDATE content_reports
    SET resolved = 1, resolved_by = ?, resolved_at = ?, resolution_note = ?
    WHERE id = ?
  `).bind(userId, Date.now(), body.note || null, parseInt(reportId)).run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Report not found' }, 404);
  }

  return c.json({ success: true });
});

// POST /api/reports/:reportId/unresolve - Unresolve report
reportsApi.post('/reports/:reportId/unresolve', requireAdminAuth, async (c) => {
  const reportId = c.req.param('reportId');
  const db = c.env.DB;

  const result = await db.prepare(`
    UPDATE content_reports
    SET resolved = 0, resolved_by = NULL, resolved_at = NULL, resolution_note = NULL
    WHERE id = ?
  `).bind(parseInt(reportId)).run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Report not found' }, 404);
  }

  return c.json({ success: true });
});

export { reportsApi };