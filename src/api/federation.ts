// Matrix Server-Server (Federation) API endpoints
// Fully optimized with Durable Objects for E2EE and corrected schema handling

import { Hono } from 'hono';
import type { DurableObjectStub } from '@cloudflare/workers-types';
import type { AppEnv, PDU } from '../types';
import { Errors } from '../utils/errors';
import { generateSigningKeyPair, signJson, sha256, verifySignature, verifyContentHash } from '../utils/crypto';
import { requireFederationAuth } from '../middleware/federation-auth';
import {
  getRemoteKeysWithNotarySignature,
  verifyRemoteSignature,
  type ServerKeyResponse,
} from '../services/federation-keys';
import { validateUrl } from '../utils/url-validator';
import { checkEventAuth } from '../services/event-auth';
import { getRoomState } from '../services/database';
import { resolveState } from '../services/state-resolution';

// Supported room versions (v1-v12 per Matrix Spec v1.17)
const SUPPORTED_ROOM_VERSIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const app = new Hono<AppEnv>();

// GET /_matrix/federation/v1/version - Server version info (unauthenticated)
app.get('/_matrix/federation/v1/version', async (c) => {
  return c.json({
    server: {
      name: 'matrix-worker',
      version: c.env.SERVER_VERSION || '0.1.0',
    },
  });
});

// Apply federation authentication to all other federation v1 endpoints
// Key endpoints (/_matrix/key/*) remain unauthenticated as they are used to establish trust
app.use('/_matrix/federation/v1/*', requireFederationAuth());

// ============================================
// Server Key Endpoints (Critical for Federation)
// ============================================

