// src/api/push.ts - Replace the suggested functions with this integrated solution

/**
 * HTTP fallback for push notifications when WebSocket is unavailable
 * This integrates with your existing PushDurableObject and Workflow systems
 */
export async function sendHttpFallbackNotification(
  db: D1Database,
  env: import('../types').Env,
  userId: string,
  roomId: string,
  eventId: string,
  pushResult?: { notify: boolean; actions: any[]; highlight: boolean }
): Promise<boolean> {
  try {
    // Get all pushers for this user (supports multiple devices)
    const pushers = await db.prepare(`
      SELECT pushkey, kind, app_id, app_display_name, data, failure_count
      FROM pushers
      WHERE user_id = ? AND kind = 'http' AND enabled = 1
      ORDER BY failure_count ASC, last_success DESC
    `).bind(userId).all<{
      pushkey: string;
      kind: string;
      app_id: string;
      app_display_name: string;
      data: string;
      failure_count: number;
    }>();

    if (pushers.results.length === 0) {
      return false;
    }

    // Get event details
    const event = await db.prepare(`
      SELECT e.event_id, e.room_id, e.event_type, e.sender, e.content, e.origin_server_ts,
             r.name as room_name,
             m.display_name as sender_display_name
      FROM events e
      LEFT JOIN room_memberships m ON e.room_id = m.room_id AND e.sender = m.user_id
      LEFT JOIN (
        SELECT room_id, content FROM events 
        WHERE event_type = 'm.room.name' AND state_key = ''
        ORDER BY origin_server_ts DESC LIMIT 1
      ) r ON e.room_id = r.room_id
      WHERE e.event_id = ?
    `).bind(eventId).first<{
      event_id: string;
      room_id: string;
      event_type: string;
      sender: string;
      content: string;
      origin_server_ts: number;
      room_name: string | null;
      sender_display_name: string | null;
    }>();

    if (!event) {
      console.error(`[push] Event ${eventId} not found for HTTP fallback`);
      return false;
    }

    // Parse content
    const content = JSON.parse(event.content || '{}');
    
    // Get unread count
    const unreadResult = await db.prepare(`
      SELECT COUNT(*) as count FROM events e
      WHERE e.room_id = ?
        AND e.stream_ordering > COALESCE(
          (SELECT CAST(json_extract(content, '$.event_id') AS TEXT) FROM account_data
           WHERE user_id = ? AND room_id = ? AND event_type = 'm.fully_read'),
          ''
        )
        AND e.sender != ?
        AND e.event_type IN ('m.room.message', 'm.room.encrypted')
    `).bind(roomId, userId, roomId, userId).first<{ count: number }>();

    const unreadCount = unreadResult?.count || 1;

    // Get room member count for context
    const memberCount = await db.prepare(`
      SELECT COUNT(*) as count FROM room_memberships
      WHERE room_id = ? AND membership = 'join'
    `).bind(roomId).first<{ count: number }>();

    // Prepare display names
    const senderDisplayName = event.sender_display_name || 
                             event.sender.split(':')[0].replace('@', '');
    const roomName = event.room_name || 
                    (memberCount?.count === 2 ? senderDisplayName : 'Chat');

    // Try each pusher in order of reliability
    for (const pusher of pushers.results) {
      try {
        let success = false;
        const pusherData = JSON.parse(pusher.data);
        
        // Try direct APNs first for iOS devices
        if (env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_PRIVATE_KEY) {
          const isIOSPusher = pusherData.default_payload?.aps !== undefined;
          if (isIOSPusher) {
            success = await sendDirectAPNsViaDO(env, pusher, {
              event_id: event.event_id,
              room_id: event.room_id,
              type: event.event_type,
              sender: event.sender,
              content,
              origin_server_ts: event.origin_server_ts
            }, senderDisplayName, roomName, unreadCount);
          }
        }

        // Fall back to Sygnal if direct APNs failed or not applicable
        if (!success) {
          success = await sendViaSygnalWithRetry(env, pusher, pusherData, {
            event_id: event.event_id,
            room_id: event.room_id,
            type: event.event_type,
            sender: event.sender,
            content,
            origin_server_ts: event.origin_server_ts
          }, senderDisplayName, roomName, unreadCount, pushResult);
        }

        if (success) {
          // Update pusher success
          await db.prepare(`
            UPDATE pushers SET last_success = ?, failure_count = 0
            WHERE user_id = ? AND pushkey = ? AND app_id = ?
          `).bind(Date.now(), userId, pusher.pushkey, pusher.app_id).run();
          return true;
        } else {
          // Increment failure count
          await db.prepare(`
            UPDATE pushers SET last_failure = ?, failure_count = failure_count + 1
            WHERE user_id = ? AND pushkey = ? AND app_id = ?
          `).bind(Date.now(), userId, pusher.pushkey, pusher.app_id).run();
        }
      } catch (error) {
        console.error(`[push] Failed to send via pusher ${pusher.app_id}:`, error);
        continue;
      }
    }

    return false;

  } catch (error) {
    console.error('[push] HTTP fallback notification failed:', error);
    return false;
  }
}

