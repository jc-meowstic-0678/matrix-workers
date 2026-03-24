-- Migration 016: Sliding Sync Performance Indexes + Room Type
-- Consolidates migrations 016 and 017
-- Adds critical indexes for optimized Sliding Sync and room type column

-- ============================================
-- Room Type Column
-- ============================================

ALTER TABLE rooms ADD COLUMN type TEXT;

UPDATE rooms SET type = (
  SELECT json_extract(e.content, '$.type')
  FROM events e
  WHERE e.room_id = rooms.room_id
    AND e.event_type = 'm.room.create'
    AND e.state_key = ''
  LIMIT 1
);

CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(type);

-- ============================================
-- Room Memberships (for user's room lists)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_room_memberships_user_membership 
ON room_memberships(user_id, membership);

CREATE INDEX IF NOT EXISTS idx_room_memberships_room_member_count 
ON room_memberships(room_id, membership);

CREATE INDEX IF NOT EXISTS idx_room_memberships_user_created 
ON room_memberships(user_id, created_at DESC);

-- ============================================
-- Events (for timeline and recency sorting)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_events_room_timestamp_desc 
ON events(room_id, origin_server_ts DESC);

CREATE INDEX IF NOT EXISTS idx_events_room_latest 
ON events(room_id, origin_server_ts DESC, event_id);

-- ============================================
-- Rooms (for filtering)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_rooms_type_encrypted 
ON rooms(room_version, is_public);

-- ============================================
-- Room Tags (for favourites, etc.)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_room_tags_user_tag 
ON account_data(user_id, event_type) 
WHERE event_type = 'm.tag';

-- ============================================
-- Direct Message Detection
-- ============================================

CREATE INDEX IF NOT EXISTS idx_direct_rooms_user 
ON account_data(user_id, event_type, room_id) 
WHERE event_type = 'm.direct';

-- ============================================
-- Account Data (for pre-computed lists)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_account_data_user_room 
ON account_data(user_id, room_id, event_type);

CREATE INDEX IF NOT EXISTS idx_account_data_user_tags 
ON account_data(user_id, event_type, room_id) 
WHERE event_type = 'm.tag';

CREATE INDEX IF NOT EXISTS idx_account_data_user_direct 
ON account_data(user_id, event_type) 
WHERE event_type = 'm.direct';

-- Add encrypted column if not exists
ALTER TABLE rooms ADD COLUMN encrypted INTEGER DEFAULT 0;