// GET /_matrix/key/v2/server - Get server signing keys
// FIXED: Correct column name from 'private_key' to match schema
app.get('/_matrix/key/v2/server', async (c) => {
  const serverName = c.env.SERVER_NAME;

  try {
    // Get or create server signing keys - using correct column alias
    let keys = await c.env.DB.prepare(
      `SELECT key_id, public_key, private_key as private_key_jwk, key_version, valid_from, valid_until
       FROM server_keys WHERE is_current = 1 ORDER BY key_version DESC`
    ).all<{
      key_id: string;
      public_key: string;
      private_key_jwk: string | null;
      key_version: number | null;
      valid_from: number;
      valid_until: number | null;
    }>();

    // Check if we need to generate a new secure key
    const hasSecureKey = keys.results.some((k) => k.key_version === 2 && k.private_key_jwk);

    if (keys.results.length === 0 || !hasSecureKey) {
      // Generate new secure signing key with proper Ed25519
      const keyPair = await generateSigningKeyPair();
      const validFrom = Date.now();
      const validUntil = validFrom + 365 * 24 * 60 * 60 * 1000; // 1 year

      // Mark old keys as not current
      await c.env.DB.prepare(`UPDATE server_keys SET is_current = 0`).run();

      // Insert new secure key - note column names match schema
      await c.env.DB.prepare(
        `INSERT INTO server_keys (key_id, public_key, private_key, private_key_jwk, key_version, valid_from, valid_until, is_current)
         VALUES (?, ?, ?, ?, 2, ?, ?, 1)`
      )
        .bind(
          keyPair.keyId,
          keyPair.publicKey,
          JSON.stringify(keyPair.privateKeyJwk), // Store in private_key column
          JSON.stringify(keyPair.privateKeyJwk), // Also store in private_key_jwk for compatibility
          validFrom,
          validUntil
        )
        .run();

      keys = {
        results: [
          {
            key_id: keyPair.keyId,
            public_key: keyPair.publicKey,
            private_key_jwk: JSON.stringify(keyPair.privateKeyJwk),
            key_version: 2,
            valid_from: validFrom,
            valid_until: validUntil,
          },
        ],
        success: true,
        meta: {
          duration: 0,
          size_after: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      };
    }

    const verifyKeys: Record<string, { key: string }> = {};
    for (const key of keys.results) {
      verifyKeys[key.key_id] = { key: key.public_key };
    }

    const validUntilTs = keys.results[0]?.valid_until || Date.now() + 365 * 24 * 60 * 60 * 1000;

    const response = {
      server_name: serverName,
      valid_until_ts: validUntilTs,
      verify_keys: verifyKeys,
      old_verify_keys: {},
    };

    // Sign the response with the secure key
    const currentKey = keys.results.find((k) => k.key_version === 2 && k.private_key_jwk);
    if (currentKey && currentKey.private_key_jwk) {
      const signed = await signJson(
        response,
        serverName,
        currentKey.key_id,
        JSON.parse(currentKey.private_key_jwk)
      );
      return c.json(signed);
    }

    return c.json(response);
  } catch (error) {
    console.error('Error in /_matrix/key/v2/server:', error);
    return c.json({
      errcode: 'M_UNKNOWN',
      error: 'Failed to retrieve server keys',
    }, 500);
  }
});

// GET /_matrix/key/v2/server/:keyId - Get specific key
app.get('/_matrix/key/v2/server/:keyId', async (c) => {
  const keyId = c.req.param('keyId');
  const serverName = c.env.SERVER_NAME;

  try {
    const key = await c.env.DB.prepare(
      `SELECT key_id, public_key, valid_from, valid_until FROM server_keys WHERE key_id = ?`
    ).bind(keyId).first<{ key_id: string; public_key: string; valid_from: number; valid_until: number | null }>();

    if (!key) {
      return Errors.notFound('Key not found').toResponse();
    }

    const response = {
      server_name: serverName,
      valid_until_ts: key.valid_until || (Date.now() + 365 * 24 * 60 * 60 * 1000),
      verify_keys: {
        [key.key_id]: { key: key.public_key },
      },
      old_verify_keys: {},
    };

    return c.json(response);
  } catch (error) {
    console.error('Error in /_matrix/key/v2/server/:keyId:', error);
    return Errors.internal('Failed to retrieve key').toResponse();
  }
});

// ============================================
// Durable Object Helpers for E2EE
// ============================================

// Helper to get UserKeys Durable Object for a user
// FIXED: Proper typing and error handling
function getUserKeysDO(env: AppEnv['Bindings'], userId: string): DurableObjectStub {
  try {
    const id = env.USER_KEYS_DO.idFromName(userId);
    return env.USER_KEYS_DO.get(id);
  } catch (error) {
    console.error(`Failed to get UserKeys DO for ${userId}:`, error);
    throw new Error('User keys service unavailable');
  }
}

// Helper to get device keys from Durable Object (strong consistency)
async function getDeviceKeysFromDO(env: AppEnv['Bindings'], userId: string, deviceId?: string): Promise<any> {
  try {
    const stub = getUserKeysDO(env, userId);
    const url = deviceId
      ? `http://internal/device-keys/get?device_id=${encodeURIComponent(deviceId)}`
      : 'http://internal/device-keys/get';
    const response = await stub.fetch(new Request(url));
    if (!response.ok) {
      return deviceId ? null : {};
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to get device keys from DO for ${userId}:`, error);
    return deviceId ? null : {};
  }
}

// Helper to claim one-time key from Durable Object (atomic operation)
async function claimOneTimeKeyFromDO(env: AppEnv['Bindings'], userId: string, deviceId: string, algorithm: string): Promise<any> {
  try {
    const stub = getUserKeysDO(env, userId);
    const response = await stub.fetch(
      new Request(`http://internal/one-time-keys/claim?device_id=${encodeURIComponent(deviceId)}&algorithm=${encodeURIComponent(algorithm)}`)
    );
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to claim one-time key from DO for ${userId}:`, error);
    return null;
  }
}

// Helper to get cross-signing keys from Durable Object
async function getCrossSigningKeysFromDO(env: AppEnv['Bindings'], userId: string): Promise<{
  master?: any;
  self_signing?: any;
  user_signing?: any;
}> {
  try {
    const stub = getUserKeysDO(env, userId);
    const response = await stub.fetch(new Request('http://internal/cross-signing/get'));
    if (!response.ok) {
      return {};
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to get cross-signing keys from DO for ${userId}:`, error);
    return {};
  }
}

// Helper function to get notary signing key
async function getNotarySigningKey(db: D1Database): Promise<{
  keyId: string;
  privateKeyJwk: JsonWebKey;
} | null> {
  try {
    const key = await db.prepare(
      `SELECT key_id, private_key_jwk FROM server_keys WHERE is_current = 1 AND key_version = 2`
    ).first<{ key_id: string; private_key_jwk: string | null }>();

    if (!key || !key.private_key_jwk) {
      return null;
    }

    return {
      keyId: key.key_id,
      privateKeyJwk: JSON.parse(key.private_key_jwk),
    };
  } catch (error) {
    console.error('Failed to get notary signing key:', error);
    return null;
  }
}

