// src/consumers/federation-consumer.ts
// Helper functions for federation queue processing (no direct export)

import type { Env } from '../types';
import { signJson } from '../utils/crypto';

export interface FederationBatch {
  pdus: Record<string, unknown>[];
  edus: Array<{ edu_type: string; content: Record<string, unknown> }>;
}

export async function sendFederationTransaction(
  env: Env,
  destination: string,
  data: FederationBatch
): Promise<boolean> {
  const txnId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Get signing key
  const signingKey = await env.DB.prepare(
    `SELECT key_id, private_key_jwk FROM server_keys WHERE is_current = 1 AND key_version = 2`
  ).first<{ key_id: string; private_key_jwk: string | null }>();

  let body: Record<string, unknown> = {
    pdus: data.pdus,
    edus: data.edus,
    origin: env.SERVER_NAME,
    origin_server_ts: Date.now(),
  };

  // Sign the transaction if we have a key
  if (signingKey?.private_key_jwk) {
    body = await signJson(
      body,
      env.SERVER_NAME,
      signingKey.key_id,
      JSON.parse(signingKey.private_key_jwk)
    );
  }

  try {
    const response = await fetch(
      `https://${destination}/_matrix/federation/v1/send/${txnId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    return response.ok;
  } catch (err) {
    console.error(`[federation-consumer] Failed to send to ${destination}:`, err);
    return false;
  }
}