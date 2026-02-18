// src/consumers/federation-consumer.ts
// Update to handle MessageBatch interface

import type { Env } from '../types';
import { signJson } from '../utils/crypto';

interface FederationQueueMessage {
  destination: string;
  pdu?: Record<string, unknown>;
  edu?: { edu_type: string; content: Record<string, unknown> };
  timestamp: number;
}

interface FederationBatch {
  pdus: Record<string, unknown>[];
  edus: Array<{ edu_type: string; content: Record<string, unknown> }>;
}

export async function handleFederationQueue(
  batch: { messages: Array<{ body: FederationQueueMessage; attempts: number; retry: (options?: any) => void; ack: () => void }> },
  env: Env
): Promise<void> {
  // Group messages by destination
  const byDestination = new Map<string, FederationBatch>();

  for (const message of batch.messages) {
    const { destination, pdu, edu } = message.body;
    if (!byDestination.has(destination)) {
      byDestination.set(destination, { pdus: [], edus: [] });
    }
    const group = byDestination.get(destination)!;
    if (pdu) group.pdus.push(pdu);
    if (edu) group.edus.push(edu);
  }

  // Send transactions to each destination
  const results = await Promise.allSettled(
    Array.from(byDestination.entries()).map(async ([destination, data]) => {
      return sendFederationTransaction(env, destination, data);
    })
  );

  // Handle results for each destination
  let index = 0;
  for (const [destination, data] of byDestination.entries()) {
    const result = results[index++];
    
    // Find all messages for this destination
    const destinationMessages = batch.messages.filter(m => m.body.destination === destination);
    
    if (result.status === 'fulfilled' && result.value) {
      // Success - acknowledge all messages for this destination
      destinationMessages.forEach(m => m.ack());
      console.log(`[federation-consumer] Successfully sent to ${destination}`);
    } else {
      // Failure - retry with exponential backoff
      console.error(`[federation-consumer] Failed to send to ${destination}`);
      
      for (const message of destinationMessages) {
        if (message.attempts < 5) {
          // Retry with exponential backoff: 1min, 2min, 4min, 8min, 16min
          const delaySeconds = Math.pow(2, message.attempts) * 60;
          message.retry({ delaySeconds });
        } else {
          // Give up after 5 attempts
          console.error(`[federation-consumer] Max retries exceeded for ${destination}, message ${message.body.pdu?.event_id || 'EDU'}`);
          message.ack(); // Acknowledge to remove from queue
        }
      }
    }
  }
}

async function sendFederationTransaction(
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