// src/consumers/federation-consumer.ts
// Helper functions for federation queue processing (no direct export)

import type { Env } from '../types';
import { signJson } from '../utils/crypto';

export interface FederationBatch {
  pdus: Record<string, unknown>[];
  edus: Array<{ edu_type: string; content: Record<string, unknown> }>;
}

function buildAuthorizationHeader(
  origin: string,
  destination: string,
  keyId: string,
  signature: string
): string {
  return `X-Matrix origin=${origin},destination=${destination},key=${keyId},sig=${signature}`;
}

export async function sendFederationTransaction(
  env: Env,
  destination: string,
  data: FederationBatch
): Promise<boolean> {
  const txnId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const uri = `/_matrix/federation/v1/send/${txnId}`;

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
  let authHeader: string | null = null;
  if (signingKey?.private_key_jwk) {
    // Build the request object that will be signed (per Matrix spec)
    const requestToSign = {
      method: 'PUT',
      uri: uri,
      origin: env.SERVER_NAME,
      destination: destination,
    };

    // Sign the request
    const signedRequest = await signJson(
      requestToSign,
      env.SERVER_NAME,
      signingKey.key_id,
      JSON.parse(signingKey.private_key_jwk)
    );

    // Extract the signature
    const signatures = signedRequest.signatures as Record<string, Record<string, string>>;
    const signature = signatures?.[env.SERVER_NAME]?.[signingKey.key_id];

    if (signature) {
      authHeader = buildAuthorizationHeader(
        env.SERVER_NAME,
        destination,
        signingKey.key_id,
        signature
      );
    }

    // Also add signature to body
    body = await signJson(
      body,
      env.SERVER_NAME,
      signingKey.key_id,
      JSON.parse(signingKey.private_key_jwk)
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  try {
    const response = await fetch(
      `https://${destination}${uri}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      console.error(`[federation-consumer] Non-200 response from ${destination}: ${response.status}`);
    }

    return response.ok;
  } catch (err) {
    console.error(`[federation-consumer] Failed to send to ${destination}:`, err);
    return false;
  }
}