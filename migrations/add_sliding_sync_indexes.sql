// migrations/add_sliding_sync_indexes.sql
-- Add composite indexes for sliding sync queries
CREATE INDEX idx_room_members_user_membership 
ON room_members(user_id, membership, room_id);

CREATE INDEX idx_room_members_room_user 
ON room_members(room_id, user_id, membership);

CREATE INDEX idx_room_events_room_timestamp 
ON room_events(room_id, origin_server_ts DESC);

CREATE INDEX idx_rooms_last_activity 
ON rooms(last_activity DESC, room_id);

CREATE INDEX idx_rooms_type_encrypted 
ON rooms(type, encrypted, room_id);

-- Add index for tag-based filtering (favourites, etc.)
CREATE INDEX idx_room_tags_user_tag 
ON room_tags(user_id, tag_name, room_id);

-- Add index for DM detection
CREATE INDEX idx_direct_rooms_user 
ON direct_rooms(user_id, room_id);