// Helper function to validate server name (prevent SSRF)
function isValidServerName(serverName: string): boolean {
  if (!serverName || serverName.length > 255) {
    return false;
  }
  const testUrl = `https://${serverName}/`;
  const validation = validateUrl(testUrl);
  return validation.valid;
}

// Maximum number of servers in a batch query
const MAX_BATCH_SERVERS = 100;

// ============================================
// Key Query Endpoints (Notary)
// ============================================

// POST /_matrix/key/v2/query - Batch query for server keys (notary endpoint)
app.post('/_matrix/key/v2/query', async (c) => {
  let body: {
    server_keys?: Record<string, Record<string, { minimum_valid_until_ts?: number }>>;
  };

  try {
    body = await c.req.json();
  } catch {
    return Errors.badJson().toResponse();
  }

  const serverKeys = body.server_keys;
  if (!serverKeys || typeof serverKeys !== 'object') {
    return Errors.missingParam('server_keys').toResponse();
  }

  // Check batch size limit
  const serverCount = Object.keys(serverKeys).length;
  if (serverCount > MAX_BATCH_SERVERS) {
    return c.json(
      {
        errcode: 'M_LIMIT_EXCEEDED',
        error: `Too many servers in batch request (max ${MAX_BATCH_SERVERS})`,
      },
      400
    );
  }

  // Get our notary signing key
  const notaryKey = await getNotarySigningKey(c.env.DB);
  if (!notaryKey) {
    return c.json(
      {
        errcode: 'M_UNKNOWN',
        error: 'Server signing key not configured',
      },
      500
    );
  }

  const results: ServerKeyResponse[] = [];

  // Process each server in the request
  for (const [serverName, keyRequests] of Object.entries(serverKeys)) {
    // Validate server name to prevent SSRF
    if (!isValidServerName(serverName)) {
      console.warn(`Invalid server name in key query: ${serverName}`);
      continue;
    }

    // If querying our own server, return our keys directly
    if (serverName === c.env.SERVER_NAME) {
      const ownKeys = await c.env.DB.prepare(
        `SELECT key_id, public_key, valid_until FROM server_keys WHERE is_current = 1`
      ).all<{ key_id: string; public_key: string; valid_until: number | null }>();

      if (ownKeys.results.length > 0) {
        const verifyKeys: Record<string, { key: string }> = {};
        let maxValidUntil = 0;

        for (const key of ownKeys.results) {
          verifyKeys[key.key_id] = { key: key.public_key };
          if (key.valid_until && key.valid_until > maxValidUntil) {
            maxValidUntil = key.valid_until;
          }
        }

        const ownResponse: ServerKeyResponse = {
          server_name: serverName,
          valid_until_ts: maxValidUntil || Date.now() + 365 * 24 * 60 * 60 * 1000,
          verify_keys: verifyKeys,
          old_verify_keys: {},
        };

        // Sign with our own key
        const signed = (await signJson(
          ownResponse,
          c.env.SERVER_NAME,
          notaryKey.keyId,
          notaryKey.privateKeyJwk
        )) as ServerKeyResponse;

        results.push(signed);
      }
      continue;
    }

    // Process each key request for this server
    for (const [keyId, keyRequest] of Object.entries(keyRequests)) {
      const minimumValidUntilTs = keyRequest.minimum_valid_until_ts || 0;

      // Fetch keys with notary signature
      const keyResponses = await getRemoteKeysWithNotarySignature(
        serverName,
        keyId === '' ? null : keyId, // Empty key ID means all keys
        minimumValidUntilTs,
        c.env.DB,
        c.env.CACHE,
        c.env.SERVER_NAME,
        notaryKey.keyId,
        notaryKey.privateKeyJwk
      );

      results.push(...keyResponses);
    }
  }

  return c.json({ server_keys: results });
});

