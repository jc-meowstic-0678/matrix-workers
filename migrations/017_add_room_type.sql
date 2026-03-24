ALTER TABLE rooms ADD COLUMN type TEXT;

-- Populate from m.room.create events (optional)
UPDATE rooms SET type = (
  SELECT json_extract(e.content, '$.type')
  FROM events e
  WHERE e.room_id = rooms.room_id
    AND e.event_type = 'm.room.create'
    AND e.state_key = ''
  LIMIT 1
);

-- Index for type-based filtering (used by sliding sync)
CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(type);