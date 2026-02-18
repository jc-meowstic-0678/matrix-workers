ALTER TABLE rooms ADD COLUMN type TEXT;
-- Optionally populate from m.room.create events
UPDATE rooms SET type = (
  SELECT json_extract(e.content, '$.type')
  FROM events e
  WHERE e.room_id = rooms.room_id
    AND e.type = 'm.room.create'
    AND e.state_key = ''
  LIMIT 1
);

-- Index for type-based filtering (used by sliding sync)
CREATE INDEX IF NOT EXISTS idx_rooms_type 
ON rooms(type);