// GET /_matrix/key/v2/query/:serverName - Query all keys for a server
app.get('/_matrix/key/v2/query/:serverName', async (c) => {
  const serverName = c.req.param('serverName');
  const minimumValidUntilTs = parseInt(c.req.query('minimum_valid_until_ts') || '0', 10);

  if (!isValidServerName(serverName)) {
    return c.json(
      {
        errcode: 'M_INVALID_PARAM',
        error: 'Invalid server name',
      },
      400
    );
  }

  const notaryKey = await getNotarySigningKey(c.env.DB);
  if (!notaryKey) {
    return c.json(
      {
        errcode: 'M_UNKNOWN',
        error: 'Server signing key not configured',
      },
      500
    );
  }

  // If querying our own server, return our keys directly
  if (serverName === c.env.SERVER_NAME) {
    const ownKeys = await c.env.DB.prepare(
      `SELECT key_id, public_key, valid_until FROM server_keys WHERE is_current = 1`
    ).all<{ key_id: string; public_key: string; valid_until: number | null }>();

    if (ownKeys.results.length === 0) {
      return Errors.notFound('No keys found').toResponse();
    }

    const verifyKeys: Record<string, { key: string }> = {};
    let maxValidUntil = 0;

    for (const key of ownKeys.results) {
      verifyKeys[key.key_id] = { key: key.public_key };
      if (key.valid_until && key.valid_until > maxValidUntil) {
        maxValidUntil = key.valid_until;
      }
    }

    const ownResponse: ServerKeyResponse = {
      server_name: serverName,
      valid_until_ts: maxValidUntil || Date.now() + 365 * 24 * 60 * 60 * 1000,
      verify_keys: verifyKeys,
      old_verify_keys: {},
    };

    const signed = (await signJson(
      ownResponse,
      c.env.SERVER_NAME,
      notaryKey.keyId,
      notaryKey.privateKeyJwk
    )) as ServerKeyResponse;

    return c.json({ server_keys: [signed] });
  }

  // Fetch keys from remote server with notary signature
  const keyResponses = await getRemoteKeysWithNotarySignature(
    serverName,
    null,
    minimumValidUntilTs,
    c.env.DB,
    c.env.CACHE,
    c.env.SERVER_NAME,
    notaryKey.keyId,
    notaryKey.privateKeyJwk
  );

  if (keyResponses.length === 0) {
    return Errors.notFound('No keys found for server').toResponse();
  }

  return c.json({ server_keys: keyResponses });
});

// GET /_matrix/key/v2/query/:serverName/:keyId - Query specific key for a server
app.get('/_matrix/key/v2/query/:serverName/:keyId', async (c) => {
  const serverName = c.req.param('serverName');
  const keyId = c.req.param('keyId');
  const minimumValidUntilTs = parseInt(c.req.query('minimum_valid_until_ts') || '0', 10);

  if (!isValidServerName(serverName)) {
    return c.json(
      {
        errcode: 'M_INVALID_PARAM',
        error: 'Invalid server name',
      },
      400
    );
  }

  const notaryKey = await getNotarySigningKey(c.env.DB);
  if (!notaryKey) {
    return c.json(
      {
        errcode: 'M_UNKNOWN',
        error: 'Server signing key not configured',
      },
      500
    );
  }

  // If querying our own server, return the specific key
  if (serverName === c.env.SERVER_NAME) {
    const ownKey = await c.env.DB.prepare(
      `SELECT key_id, public_key, valid_until FROM server_keys WHERE key_id = ?`
    ).bind(keyId).first<{ key_id: string; public_key: string; valid_until: number | null }>();

    if (!ownKey) {
      return Errors.notFound('Key not found').toResponse();
    }

    const ownResponse: ServerKeyResponse = {
      server_name: serverName,
      valid_until_ts: ownKey.valid_until || Date.now() + 365 * 24 * 60 * 60 * 1000,
      verify_keys: {
        [ownKey.key_id]: { key: ownKey.public_key },
      },
      old_verify_keys: {},
    };

    const signed = (await signJson(
      ownResponse,
      c.env.SERVER_NAME,
      notaryKey.keyId,
      notaryKey.privateKeyJwk
    )) as ServerKeyResponse;

    return c.json({ server_keys: [signed] });
  }

  const keyResponses = await getRemoteKeysWithNotarySignature(
    serverName,
    keyId,
    minimumValidUntilTs,
    c.env.DB,
    c.env.CACHE,
    c.env.SERVER_NAME,
    notaryKey.keyId,
    notaryKey.privateKeyJwk
  );

  if (keyResponses.length === 0) {
    return Errors.notFound('Key not found').toResponse();
  }

  return c.json({ server_keys: keyResponses });
});

// ============================================
// Federation E2EE Endpoints (Using Durable Objects)
// ============================================

