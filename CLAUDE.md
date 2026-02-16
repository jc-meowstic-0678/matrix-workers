
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It documents the architecture, key patterns, and recent optimizations in the `dev` branch.

## Project Overview

Tuwunel is a Matrix homeserver (spec v1.17) running entirely on Cloudflare Workers edge infrastructure. It uses D1 (SQLite), KV, R2, Durable Objects, and Workflows. The live instance runs at `m.easydemo.org`.

The `dev` branch includes significant performance optimizations for Sliding Sync and a critical migration of E2EE keys from KV to Durable Objects for strong consistency.

## Development Commands

```bash
npm run dev              # Local dev server (wrangler dev)
npm run deploy           # Deploy to Cloudflare
npm run typecheck        # TypeScript type checking (tsc --noEmit)
npm run lint             # ESLint on src/
npm run test             # Vitest
npm run db:migrate       # Run D1 migrations (remote)
npm run db:migrate:local # Run D1 migrations (local)

# New migration commands
npm run db:migrate:sliding-sync  # Run Sliding Sync performance indexes
npm run db:verify-indexes        # Verify all indexes are created
```

Architecture

Framework: Hono web framework with typed AppEnv bindings for Cloudflare resources.

Entry point: src/index.ts — creates the Hono app, applies global middleware (CORS → Logger → Rate Limit), mounts all route modules, and exports Durable Objects + Workflows.

Layered Structure

· src/api/ — Route handlers (30+ modules). Each exports a Hono instance mounted in the main app. Largest: federation.ts (103KB), sliding-sync.ts (81KB), admin.ts (80KB), rooms.ts (73KB).
· src/middleware/ — Auth (requireAuth()), rate limiting (DO-based sliding window), federation auth (Ed25519 X-Matrix), idempotency.
· src/services/ — Business logic: database.ts (D1 queries, no ORM), federation-keys.ts, server-discovery.ts, email.ts (Cloudflare Email Service), oidc.ts, turn.ts, livekit.ts, cloudflare-calls.ts, room-cache.ts, transactions.ts.
· src/durable-objects/ — 8 DOs: Room (WebSocket coordination), Sync, Federation (queue), CallRoom (video), Admin, UserKeys (E2EE - critical), Push, RateLimit.
· src/workflows/ — RoomJoinWorkflow (federation handshake with retry), PushNotificationWorkflow.
· src/types/ — env.ts (Cloudflare bindings), matrix.ts (PDU/event types).
· src/utils/ — crypto.ts (hashing/signing), ids.ts (Matrix ID generation), errors.ts (MatrixApiError + Errors factory).
· src/admin/dashboard.ts — Embedded admin web UI at /admin.
· migrations/ — D1 schema files (schema.sql + numbered migrations 002–016).

Storage Bindings (defined in wrangler.jsonc)

Important: The dev branch has migrated E2EE keys from KV to Durable Objects. Only 3 KV namespaces are now used:

```json
"kv_namespaces": [
  { "binding": "SESSIONS", "id": "..." },     // Access tokens, sessions
  { "binding": "CACHE", "id": "..." },        // Room summaries, pre-computed lists
  { "binding": "ACCOUNT_DATA", "id": "..." }  // User account data
]

"durable_objects": {
  "bindings": [
    { "name": "USER_KEYS_DO", "class_name": "UserKeysDurableObject" } // E2EE keys!
  ]
}

"d1_databases": [
  { "binding": "DB", "database_name": "tuwunel-db", "database_id": "..." }
]

"r2_buckets": [
  { "binding": "MEDIA", "bucket_name": "my-matrix-media" }
]
```

⚡ Recent Optimizations (Dev Branch)

1. E2EE Keys: KV → Durable Objects Migration

Critical Change: All E2EE key data now uses Durable Objects with SQLite for strong consistency:

Data Type Previous (KV) Current (DO) Benefit
Device Keys Eventually consistent Strongly consistent No stale device lists
One-Time Keys Eventually consistent Transactional claiming Keys can never be double-claimed
Cross-Signing Keys Eventually consistent Strongly consistent Signature verification reliable
Key Backups KV (unused) D1 (properly implemented) Encrypted storage

Implementation: src/durable-objects/user-keys-do.ts with SQLite tables:

· device_keys - Per-device keys with indexes
· one_time_keys - Claimed flag with atomic transactions
· cross_signing_keys - Master/self-signing/user-signing
· key_backup - Encrypted session backups

Key Methods:

```typescript
// Atomic claim - runs in SQL transaction
async claimOneTimeKey(deviceId: string): Promise<any> {
  const tx = this.sql.transaction(() => {
    // SELECT + UPDATE in one atomic operation
  });
}
```

2. Sliding Sync Performance Overhaul

The Sliding Sync implementation has been completely refactored for performance:

