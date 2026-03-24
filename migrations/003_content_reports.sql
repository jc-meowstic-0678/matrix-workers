-- Migration 004: Content Reports
-- Final consolidated version combining migrations 004, 009, and 010
-- Supports event reports, room reports, and user reports

-- Content reports table
CREATE TABLE IF NOT EXISTS content_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_user_id TEXT NOT NULL,
    room_id TEXT,
    event_id TEXT,
    reason TEXT NOT NULL DEFAULT '',
    score INTEGER NOT NULL DEFAULT -100,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    resolved INTEGER NOT NULL DEFAULT 0,
    resolved_by TEXT,
    resolved_at INTEGER,
    resolution_note TEXT,
    report_type TEXT NOT NULL DEFAULT 'event',
    reported_user_id TEXT,
    FOREIGN KEY (reporter_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON content_reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_room ON content_reports(room_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_resolved ON content_reports(resolved, created_at);
CREATE INDEX IF NOT EXISTS idx_content_reports_reported_user ON content_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_type ON content_reports(report_type);

-- Unique constraints for each report type
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_reports_unique_event ON content_reports(reporter_user_id, room_id, event_id)
    WHERE report_type = 'event';
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_reports_unique_room ON content_reports(reporter_user_id, room_id)
    WHERE report_type = 'room' AND event_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_reports_unique_user ON content_reports(reporter_user_id, reported_user_id)
    WHERE report_type = 'user';

-- Room knocks table (MSC2403)
CREATE TABLE IF NOT EXISTS room_knocks (
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reason TEXT,
    event_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_room_knocks_room ON room_knocks(room_id);
CREATE INDEX IF NOT EXISTS idx_room_knocks_user ON room_knocks(user_id);
