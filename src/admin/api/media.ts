// Media management endpoints

import { Hono } from 'hono';
import type { Media, PaginatedResponse } from '../types';
import { requireAdminAuth } from '../auth';

const mediaApi = new Hono();

// GET /api/media - List media files
mediaApi.get('/media', requireAdminAuth, async (c) => {
  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = parseInt(c.req.query('offset') || '0');

  const media = await db.prepare(`
    SELECT media_id, user_id, content_type, content_length, filename, created_at, quarantined
    FROM media
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all<Media>();

  const total = await db.prepare('SELECT COUNT(*) as count FROM media').first<{ count: number }>();

  return c.json<PaginatedResponse<Media>>({
    items: media.results,
    total: total?.count || 0,
    limit,
    offset,
    next_offset: offset + limit < (total?.count || 0) ? offset + limit : undefined,
  });
});

// GET /api/media/stats - Media statistics
mediaApi.get('/media/stats', requireAdminAuth, async (c) => {
  const db = c.env.DB;

  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total_files,
      SUM(content_length) as total_bytes,
      SUM(CASE WHEN quarantined = 1 THEN 1 ELSE 0 END) as quarantined_count
    FROM media
  `).first<{ total_files: number; total_bytes: number; quarantined_count: number }>();

  return c.json({
    total_files: stats?.total_files || 0,
    total_bytes: stats?.total_bytes || 0,
    quarantined_count: stats?.quarantined_count || 0,
  });
});

// POST /api/media/:mediaId/quarantine - Quarantine media
mediaApi.post('/media/:mediaId/quarantine', requireAdminAuth, async (c) => {
  const mediaId = c.req.param('mediaId');
  const db = c.env.DB;

  const result = await db.prepare(
    'UPDATE media SET quarantined = 1 WHERE media_id = ?'
  ).bind(mediaId).run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Media not found' }, 404);
  }

  return c.json({ success: true });
});

// POST /api/media/:mediaId/unquarantine - Remove from quarantine
mediaApi.post('/media/:mediaId/unquarantine', requireAdminAuth, async (c) => {
  const mediaId = c.req.param('mediaId');
  const db = c.env.DB;

  const result = await db.prepare(
    'UPDATE media SET quarantined = 0 WHERE media_id = ?'
  ).bind(mediaId).run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Media not found' }, 404);
  }

  return c.json({ success: true });
});

// DELETE /api/media/:mediaId - Delete media
mediaApi.delete('/media/:mediaId', requireAdminAuth, async (c) => {
  const mediaId = c.req.param('mediaId');
  const db = c.env.DB;

  // Get media info for R2 deletion
  const media = await db.prepare(
    'SELECT user_id FROM media WHERE media_id = ?'
  ).bind(mediaId).first<{ user_id: string }>();

  if (!media) {
    return c.json({ error: 'Media not found' }, 404);
  }

  // Delete from R2
  await c.env.MEDIA.delete(mediaId);

  // Delete thumbnails
  const thumbnails = await db.prepare(
    'SELECT width, height, method FROM thumbnails WHERE media_id = ?'
  ).bind(mediaId).all<{ width: number; height: number; method: string }>();

  for (const thumb of thumbnails.results) {
    await c.env.MEDIA.delete(`thumb_${mediaId}_${thumb.width}x${thumb.height}_${thumb.method}`);
  }

  // Delete from database
  await db.prepare('DELETE FROM thumbnails WHERE media_id = ?').bind(mediaId).run();
  await db.prepare('DELETE FROM media WHERE media_id = ?').bind(mediaId).run();

  return c.json({ success: true });
});

export { mediaApi };