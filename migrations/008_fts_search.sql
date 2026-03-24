-- Migration: Full-Text Search with FTS5
-- Adds FTS5 virtual tables for event content and user directory search
-- Note: D1 has limited FTS5 support - triggers must be separate

-- FTS5 virtual table for event content search
CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
    event_id,
    room_id,
    sender,
    body
);

-- FTS5 virtual table for user directory search
CREATE VIRTUAL TABLE IF NOT EXISTS users_fts USING fts5(
    user_id,
    localpart,
    display_name
);
