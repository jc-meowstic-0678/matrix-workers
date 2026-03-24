-- Migration 013: Sliding Sync Performance Indexes
-- Adds critical indexes for optimized Sliding Sync
-- Note: Room type/encrypted columns should be added separately if needed

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
