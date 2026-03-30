// Sliding Sync API (MSC3575 & MSC4186)
// Implements both the original sliding sync and simplified sliding sync
// Now with full performance optimizations: parallel processing, caching, connection pooling,
// precomputed lists, streaming responses, and performance monitoring

import { Hono, type Context } from 'hono';
import type { AppEnv } from '../types';
import { Errors } from '../utils/errors';
import { requireAuth } from '../middleware/auth';

// Import optimized sliding sync components
import { OptimizedSlidingSyncHandler, createOptimizedSlidingSyncHandler } from './sliding-sync/optimized-sync';
import { CachedSlidingSyncHandler, createCachedSlidingSyncHandler } from './sliding-sync/caching-strategy';
import { D1ConnectionPool, createConnectionPool } from './sliding-sync/d1-pool';
import { PrecomputedListManager, createPrecomputedListManager } from './sliding-sync/precomputed-lists';
import { SlidingSyncMonitor, createSlidingSyncMonitor } from './sliding-sync/performance-monitor';
import { StreamingSlidingSyncHandler, createStreamingSlidingSyncHandler } from './sliding-sync/streaming-response';

const app = new Hono<AppEnv>();

// Initialize optimized handlers (lazily to avoid initialization before env is available)
let optimizedHandler: OptimizedSlidingSyncHandler;
let cacheHandler: CachedSlidingSyncHandler;
let pool: D1ConnectionPool;
let precomputedManager: PrecomputedListManager;
let monitor: SlidingSyncMonitor;
let streamingHandler: StreamingSlidingSyncHandler;

function getHandlers(c: Context) {
  if (!optimizedHandler) {
    const env = {
      DB: c.env.DB,
      CACHE: c.env.CACHE
    };
    optimizedHandler = createOptimizedSlidingSyncHandler(env);
    cacheHandler = createCachedSlidingSyncHandler(env);
    pool = createConnectionPool(env);
    precomputedManager = createPrecomputedListManager(env);
    monitor = createSlidingSyncMonitor(env);
    streamingHandler = createStreamingSlidingSyncHandler(env);
  }
  return { optimizedHandler, cacheHandler, pool, precomputedManager, monitor, streamingHandler };
}

// ============================================
// Types (re-exported from optimized modules)
// ============================================

export interface SlidingSyncRequest {
  conn_id?: string;
  pos?: string;
  txn_id?: string;
  timeout?: number;
  delta_token?: string;
  lists?: Record<string, SyncListConfig>;
  room_subscriptions?: Record<string, RoomSubscription>;
  unsubscribe_rooms?: string[];
  extensions?: ExtensionsRequest;
  streaming?: boolean; // New: enable streaming mode
}

export interface SyncListConfig {
  ranges?: [number, number][];
  range?: [number, number];
  sort?: string[];
  required_state?: [string, string][];
  timeline_limit?: number;
  filters?: SlidingRoomFilter;
  bump_event_types?: string[];
}

export interface RoomSubscription {
  required_state?: [string, string][];
  timeline_limit?: number;
  include_old_rooms?: {
    timeline_limit?: number;
    required_state?: [string, string][];
  };
}

export interface SlidingRoomFilter {
  is_dm?: boolean;
  spaces?: string[];
  is_encrypted?: boolean;
  is_invite?: boolean;
  is_tombstoned?: boolean;
  room_types?: string[];
  not_room_types?: string[];
  room_name_like?: string;
  tags?: string[];
  not_tags?: string[];
}

export interface ExtensionsRequest {
  to_device?: { enabled?: boolean; since?: string; limit?: number };
  e2ee?: { enabled?: boolean };
  account_data?: { enabled?: boolean; lists?: string[]; rooms?: string[] };
  typing?: { enabled?: boolean; lists?: string[]; rooms?: string[] };
  receipts?: { enabled?: boolean; lists?: string[]; rooms?: string[] };
  presence?: { enabled?: boolean };
}

export interface SlidingSyncResponse {
  pos: string;
  txn_id?: string;
  lists: Record<string, SyncListResult>;
  rooms: Record<string, RoomResult>;
  extensions: ExtensionsResponse;
  delta_token?: string;
}

export interface SyncListResult {
  count: number;
  ops?: RoomListOperation[];
}

export interface RoomListOperation {
  op: 'SYNC' | 'DELETE' | 'INSERT' | 'INVALIDATE';
  range?: [number, number];
  index?: number;
  room_ids?: string[];
  room_id?: string;
}

export interface RoomResult {
  name?: string;
  avatar?: string;
  topic?: string;
  canonical_alias?: string;
  heroes?: StrippedHero[];
  initial?: boolean;
  required_state?: any[];
  timeline?: any[];
  prev_batch?: string;
  limited?: boolean;
  joined_count?: number;
  invited_count?: number;
  notification_count?: number;
  highlight_count?: number;
  num_live?: number;
  timestamp?: number;
  bump_stamp?: number;
  is_dm?: boolean;
  invite_state?: any[];
  knock_state?: any[];
  membership?: string;
}