/**
 * Send via Sygnal with retry logic and proper payload formatting
 */
async function sendViaSygnalWithRetry(
  env: import('../types').Env,
  pusher: { pushkey: string; app_id: string },
  pusherData: any,
  event: {
    event_id: string;
    room_id: string;
    type: string;
    sender: string;
    content: any;
    origin_server_ts: number;
  },
  senderDisplayName: string,
  roomName: string,
  unreadCount: number,
  pushResult?: { notify: boolean; actions: any[]; highlight: boolean }
): Promise<boolean> {
  if (!pusherData.url) {
    return false;
  }

  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Deep clone default_payload
      const deviceData = JSON.parse(JSON.stringify(pusherData.default_payload || {}));

      // Set direct alert body
      if (deviceData.aps) {
        if (event.type === 'm.room.encrypted') {
          deviceData.aps.alert = {
            title: senderDisplayName,
            body: roomName,
          };
        } else {
          const messageBody = event.content?.body || 'New message';
          deviceData.aps.alert = {
            title: senderDisplayName,
            subtitle: roomName,
            body: messageBody,
          };
        }
        deviceData.aps['mutable-content'] = 1;
        if (unreadCount > 0) {
          deviceData.aps.badge = unreadCount;
        }
      }

      // Add fields for NSE
      deviceData.event_id = event.event_id;
      deviceData.room_id = event.room_id;
      deviceData.sender = event.sender;
      deviceData.unread_count = unreadCount;

      // Add push rule result if available
      if (pushResult) {
        deviceData.push_result = {
          highlight: pushResult.highlight,
          actions: pushResult.actions
        };
      }

      const pusherDataForGateway: any = {
        format: pusherData.format,
        default_payload: deviceData,
      };

      const notification = {
        notification: {
          event_id: event.event_id,
          room_id: event.room_id,
          type: event.type,
          sender: event.sender,
          sender_display_name: senderDisplayName,
          room_name: roomName,
          prio: pushResult?.highlight ? 'high' : 'normal',
          counts: { unread: unreadCount },
          content: event.content,
          devices: [{
            app_id: pusher.app_id,
            pushkey: pusher.pushkey,
            pushkey_ts: Date.now(),
            data: pusherDataForGateway
          }]
        }
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(pusherData.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return true;
      }

      // Parse gateway response for rate limiting info
      const gatewayResponse = await response.json().catch(() => ({}));
      
      // If we're being rate limited, use exponential backoff
      if (response.status === 429 && gatewayResponse.retry_after_ms) {
        await new Promise(resolve => setTimeout(resolve, gatewayResponse.retry_after_ms));
        continue;
      }

      // For other errors, retry with exponential backoff
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('[push] Sygnal request timeout');
      } else {
        console.error(`[push] Sygnal attempt ${attempt} failed:`, error);
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  return false;
}

/**
 * Send via PushDurableObject with better error handling
 */
async function sendDirectAPNsViaDO(
  env: import('../types').Env,
  pusher: { pushkey: string; app_id: string },
  event: {
    event_id: string;
    room_id: string;
    type: string;
    sender: string;
    content: any;
    origin_server_ts: number;
  },
  senderDisplayName: string,
  roomName: string,
  unreadCount: number
): Promise<boolean> {
  try {
    const pushDO = env.PUSH;
    const doId = pushDO.idFromName('apns');
    const stub = pushDO.get(doId);

    const aps: any = {
      'mutable-content': 1,
      sound: 'default',
    };

    if (event.type === 'm.room.encrypted') {
      aps.alert = {
        title: senderDisplayName,
        body: roomName,
      };
    } else {
      const messageBody = event.content?.body || 'New message';
      aps.alert = {
        title: senderDisplayName,
        subtitle: roomName,
        body: messageBody,
      };
    }

    if (unreadCount > 0) {
      aps.badge = unreadCount;
    }

    const apnsPayload = {
      aps,
      room_id: event.room_id,
      event_id: event.event_id,
      sender: event.sender,
      unread_count: unreadCount
    };

    // Determine bundle ID from app_id
    const topic = pusher.app_id
      .replace(/\.ios$/, '')
      .replace(/\.prod$/, '')
      .replace(/\.dev$/, '')
      .replace(/^io\.element/, 'io.element'); // Ensure base bundle ID

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for APNs

    const response = await stub.fetch(new Request('https://push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pushkey: pusher.pushkey,
        topic,
        payload: apnsPayload,
        priority: 10,
        expiration: Math.floor(Date.now() / 1000) + 86400 // 24 hours
      }),
      signal: controller.signal
    }));

    clearTimeout(timeoutId);

    const result = await response.json() as { 
      success: boolean; 
      apnsId?: string; 
      error?: string;
      status?: number;
    };

    if (result.success) {
      console.log('[push] Direct APNs success via DO, apns-id:', result.apnsId);
      return true;
    } else {
      console.error('[push] Direct APNs failed via DO:', result.error, 'status:', result.status);
      return false;
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[push] Direct APNs request timeout');
    } else {
      console.error('[push] Direct APNs error:', error);
    }
    return false;
  }
}

