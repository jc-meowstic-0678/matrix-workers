---

# Matrix Homeserver on Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/jc-meowstic-0678/matrix-workers)

A Matrix homeserver (spec v1.17) running entirely on Cloudflare's edge infrastructure. Features full end-to-end encryption (E2EE), Sliding Sync, and Federation support.

**Server:** `matrix.deepmeow.cc`

## Live Demo

Test federation compatibility using the [Matrix Federation Tester](https://federationtester.matrix.org/).

## Quick Start

### One-Click Deploy

1. Click the "Deploy to Cloudflare" button above
2. Cloudflare provisions all resources automatically
3. Update `SERVER_NAME` to your domain
4. Run database migrations
5. Configure your custom domain

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete instructions.

### Manual Deploy

```bash
# Clone and install
git clone https://github.com/jc-meowstic-0678/matrix-workers
cd matrix-workers
npm install

# Create resources
npx wrangler d1 create my-matrix-db
npx wrangler kv namespace create SESSIONS
npx wrangler kv namespace create CACHE
npx wrangler kv namespace create ACCOUNT_DATA
npx wrangler r2 bucket create my-matrix-media

# Update wrangler.jsonc with resource IDs and SERVER_NAME
# See DEPLOYMENT.md for full instructions
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Cloudflare Edge Network                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Workers   │  │  Durable    │  │     D1      │  │         R2          │ │
│  │   (Hono)    │──│  Objects    │──│  (SQLite)   │  │   (Object Storage)  │ │
│  │             │  │             │  │             │  │                     │ │
│  │ - Routing   │  │ - Room DO   │  │ - users     │  │ - Media files       │ │
│  │ - Auth      │  │ - Sync DO   │  │ - rooms     │  │ - Thumbnails        │ │
│  │ - API       │  │ - Fed DO    │  │ - events    │  │ - Avatars           │ │
│  │ - Rate Lim  │  │ - Keys DO   │  │ - keys      │  │                     │ │
│  └─────────────┘  │ - Push DO   │  │ - tokens    │  └─────────────────────┘ │
│         │         │ - Admin DO  │  └─────────────┘            │             │
│         │         │ - Call DO   │                             │             │
│         │         │ - Rate DO   │                             │             │
│         │         └─────────────┘         │                   │             │
│  ┌──────┴─────────────────────────────────┴───────────────────┴───────────┐ │
│  │                          KV Namespaces                                 │ │
│  │        SESSIONS · CACHE · ACCOUNT_DATA  (E2EE keys now in DO)         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── api/                    # Route handlers (30+ modules)
│   ├── sliding-sync/      # Sliding Sync implementation
│   └── federation.ts      # Server-Server API
├── admin/                 # Admin dashboard & API
│   ├── ui/               # Dashboard views
│   └── api/              # Admin API endpoints
├── middleware/            # Auth, rate limiting, CORS
├── services/             # Business logic
├── durable-objects/      # 8 DOs (Room, Sync, UserKeys, etc.)
├── workflows/             # Cloudflare Workflows
├── types/                # TypeScript types
└── utils/                # Helpers (crypto, ids, errors)

migrations/               # D1 schema files (001-013)
```

### Code Overview

A quick guide to navigating the codebase:

**API Handlers** (`src/api/*.ts`) - Each file handles one Matrix feature area:

| File | Handles |
|------|---------|
| `rooms.ts` | Room creation, state, events |
| `login.ts` | Authentication, tokens |
| `keys.ts` | E2EE, cross-signing, OTKs |
| `federation.ts` | Server-Server API |
| `push.ts` | Push notifications |
| `sync.ts` | Sync responses |

**Services** (`src/services/*.ts`) - Shared business logic:

| File | Handles |
|------|---------|
| `database.ts` | All D1 queries |
| `event-auth.ts` | Event authorization |
| `federation-keys.ts` | Remote key fetching |

**Durable Objects** (`src/durable-objects/*.ts`):

| Object | Purpose |
|--------|---------|
| `RoomDurableObject.ts` | Room event storage |
| `SyncDurableObject.ts` | User sync state |
| `UserKeysDurableObject.ts` | E2EE keys |
| `RateLimitDurableObject.ts` | Distributed rate limits |

### Storage Bindings

```json
"kv_namespaces": [
  { "binding": "SESSIONS" },
  { "binding": "CACHE" },
  { "binding": "ACCOUNT_DATA" }
],
"durable_objects": [
  { "name": "USER_KEYS_DO" }
],
"d1_databases": [{ "binding": "DB" }],
"r2_buckets": [{ "binding": "MEDIA" }]
]
```

## Features

### Core Matrix Protocol
- Client-Server API (v1.17)
- Server-Server (Federation) API
- End-to-End Encryption (E2EE via Megolm)
- Sliding Sync (MSC3575)

### Admin Dashboard
- **Dashboard** - Server stats, quick actions, activity overview
- **Users** - Create, list, deactivate users; view most active users
- **Rooms** - List and create rooms
- **Federation** - Server status, signing keys, known servers
- **Security** - Sessions, secrets status
- **Media** - Uploaded files management
- **Reports** - Content reports
- **Settings** - Server configuration
- **SSO / Identity Providers** - Configure OIDC providers for SSO login (Google, Azure AD, Okta, etc.)

### Security
- PBKDF2-SHA256 password hashing (100,000 iterations)
- E2EE keys in Durable Objects with SQLite transactions
- Rate limiting via Durable Objects

## Recent Updates

### SSO / Identity Providers
- Added OIDC-based SSO login support for Element X and other Matrix clients
- Admin dashboard UI for managing identity providers (Google, Azure AD, Okta, Auth0, etc.)
- Support for auto-creating users on first SSO login
- Provider-specific redirect URIs: `https://your-server/auth/oidc/{provider_id}/callback`

### TypeScript Improvements
- Fixed all TypeScript errors in admin API modules
- Added proper `Hono<AppEnv>()` type bindings
- Fixed duplicate interface definitions
- Added non-null assertions for route parameters

### Admin Dashboard
- Added "Most Active Users" feature with real data from events table
- Added Create Room modal and functionality
- Fixed UI layout issues (text overflow, redundant sections)

### Database Migrations
- Consolidated 17 migrations down to 12 files
- Removed duplicate index definitions
- Fixed D1 compatibility issues (FTS5 triggers)
- All indexes use `IF NOT EXISTS` for idempotency

### Full-Text Search
- Application-level FTS indexing for user search
- Fast search with graceful fallback to LIKE queries
- Integrated into user creation flow

## API Coverage

### Client-Server API

| Category | Status |
|----------|--------|
| Authentication | ✅ |
| Sync (including Sliding Sync) | ✅ |
| Rooms | ✅ |
| Messaging | ✅ |
| State | ✅ |
| E2EE | ✅ |
| To-Device | ✅ |
| Push | ✅ |
| Media | ✅ |
| Profile | ✅ |
| Presence | ✅ |
| Typing | ✅ |
| Receipts | ✅ |
| Account Data | ✅ |
| Directory | ✅ |
| Discovery | ✅ |
| Reporting | ✅ |
| Admin | ✅ |
| 3PID | ✅ |

### Server-Server (Federation) API

Full federation endpoints with E2EE key queries and claims.

## Development

```bash
npm run dev              # Local dev server
npm run deploy           # Deploy to Cloudflare
npm run typecheck        # TypeScript checking
npm run lint             # ESLint
npm run test             # Vitest
npm run db:migrate       # Run migrations (remote)
npm run db:migrate:local # Run migrations (local)
```

## Code Patterns

Quick reference for understanding the code:

**Error Handling** - Uses `Errors` class from `src/utils/errors.ts`:
```typescript
return Errors.notFound('User not found').toResponse();
```

**Database Access** - Via D1 with parameterized queries:
```typescript
await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(userId).first();
```

**Durable Objects** - Accessed by name for consistency:
```typescript
const id = env.ROOM_DO.idFromName(roomId);
const stub = env.ROOM_DO.get(id);
```

**Authentication** - Via middleware:
```typescript
app.get('/path', requireAuth(), async (c) => { ... });
```

## Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Complete setup instructions
- [AGENTS.md](AGENTS.md) - Developer documentation for AI agents
- [Matrix Specification](https://spec.matrix.org) - Matrix Protocol v1.17

## Acknowledgments

- **Original Project**: [nkuntz1934/matrix-workers](https://github.com/nkuntz1934/matrix-workers)
- **Cloudflare**: Workers, D1, Durable Objects, and R2 platform
- **Matrix.org**: Open specification and reference implementations

## Contributing

Contributions welcome! Areas of interest:
- Performance benchmarking and optimization
- Federation testing
- Additional MSC implementations
- Client compatibility testing

## License

MIT License - see [LICENSE](LICENSE)

---

**Built on Cloudflare Workers**