export interface StrippedHero {
  user_id: string;
  displayname?: string;
  avatar_url?: string;
}

export interface ExtensionsResponse {
  to_device?: { next_batch: string; events: any[] };
  e2ee?: {
    device_lists?: { changed: string[]; left: string[] };
    device_one_time_keys_count?: Record<string, number>;
    device_unused_fallback_key_types?: string[];
  };
  account_data?: { global?: any[]; rooms?: Record<string, any[]> };
  typing?: { rooms?: Record<string, { type: string; content: { user_ids: string[] } }> };
  receipts?: { rooms?: Record<string, any> };
  presence?: { events?: any[] };
}

// Connection state (kept for backward compatibility - unused)
export interface ConnectionState {
  userId: string;
  pos: number;
  lastAccess: number;
  roomStates: Record<string, { lastStreamOrdering: number; sentState: boolean }>;
  listStates: Record<string, { roomIds: string[]; count: number }>;
  roomNotificationCounts?: Record<string, number>;
  roomFullyReadMarkers?: Record<string, string>;
  initialSyncComplete?: boolean;
  roomSentAsRead?: Record<string, boolean>;
}

// ============================================
// Helper Functions (optimized to use new components)
// ============================================

/**
 * POST /_matrix/client/v1/sync
 * Sliding Sync endpoint with performance optimizations
 */
