# Matrix Homeserver - AGENTS.md

This file provides guidance for AI agents working on this codebase. It documents the architecture, key patterns, and current project status.

## Project Overview

**Matrix Homeserver** - A Matrix homeserver (spec v1.17) running entirely on Cloudflare Workers edge infrastructure.

**Stack:** D1 (SQLite), KV, R2, Durable Objects, Workflows  
**Framework:** Hono with typed AppEnv bindings  
**Server:** `matrix.deepmeow.cc`

---

## Project Status

### Current Branch
- `main` - Production deployment on Cloudflare Workers

### Working Components
- Matrix Client-Server API (v1.17)
- Sliding Sync (MSC3575)
- End-to-End Encryption (E2EE via Megolm)
- Federation (Server-Server API)
- OIDC Authentication
- Admin Dashboard (`/admin`)
- Media Upload/Proxy
- User Directory Search

### Known Issues
- TypeScript has ~600+ errors (mostly in `src/api/*.ts`) - ongoing cleanup
- Some API modules need proper `Hono<AppEnv>()` typing
- E2EE key management is complex and spread across multiple files

---

## Key Architecture

### Directory Structure
```
src/
├── api/                    # Route handlers (30+ modules)
│   ├── sliding-sync/      # Sliding Sync implementation
│   └── federation.ts      # Server-Server API
├── admin/                 # Admin dashboard & API
│   ├── ui/               # Dashboard views (dashboard.ts)
│   └── api/              # Admin API endpoints
├── middleware/            # Auth, rate limiting, CORS
├── services/             # Business logic (database, crypto, etc.)
├── durable-objects/       # 8 DOs (Room, Sync, UserKeys, etc.)
├── workflows/             # Cloudflare Workflows
├── types/                # TypeScript types (env.ts, matrix.ts)
└── utils/                # Helpers (crypto, ids, errors)

migrations/               # D1 schema files (001-013)
```

### Storage Bindings
```json
"kv_namespaces": [
  { "binding": "SESSIONS" },     // Access tokens
  { "binding": "CACHE" },        // Room summaries
  { "binding": "ACCOUNT_DATA" }   // User account data
],
"durable_objects": [
  { "name": "USER_KEYS_DO" }     // E2EE keys
],
"d1_databases": [{ "binding": "DB" }],
"r2_buckets": [{ "binding": "MEDIA" }]
```

### ID Formats
- Users: `@user:domain`
- Rooms: `!room_id:domain`
- Events: `$event_id:domain`
- Aliases: `#alias:domain`

---

## Development Commands

```bash
npm run dev              # Local dev server
npm run deploy           # Deploy to Cloudflare
npm run typecheck        # TypeScript checking
npm run lint             # ESLint
npm run test             # Vitest
npm run db:migrate       # Run migrations (remote)
npm run db:migrate:local # Run migrations (local)
```

---

## Admin Dashboard

The admin dashboard is at `/admin` with these views:
- **Dashboard** - Quick actions, stats overview
- **Users** - List, create, deactivate users, view active users
- **Rooms** - List rooms, create rooms
- **Federation** - Server status, signing keys, known servers
- **Security** - Sessions, secrets status
- **Media** - Uploaded files management
- **Reports** - Content reports
- **Settings** - Server configuration

### Admin API Endpoints
- `POST /admin/api/login` - Admin login
- `GET /admin/api/stats` - Server statistics
- `GET/POST/PUT/DELETE /admin/api/users` - User management
- `GET/POST /admin/api/rooms` - Room management
- `GET /admin/api/federation/status` - Federation status
- `GET /admin/api/users/active` - Most active users

---

## Recent Changes (Session)

### TypeScript Fixes
- Fixed duplicate `AdminContext` interface in `src/admin/types.ts`
- Removed incorrect `Env as AppEnv` alias in `src/types/index.ts`
- Added proper typing to admin API modules (`Hono<AppEnv>()`)
- Fixed `statsApi`, `usersApi`, `roomsApi`, `federationApi`, `mediaApi`, `reportsApi`, `securityApi`, `settingsApi`

### Admin Dashboard Improvements
- Added "Most Active Users" API endpoint (`/api/users/active`)
- Updated `loadMostActiveUsers()` to use real data from events table
- Removed redundant "Signing Key" stat from Federation view
- Fixed Server Name text overflow with CSS `word-break: break-all`
- Added Create Room modal and functionality

### Migration Refactoring
- Consolidated 17 migrations down to **12**
- Removed duplicate index definitions
- Simplified FTS migration (removed D1-incompatible triggers)
- Fixed duplicate column errors in:
  - `006_secure_server_keys.sql` - removed duplicate ALTER TABLE
  - `009_fts_search.sql` - simplified for D1 compatibility
  - `013_sliding_sync.sql` - removed duplicate ALTER TABLE
- Merged `005_query_optimization.sql` into `013_sliding_sync.sql`

### FTS Implementation
- Created `src/services/fts-indexer.ts` for application-level FTS
- `indexUserFts()` - Index users for search
- `searchUsersFts()` - Fast user search with fallback
- Integrated FTS into user creation flow

---

## Key Patterns

### Authentication
- Bearer token in `Authorization` header or `?access_token=`
- SHA-256 hashed, stored in D1 `access_tokens`
- Middleware sets `userId`/`deviceId` on context

### Error Handling
- Use `MatrixApiError` class and `Errors` factory
- Always return Matrix JSON: `{ errcode, error }`

### Database Access
- Direct D1 prepared statements (no ORM)
- Use `db.batch()` for multiple queries
- All indexes use `IF NOT EXISTS` (idempotent)

### Security
- Passwords: PBKDF2-SHA256 (100,000 iterations)
- E2EE keys: Durable Objects with SQLite transactions
- Rate limiting: DO-based sliding window

---

## Testing Federation

Test federation with Matrix Federation Tester:
```
https://federationtester.matrix.org/
```

---

## Git Conventions

- Conventional commits: `feat:`, `fix:`, `perf:`, `refactor:`, etc.
- Never commit secrets or credentials
- Run `npm run typecheck` before committing

---

## Documentation

- `README.md` - User-facing documentation
- `DEPLOYMENT.md` - Deployment guide
- `CLAUDE.md` - This file (rename pending)

---

*Last updated: 2026-03-24*
