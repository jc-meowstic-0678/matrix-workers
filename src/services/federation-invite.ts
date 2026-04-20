// Federation invite utilities for remote server invites

import type { Env } from '../types';
import type { D1Database } from '@cloudflare/workers-types';
import type { PDU } from '../types/matrix';
import { getServerSigningKey, fetchRemoteServerKeys } from './federation-keys';
import { signJson } from '../utils/crypto';
import { getRoomVersion } from './database';

interface InviteResponse {
  event: PDU;
  invite_room_state: PDU[];
}

/**
 * Send an invite to a remote user via federation
 * Uses the Matrix /invite endpoint per spec
 */
export async function sendInviteViaFederation(
  env: Env,
  db: D1Database,
  roomId: string,
  inviteeId: string,
  inviteEvent: PDU,
  remoteServerName: string
): Promise<boolean> {
  try {
    console.log(`[federation-invite] Sending invite to ${inviteeId} on ${remoteServerName}`);

    // Get room version for the invite
    const roomVersion = await getRoomVersion(db, roomId) || '10';

    // Get our signing key
    const signingKey = await getServerSigningKey(db);
    if (!signingKey) {
      console.error('[federation-invite] No signing key found');
      return false;
    }

    // Get remote server's keys for validation (optional, but good practice)
    await fetchRemoteServerKeys(remoteServerName, db, env.CACHE);

    // Get required state for the invite
    const stateEvents = await getRoomStateForInvite(db, roomId);

    // Build the invite request body per Matrix spec
    const inviteRequest = {
      room_version: roomVersion,
      invite_room_state: stateEvents.map(e => ({
        type: e.type,
        state_key: e.state_key,
        content: e.content,
        sender: e.sender,
      })),
      event: {
        event_id: inviteEvent.event_id,
        room_id: inviteEvent.room_id,
        sender: inviteEvent.sender,
        type: inviteEvent.type,
        state_key: inviteEvent.state_key,
        content: inviteEvent.content,
        origin_server_ts: inviteEvent.origin_server_ts,
        depth: inviteEvent.depth,
        prev_events: inviteEvent.prev_events,
        auth_events: inviteEvent.auth_events,
        hashes: inviteEvent.hashes,
      },
    };

    // Sign the invite event with our server key
    const signedEvent: any = await signJson(
      inviteRequest.event as Record<string, unknown>,
      env.SERVER_NAME,
      signingKey.keyId,
      signingKey.privateKeyJwk
    );
    inviteRequest.event = signedEvent;
    
    // Make request to remote server
    const url = `https://${remoteServerName}/_matrix/federation/v2/invite/${encodeURIComponent(roomId)}/${encodeURIComponent(inviteEvent.event_id)}`;

    console.log(`[federation-invite] POST to ${url}`);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(inviteRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[federation-invite] Remote server error: ${response.status} - ${errorText}`);
      return false;
    }

    const result = await response.json() as InviteResponse;

    // Store the response event (signed by remote server)
    if (result.event) {
      await db.prepare(`
        INSERT OR REPLACE INTO events (event_id, room_id, sender, event_type, state_key, content, origin_server_ts, unsigned, depth, auth_events, prev_events, hashes, signatures, stream_ordering)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        result.event.event_id,
        result.event.room_id,
        result.event.sender,
        result.event.type,
        result.event.state_key ?? null,
        JSON.stringify(result.event.content),
        result.event.origin_server_ts,
        result.event.unsigned ? JSON.stringify(result.event.unsigned) : null,
        result.event.depth,
        JSON.stringify(result.event.auth_events),
        JSON.stringify(result.event.prev_events),
        result.event.hashes ? JSON.stringify(result.event.hashes) : null,
        result.event.signatures ? JSON.stringify(result.event.signatures) : null,
        Date.now()
      ).run();

      console.log(`[federation-invite] Stored invite response event ${result.event.event_id}`);
    }

    console.log(`[federation-invite] Successfully sent invite to ${remoteServerName}`);
    return true;
  } catch (error) {
    console.error('[federation-invite] Error:', error);
    return false;
  }
}

/**
 * Get room state events needed for an invite (create, members, power levels, etc.)
 */
async function getRoomStateForInvite(
  db: D1Database,
  roomId: string
): Promise<PDU[]> {
  const events = await db.prepare(`
    SELECT e.event_id, e.room_id, e.sender, e.event_type, e.state_key, e.content, e.depth,
           e.auth_events, e.prev_events, e.hashes, e.signatures, e.origin_server_ts, e.unsigned
    FROM events e
    JOIN room_state rs ON e.event_id = rs.event_id
    WHERE e.room_id = ? AND rs.event_type IN (
      'm.room.create',
      'm.room.member',
      'm.room.power_levels',
      'm.room.canonical_alias',
      'm.room.join_rules',
      'm.room.history_visibility'
    )
    ORDER BY e.depth ASC
  `).bind(roomId).all<{
    event_id: string;
    room_id: string;
    sender: string;
    event_type: string;
    state_key: string | null;
    content: string;
    depth: number;
    auth_events: string;
    prev_events: string;
    hashes: string | null;
    signatures: string | null;
    origin_server_ts: number;
    unsigned: string | null;
  }>();

  return events.results.map(e => ({
    event_id: e.event_id,
    room_id: e.room_id,
    sender: e.sender,
    type: e.event_type,
    state_key: e.state_key ?? '',
    content: JSON.parse(e.content),
    origin_server_ts: e.origin_server_ts,
    depth: e.depth,
    auth_events: JSON.parse(e.auth_events),
    prev_events: JSON.parse(e.prev_events),
    hashes: e.hashes ? JSON.parse(e.hashes) : undefined,
    signatures: e.signatures ? JSON.parse(e.signatures) : undefined,
    unsigned: e.unsigned ? JSON.parse(e.unsigned) : undefined,
  }));
}