app.post('/v1/sync', requireAuth(), async (c: Context) => {
  const { optimizedHandler, monitor } = getHandlers(c);
  const userId = c.get('userId');
  const deviceId = c.get('deviceId'); //get device id
  const startTime = Date.now();

  try {
    // Check if client requested streaming mode
    const body = await c.req.json().catch(() => ({}));
    const useStreaming = body.streaming === true || c.req.query('stream') === 'true';

    if (useStreaming) {
      // Delegate to streaming handler
      return await streamingHandler.handleSlidingSyncStreaming(c.req.raw, userId, deviceId);
    }

    // Use optimized handler for standard JSON response
    const response = await optimizedHandler.handleSlidingSync(c.req.raw, userId, deviceId);
    
    // Track performance
    const duration = Date.now() - startTime;
    await monitor.trackSyncDuration(userId, duration, Object.keys(body.lists || {}).length);
    
    return response;
  } catch (error) {
    console.error('Sliding sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json(Errors.internal(message), 500);
  }
});

/**
 * GET /_matrix/client/v1/sync
 * Long-polling fallback for clients that don't support POST
 */
app.get('/v1/sync', requireAuth(), async (c: Context) => {
  const { optimizedHandler } = getHandlers(c);
  const userId = c.get('userId');
  const deviceId = c.get('deviceId') || '';
  
  try {
    // Convert GET request to internal POST format
    const url = new URL(c.req.url);
    const since = url.searchParams.get('since');
    const timeout = parseInt(url.searchParams.get('timeout') || '30000');
    
    // Create a synthetic request for the handler
    const request = new Request(c.req.url, {
      method: 'POST',
      headers: c.req.raw.headers,
      body: JSON.stringify({
        pos: since,
        timeout,
        lists: {
          rooms: {
            ranges: [[0, 99]],
            sort: ['by_recency']
          }
        }
      })
    });
    
    return await optimizedHandler.handleSlidingSync(request, userId, deviceId);
  } catch (error) {
    console.error('Sliding sync GET error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json(Errors.internal(message), 500);
  }
});

/**
 * POST /_matrix/client/v1/sync/stream
 * Explicit streaming endpoint (alternative to ?stream=true)
 */
app.post('/v1/sync/stream', requireAuth(), async (c: Context) => {
  const { streamingHandler } = getHandlers(c);
  const userId = c.get('userId');
  const deviceId = c.get('deviceId') || '';
  
  try {
    return await streamingHandler.handleSlidingSyncStreaming(c.req.raw, userId, deviceId);
  } catch (error) {
    console.error('Streaming sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json(Errors.internal(message), 500);
  }
});

/**
 * POST /_matrix/client/v1/sync/precompute
 * Admin endpoint to trigger list precomputation (admin only)
 */
app.post('/v1/sync/precompute', requireAuth(), async (c: Context) => {
  const { precomputedManager } = getHandlers(c);
  const userId = c.get('userId');
  const isAdmin = c.get('isAdmin') || false;
  
  if (!isAdmin) {
    return c.json(Errors.forbidden('Admin access required'), 403);
  }
  
  try {
    const { users } = await c.req.json();
    const targetUsers = users || [userId];
    
    await precomputedManager.batchRefreshUsers(targetUsers);
    
    return c.json({ 
      success: true, 
      users_processed: targetUsers.length 
    });
  } catch (error) {
    console.error('Precompute error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json(Errors.internal(message), 500);
  }
});

/**
 * GET /_matrix/client/v1/sync/health
 * Health check endpoint for monitoring
 */
app.get('/v1/sync/health', async (c: Context) => {
  const { monitor, pool } = getHandlers(c);
  
  try {
    const health = monitor.getHealthStatus();
    const queueStatus = pool.getQueueStatus();
    
    return c.json({
      status: health.status,
      timestamp: Date.now(),
      metrics: {
        ...health.metrics,
        queued_requests: queueStatus.length
      }
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ status: 'degraded', error: errMsg }, 503);
  }
});

/**
 * POST /_matrix/client/v1/sync/invalidate
 * Invalidate cache for a user (for debugging)
 */
app.post('/v1/sync/invalidate', requireAuth(), async (c: Context) => {
  const { cacheHandler, precomputedManager } = getHandlers(c);
  const userId = c.get('userId');
  
  try {
    const { roomIds } = await c.req.json();
    
    if (roomIds && Array.isArray(roomIds)) {
      await cacheHandler.invalidateBulk(userId, roomIds);
    }
    
    await precomputedManager.invalidateUserCache(userId);
    
    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json(Errors.internal(message), 500);
  }
});

// ============================================
// Legacy /sync endpoint (for backward compatibility)
// ============================================

/**
 * GET /_matrix/client/v3/sync
 * Legacy sync endpoint that now uses sliding sync internally
 */
app.get('/v3/sync', requireAuth(), async (c: Context) => {
  const { optimizedHandler } = getHandlers(c);
  const userId = c.get('userId');
  const deviceId = c.get('deviceId') || '';
  
  try {
    const url = new URL(c.req.url);
    const since = url.searchParams.get('since');
    const timeout = parseInt(url.searchParams.get('timeout') || '30000');
    
    // Convert to sliding sync format
    const request = new Request(c.req.url, {
      method: 'POST',
      headers: c.req.raw.headers,
      body: JSON.stringify({
        pos: since,
        timeout,
        lists: {
          rooms: {
            ranges: [[0, 99]],
            sort: ['by_recency']
          }
        }
      })
    });
    
    const response = await optimizedHandler.handleSlidingSync(request, userId, deviceId);
    const data = await response.json() as { pos?: string; lists?: { rooms?: { rooms?: Record<string, unknown> } } };
    
    // Transform sliding sync response to legacy format
    // This is a simplified transformation - real one would be more complex
    return c.json({
      next_batch: data.pos ?? '',
      rooms: {
        join: Object.fromEntries(
          Object.entries(data.lists?.rooms?.rooms || {})
            .map(([id, _room]) => [id, { timeline: { events: [] } }])
        )
      }
    });
  } catch (error) {
    console.error('Legacy sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json(Errors.internal(message), 500);
  }
});

// ============================================
// Debug and Monitoring Endpoints
// ============================================

/**
 * GET /_matrix/client/v1/sync/metrics
 * Get performance metrics (admin only)
 */
app.get('/v1/sync/metrics', requireAuth(), async (c: Context) => {
  const { monitor } = getHandlers(c);
  const isAdmin = c.get('isAdmin') || false;
  
  if (!isAdmin) {
    return c.json(Errors.forbidden('Admin access required'), 403);
  }
  
  try {
    const report = await monitor.generateReport(true);
    const alerts = monitor.getRecentAlerts('warning');
    
    return c.json({
      report,
      alerts,
      instance_id: monitor.getInstanceId()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json(Errors.internal(message), 500);
  }
});

/**
 * POST /_matrix/client/unstable/org.matrix.simplified_msc3575/sync
 * Simplified Sliding Sync (MSC4186) - same as v1/sync but at unstable path
 * Element X uses this endpoint
 */
app.post('/unstable/org.matrix.simplified_msc3575/sync', requireAuth(), async (c: Context) => {
  const { optimizedHandler, monitor, streamingHandler } = getHandlers(c);
  const userId = c.get('userId');
  const deviceId = c.get('deviceId') || '';
  const startTime = Date.now();

  try {
    const body = await c.req.json().catch(() => ({}));
    const useStreaming = body.streaming === true || c.req.query('stream') === 'true';

    if (useStreaming) {
      return await streamingHandler.handleSlidingSyncStreaming(c.req.raw, userId, deviceId);
    }

    const response = await optimizedHandler.handleSlidingSync(c.req.raw, userId, deviceId);
    
    const duration = Date.now() - startTime;
    await monitor.trackSyncDuration(userId, duration, Object.keys(body.lists || {}).length);
    
    return response;
  } catch (error) {
    console.error('Simplified sliding sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json(Errors.internal(message), 500);
  }
});

export default app;