// POST /_matrix/federation/v1/user/keys/query - Query device keys for local users
// FIXED: Uses Durable Objects for strong consistency, no KV fallback
app.post('/_matrix/federation/v1/user/keys/query', async (c) => {
  const serverName = c.env.SERVER_NAME;
  const db = c.env.DB;

  let body: {
    device_keys?: Record<string, string[]>;
  };

  try {
    body = await c.req.json();
  } catch {
    return Errors.badJson().toResponse();
  }

  const requestedKeys = body.device_keys;
  if (!requestedKeys || typeof requestedKeys !== 'object') {
    return Errors.missingParam('device_keys').toResponse();
  }

  const deviceKeys: Record<string, Record<string, any>> = {};
  const masterKeys: Record<string, any> = {};
  const selfSigningKeys: Record<string, any> = {};

  // Helper to merge signatures from D1 into device keys
  async function mergeSignaturesForDevice(userId: string, deviceId: string, deviceKey: any): Promise<any> {
    try {
      const dbSignatures = await db.prepare(`
        SELECT signer_user_id, signer_key_id, signature
        FROM cross_signing_signatures
        WHERE user_id = ? AND key_id = ?
      `).bind(userId, deviceId).all<{
        signer_user_id: string;
        signer_key_id: string;
        signature: string;
      }>();

      if (dbSignatures.results.length > 0) {
        deviceKey.signatures = deviceKey.signatures || {};
        for (const sig of dbSignatures.results) {
          deviceKey.signatures[sig.signer_user_id] = deviceKey.signatures[sig.signer_user_id] || {};
          deviceKey.signatures[sig.signer_user_id][sig.signer_key_id] = sig.signature;
        }
      }
    } catch (error) {
      console.error(`Failed to merge signatures for ${userId}/${deviceId}:`, error);
    }

    return deviceKey;
  }

  for (const [userId, requestedDevices] of Object.entries(requestedKeys)) {
    const userServerName = userId.split(':')[1];
    if (userServerName !== serverName) {
      continue;
    }

    const user = await db.prepare(
      `SELECT user_id FROM users WHERE user_id = ?`
    ).bind(userId).first<{ user_id: string }>();

    if (!user) {
      continue;
    }

    deviceKeys[userId] = {};

    try {
      // Get device keys from Durable Object (strongly consistent)
      if (!requestedDevices || requestedDevices.length === 0) {
        const allDeviceKeys = await getDeviceKeysFromDO(c.env, userId);
        for (const [deviceId, keys] of Object.entries(allDeviceKeys)) {
          if (keys) {
            deviceKeys[userId][deviceId] = await mergeSignaturesForDevice(userId, deviceId, keys);
          }
        }
      } else {
        for (const deviceId of requestedDevices) {
          const keys = await getDeviceKeysFromDO(c.env, userId, deviceId);
          if (keys) {
            deviceKeys[userId][deviceId] = await mergeSignaturesForDevice(userId, deviceId, keys);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to get device keys for ${userId}:`, error);
    }

    // Get cross-signing keys (master + self_signing only for federation)
    try {
      const csKeys = await getCrossSigningKeysFromDO(c.env, userId);
      if (csKeys.master) {
        masterKeys[userId] = csKeys.master;
      }
      if (csKeys.self_signing) {
        selfSigningKeys[userId] = csKeys.self_signing;
      }
    } catch (error) {
      console.error(`Failed to get cross-signing keys for ${userId}:`, error);
    }
  }

  return c.json({
    device_keys: deviceKeys,
    master_keys: masterKeys,
    self_signing_keys: selfSigningKeys,
  });
});

// POST /_matrix/federation/v1/user/keys/claim - Claim one-time keys
// FIXED: Uses Durable Objects for atomic claims, no KV fallback
app.post('/_matrix/federation/v1/user/keys/claim', async (c) => {
  const serverName = c.env.SERVER_NAME;

  let body: {
    one_time_keys?: Record<string, Record<string, string>>;
  };

  try {
    body = await c.req.json();
  } catch {
    return Errors.badJson().toResponse();
  }

  const requestedKeys = body.one_time_keys;
  if (!requestedKeys || typeof requestedKeys !== 'object') {
    return Errors.missingParam('one_time_keys').toResponse();
  }

  const oneTimeKeys: Record<string, Record<string, Record<string, any>>> = {};

  for (const [userId, devices] of Object.entries(requestedKeys)) {
    const userServerName = userId.split(':')[1];
    if (userServerName !== serverName) {
      continue;
    }

    oneTimeKeys[userId] = {};

    for (const [deviceId, algorithm] of Object.entries(devices)) {
      try {
        // Claim one-time key from Durable Object (atomic operation)
        const claimedKey = await claimOneTimeKeyFromDO(c.env, userId, deviceId, algorithm);

        if (claimedKey) {
          oneTimeKeys[userId][deviceId] = {
            [claimedKey.key_id]: claimedKey.key_data,
          };
        } else {
          // Try fallback key as last resort
          const fallback = await c.env.DB.prepare(`
            SELECT key_id, key_data FROM fallback_keys
            WHERE user_id = ? AND device_id = ? AND algorithm = ? AND used = 0
          `).bind(userId, deviceId, algorithm).first<{
            key_id: string;
            key_data: string;
          }>();

          if (fallback) {
            await c.env.DB.prepare(`
              UPDATE fallback_keys SET used = 1 WHERE user_id = ? AND device_id = ? AND algorithm = ?
            `).bind(userId, deviceId, algorithm).run();

            const keyData = JSON.parse(fallback.key_data);
            oneTimeKeys[userId][deviceId] = {
              [fallback.key_id]: {
                ...keyData,
                fallback: true,
              },
            };
          }
        }
      } catch (error) {
        console.error(`Failed to claim one-time key for ${userId}/${deviceId}:`, error);
      }
    }
  }

  return c.json({
    one_time_keys: oneTimeKeys,
  });
});

// GET /_matrix/federation/v1/user/devices/:userId - Get device list for a local user
app.get('/_matrix/federation/v1/user/devices/:userId', async (c) => {
  const serverName = c.env.SERVER_NAME;
  const userId = c.req.param('userId');
  const db = c.env.DB;

  const userServerName = userId.split(':')[1];
  if (userServerName !== serverName) {
    return c.json({
      errcode: 'M_FORBIDDEN',
      error: 'User is not local to this server',
    }, 403);
  }

  const user = await db.prepare(
    `SELECT user_id FROM users WHERE user_id = ?`
  ).bind(userId).first<{ user_id: string }>();

  if (!user) {
    return Errors.notFound('User not found').toResponse();
  }

  try {
    // Get all devices from D1 (for display names)
    const dbDevices = await db.prepare(
      `SELECT device_id, display_name FROM devices WHERE user_id = ?`
    ).bind(userId).all<{ device_id: string; display_name: string | null }>();

    // Get device keys from Durable Object (strongly consistent)
    const allDeviceKeys = await getDeviceKeysFromDO(c.env, userId);

    // Get stream_id for device key changes
    const streamPosition = await db.prepare(
      `SELECT MAX(stream_position) as stream_id FROM device_key_changes WHERE user_id = ?`
    ).bind(userId).first<{ stream_id: number | null }>();

    const devices: Array<{
      device_id: string;
      keys?: any;
      device_display_name?: string;
    }> = [];

    for (const dbDevice of dbDevices.results) {
      const deviceKeys = allDeviceKeys[dbDevice.device_id];
      devices.push({
        device_id: dbDevice.device_id,
        keys: deviceKeys || undefined,
        device_display_name: dbDevice.display_name || undefined,
      });
    }

    const csKeys = await getCrossSigningKeysFromDO(c.env, userId);

    const response: any = {
      user_id: userId,
      stream_id: streamPosition?.stream_id || 0,
      devices,
    };

    if (csKeys.master) {
      response.master_key = csKeys.master;
    }
    if (csKeys.self_signing) {
      response.self_signing_key = csKeys.self_signing;
    }

    return c.json(response);
  } catch (error) {
    console.error(`Failed to get devices for ${userId}:`, error);
    return Errors.internal('Failed to retrieve device list').toResponse();
  }
});

// ============================================
// Remaining federation endpoints (unchanged but included for completeness)
// Note: The rest of your federation.ts file continues here with all other endpoints
// (send, event, state, backfill, make_join, send_join, invite, knock, media, etc.)
// They remain as you originally wrote them - I've only fixed the key endpoints
// ============================================

// [The rest of your federation.ts file continues here...]
// I'm truncating for brevity, but you should keep all your other endpoints exactly as they were

export default app;