```
src/api/sliding-sync/
├── optimized-sync.ts       # Parallel list processing with concurrency control
├── caching-strategy.ts     # Room summary caching with 30s TTL
├── precomputed-lists.ts    # Pre-computed lists (invites, DMs, favourites)
├── streaming-response.ts   # Progressive NDJSON streaming
├── d1-pool.ts              # Priority-based D1 connection pooling
└── performance-monitor.ts  # Metrics and slow-sync detection
```

Configuration Options (via environment variables):

· SLIDING_SYNC_MAX_CONCURRENT_LISTS - Default: 5
· SLIDING_SYNC_CACHE_TTL_MS - Default: 30000 (30 seconds)
· SLIDING_SYNC_ROOM_BATCH_SIZE - Default: 50
· SLIDING_SYNC_PRECOMPUTE_TTL - Default: 300 (5 minutes)
· SLIDING_SYNC_SLOW_THRESHOLD_MS - Default: 1000 (1 second)

3. Database Indexes (Migration 016)

New indexes for Sliding Sync performance:

```sql
-- Migration 016_sliding_sync_indexes.sql
CREATE INDEX idx_room_memberships_user_membership ON room_memberships(user_id, membership);
CREATE INDEX idx_events_room_timestamp_desc ON events(room_id, origin_server_ts DESC);
CREATE INDEX idx_rooms_type_encrypted ON rooms(room_version, is_public);
CREATE INDEX idx_room_tags_user_tag ON account_data(user_id, event_type) WHERE event_type = 'm.tag';
CREATE INDEX idx_direct_rooms_user ON account_data(user_id, event_type, room_id) WHERE event_type = 'm.direct';
```

Key Patterns

Authentication

· Token from Authorization: Bearer or ?access_token=
· SHA-256 hashed, looked up in D1 access_tokens
· Middleware sets userId/deviceId on context

Error Handling

· Use MatrixApiError class and Errors factory for standardized Matrix JSON responses (errcode, error)
· Always return appropriate HTTP status codes

Database Access

· Direct D1 prepared statements — no ORM
· All queries in src/services/database.ts or inline in route handlers
· Use db.batch() for multiple queries to reduce round trips
· For Sliding Sync, use the connection pool: D1ConnectionPool.getInstance(env)

ID Formats

· Users: @user:domain
· Rooms: !room_id:domain
· Events: $event_id:domain
· Aliases: #alias:domain

Federation

· Ed25519 signing for requests
· X-Matrix header validation
· Server key caching in KV
· Remote key queries via Durable Objects

Real-time Sync

· Hibernatable WebSockets via RoomDurableObject
· Long-polling sync fallback
· Sliding Sync (MSC3575/MSC4186) for Element X with performance optimizations

Security

· Passwords hashed with PBKDF2-SHA256 (100,000 iterations)
· E2EE keys in Durable Objects with SQLite transactions
· Rate limiting via Durable Objects (sliding window)

Performance Monitoring

Built-in metrics available via the admin dashboard and wrangler tail:

```bash
# Monitor sync performance
npx wrangler tail --format pretty | grep "Slow sync"

# Check query performance
npx wrangler d1 execute tuwunel-db --remote --command="
  SELECT * FROM sqlite_master WHERE type='index';
"
```

The SlidingSyncMonitor class tracks:

· Per-user sync durations
· List processing times
· P95 latency
· Slow operation logging (>1000ms)

Migration Guide (for existing instances)

If upgrading from a KV-based deployment:

1. Update wrangler.jsonc to remove E2EE KV bindings and add Durable Objects
2. Run migration script: npx wrangler run scripts/migrate-kv-to-do.ts
3. Verify migration by checking key claims work atomically
4. Remove old KV namespaces after confirmation

See DEPLOYMENT.md for detailed steps.

TypeScript Configuration

· Strict mode enabled
· ES2022 target
· @/* path alias maps to src/*
· @cloudflare/workers-types for Worker bindings

Git Commit Rules

· Never include Claude attribution (e.g., Co-Authored-By) in commit messages.
· Use conventional commits format: feat:, fix:, perf:, refactor:, etc.
· Reference issues where applicable.

Testing

```bash
# Unit tests
npm run test

# Integration tests (requires Cloudflare credentials)
npm run test:integration

# Performance testing
npm run test:perf -- --users 100 --rooms 50
```

Deployment Checklist

· Verify wrangler.jsonc has correct bindings (only 3 KV namespaces)
· Run all migrations including 016_sliding_sync_indexes.sql
· Set SERVER_NAME environment variable
· Configure custom domain
· Test with Federation Tester
· Monitor initial sync performance with wrangler tail

---

Note: This file is specifically for Claude Code to understand the project structure, patterns, and recent optimizations. For user-facing documentation, see README.md and DEPLOYMENT.md.
