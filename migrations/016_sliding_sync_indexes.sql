-- Migration 016: Sliding Sync Performance Indexes
-- Adds critical indexes for the optimized Sliding Sync implementation
-- Run this after deploying the new sliding-sync components

-- ============================================
-- Room Memberships (for user's room lists)
-- ============================================

-- Primary index for fetching user's rooms by membership type
-- Used heavily by precomputed-lists.ts and optimized-sync.ts
CREATE INDEX IF NOT EXISTS idx_room_memberships_user_membership 
ON room_memberships(user_id, membership);

-- Composite index for room filtering with member counts
-- Used when determining DM status or filtering by room size
CREATE INDEX IF NOT EXISTS idx_room_memberships_room_member_count 
ON room_memberships(room_id, membership);

-- ============================================
-- Events (for timeline and recency sorting)
-- ============================================

-- Critical for sorting rooms by last activity (by_recency)
-- Used in precomputed-lists.ts and all list sorting
CREATE INDEX IF NOT EXISTS idx_events_room_timestamp_desc 
ON events(room_id, origin_server_ts DESC);

-- Optimized index for fetching latest event in a room
-- Used by caching-strategy.ts for room summaries
CREATE INDEX IF NOT EXISTS idx_events_room_latest 
ON events(room_id, origin_server_ts DESC, event_id);

-- ============================================
-- Rooms (for filtering)
-- ============================================

-- For filtering rooms by type and encryption status
-- Used in precomputed-lists.ts getFilteredRoomsPaginated
CREATE INDEX IF NOT EXISTS idx_rooms_type_encrypted 
ON rooms(room_version, is_public);

-- ============================================
-- Room Tags (for favourites, etc.)
-- ============================================

-- For pre-computed favourites lists
CREATE INDEX IF NOT EXISTS idx_room_tags_user_tag 
ON account_data(user_id, event_type) 
WHERE event_type = 'm.tag';

-- ============================================
-- Direct Message Detection
-- ============================================

-- For efficient DM list computation
CREATE INDEX IF NOT EXISTS idx_direct_rooms_user 
ON account_data(user_id, event_type, room_id) 
WHERE event_type = 'm.direct';

-- ============================================
-- Account Data (for pre-computed lists)
-- ============================================

-- Generic index for all account data queries
CREATE INDEX IF NOT EXISTS idx_account_data_user_room 
ON account_data(user_id, room_id, event_type);

CREATE INDEX IF NOT EXISTS idx_room_memberships_user_created 
ON room_memberships(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_data_user_tags 
ON account_data(user_id, event_type, room_id) 
WHERE event_type = 'm.tag';

CREATE INDEX IF NOT EXISTS idx_account_data_user_direct 
ON account_data(user_id, event_type) 
WHERE event_type = 'm.direct';

-- Add encrypted column if not exists
ALTER TABLE rooms ADD COLUMN encrypted INTEGER DEFAULT 0;