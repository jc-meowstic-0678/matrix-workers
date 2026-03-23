// Authentication handlers and middleware

import type { Context } from 'hono';
import type { Env } from '../types';
import type { LoginRequest, LoginResponse, StatusResponse } from './types';
import { verifyPassword } from '../utils/crypto';

// ============================================
// Authentication Functions
// ============================================

/**
 * Verify admin password against stored hash
 * Supports both pre-hashed format ($pbkdf2-sha256$...) and plain text
 */
async function verifyAdminPassword(password: string, env: Env): Promise<boolean> {
  const adminPasswordHash = env.ADMIN_PASSWORD_HASH;
  if (!adminPasswordHash) {
    console.error('ADMIN_PASSWORD_HASH secret not set');
    return false;
  }

  // Check if hash is in proper PBKDF2 format
  if (adminPasswordHash.startsWith('$pbkdf2-sha256$')) {
    return verifyPassword(password, adminPasswordHash);
  }

  // Plain text comparison (for development/testing)
  console.warn('ADMIN_PASSWORD_HASH appears to be plain text - consider using hashed password');
  return adminPasswordHash === password;
}

/**
 * Generate admin session token
 */
async function createAdminSession(env: Env): Promise<string> {
  const token = crypto.randomUUID();
  await env.CACHE.put('admin:session', token, { expirationTtl: 86400 });
  return token;
}

/**
 * Validate admin session token
 */
export async function validateAdminSession(env: Env, token: string): Promise<boolean> {
  const adminToken = await env.CACHE.get('admin:session');
  return adminToken === token;
}

/**
 * Destroy admin session
 */
export async function destroyAdminSession(env: Env): Promise<void> {
  await env.CACHE.delete('admin:session');
}

// ============================================
// Authentication Handlers
// ============================================

/**
 * Admin login endpoint
 */
export async function handleAdminLogin(c: Context): Promise<Response> {
  try {
    const { password } = await c.req.json<LoginRequest>();
    
    if (!password) {
      return c.json<LoginResponse>({ success: false, error: 'Password required' }, 400);
    }

    const isValid = await verifyAdminPassword(password, c.env);
    if (!isValid) {
      return c.json<LoginResponse>({ success: false, error: 'Invalid password' }, 401);
    }

    const token = await createAdminSession(c.env);

    return c.json<LoginResponse>({ 
      success: true, 
      token,
      expires_in: 86400
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return c.json<LoginResponse>({ success: false, error: 'Login failed' }, 500);
  }
}

/**
 * Admin logout endpoint
 */
export async function handleAdminLogout(c: Context): Promise<Response> {
  await destroyAdminSession(c.env);
  return c.json({ success: true });
}

/**
 * Check admin authentication status
 */
export async function handleAdminStatus(c: Context): Promise<Response> {
  const token = await c.env.CACHE.get('admin:session');
  return c.json<StatusResponse>({ 
    authenticated: !!token,
    server_name: c.env.SERVER_NAME 
  });
}

// ============================================
// Authentication Middleware
// ============================================

/**
 * Middleware to require admin authentication
 */
export async function requireAdminAuth(c: Context, next: () => Promise<void>): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const isValid = await validateAdminSession(c.env, token);
  
  if (!isValid) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  await next();
}

/**
 * Optional authentication middleware (sets isAdmin flag if authenticated)
 */
export async function optionalAdminAuth(c: Context, next: () => Promise<void>): Promise<void> {
  const authHeader = c.req.header('Authorization');
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const isValid = await validateAdminSession(c.env, token);
    if (isValid) {
      c.set('isAdmin', true);
    }
  }

  await next();
}