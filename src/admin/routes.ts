// src/admin/routes.ts
import type { Env } from '../types';
import { getUserById } from '../services/database';

export async function ensureAdminUser(env: Env) {
  const adminUserId = `@admin:${env.SERVER_NAME}`;
  const existing = await getUserById(env.DB, adminUserId);
  if (!existing) {
    const passwordHash = env.ADMIN_PASSWORD_HASH;
    if (!passwordHash) {
      console.error('ADMIN_PASSWORD_HASH secret not set');
      return;
    }
    await env.DB.prepare(
      `INSERT INTO users (user_id, localpart, password_hash, admin, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`
    ).bind(adminUserId, 'admin', passwordHash, Date.now(), Date.now()).run();
    console.log('Created default admin user');
  }
}