/**
 * Queue-based notification for room members (to replace the N+1 problem)
 * This should be called from your RoomNotificationQueue Durable Object
 */
export async function queueRoomNotification(
  db: D1Database,
  env: import('../types').Env,
  roomId: string,
  eventId: string,
  excludedUserId: string
): Promise<void> {
  // Get all members in batches to avoid N+1
  const batchSize = 50;
  let offset = 0;
  
  while (true) {
    const members = await db.prepare(`
      SELECT user_id FROM room_memberships
      WHERE room_id = ? AND membership = 'join' AND user_id != ?
      LIMIT ? OFFSET ?
    `).bind(roomId, excludedUserId, batchSize, offset).all<{ user_id: string }>();

    if (members.results.length === 0) {
      break;
    }

    // Process batch in parallel but with concurrency limit
    const batchPromises = members.results.map(member => 
      processMemberNotification(db, env, member.user_id, roomId, eventId)
    );

    await Promise.allSettled(batchPromises);
    
    offset += batchSize;
  }
}

async function processMemberNotification(
  db: D1Database,
  env: import('../types').Env,
  userId: string,
  roomId: string,
  eventId: string
): Promise<void> {
  try {
    // Check if user has any active sync connections
    const syncDO = env.SYNC.get(env.SYNC.idFromName(userId));
    const syncResponse = await syncDO.fetch('https://sync/status', {
      method: 'GET'
    });
    
    const syncStatus = await syncResponse.json() as { active: boolean };
    
    // If user has active sync, they'll get the event via WebSocket
    if (syncStatus.active) {
      return;
    }

    // Otherwise, use HTTP fallback
    await sendHttpFallbackNotification(db, env, userId, roomId, eventId);
    
  } catch (error) {
    // If sync DO is unavailable, fall back to HTTP
    console.log(`[push] Sync DO unavailable for ${userId}, using HTTP fallback`);
    await sendHttpFallbackNotification(db, env, userId, roomId, eventId);
  }
}