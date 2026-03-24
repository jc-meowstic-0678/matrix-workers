---

# Deployment Guide

Complete guide to deploying your own Matrix homeserver on Cloudflare Workers.

## Table of Contents
- [Deploy Button (Quick Start)](#deploy-button-quick-start)
- [Manual Deployment](#manual-deployment)
- [Prerequisites](#prerequisites)
- [Step 1: Clone and Install](#step-1-clone-and-install)
- [Step 2: Create Cloudflare Resources](#step-2-create-cloudflare-resources)
- [Step 3: Configure wrangler.jsonc](#step-3-configure-wranglerjsonc)
- [Step 4: Run Database Migrations](#step-4-run-database-migrations)
- [Step 5: Deploy](#step-5-deploy)
- [Step 6: Configure Your Domain](#step-6-configure-your-domain)
- [Step 7: Verify Deployment](#step-7-verify-deployment)
- [⚡ Performance Optimizations](#-performance-optimizations)
- [🔄 Migrating E2EE Keys from KV to Durable Objects](#-migrating-e2ee-keys-from-kv-to-durable-objects)
- [Optional Features](#optional-features)
- [Troubleshooting](#troubleshooting)
- [Updating](#updating)
- [Architecture Overview](#architecture-overview)

## Deploy Button (Quick Start)

The fastest way to deploy is using the Deploy to Cloudflare button:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/jc-meowstic-0678/matrix-workers)

### What the Deploy Button Does

When you click the button, Cloudflare will:
- Fork the repository to your GitHub/GitLab account
- Provision resources automatically:
  - D1 database
  - KV namespaces (SESSIONS, CACHE, ACCOUNT_DATA only)
  - R2 bucket for media storage
  - Durable Objects (for E2EE keys and sync state)
  - Workflows
- Deploy the Worker to your Cloudflare account
- Set up Workers Builds for continuous deployment from your forked repo

### After Using the Deploy Button

You still need to complete these steps manually:

#### 1. Update SERVER_NAME

The `SERVER_NAME` environment variable must match your domain. Update it in your Cloudflare dashboard:
- Go to **Workers & Pages**
- Select your deployed Worker
- Go to **Settings → Variables and Secrets**
- Edit `SERVER_NAME` to your domain (e.g., `matrix.yourdomain.com`)
- Click **Deploy** to apply changes

> **Important**: `SERVER_NAME` cannot be changed after users register. Choose carefully.

#### 2. Run Database Migrations

The D1 database is created but empty. You must run all migrations:

```bash
# Find your D1 database name in the Worker settings (under D1 Database Bindings)
# Then run each migration (replace YOUR_DB_NAME with your actual database name)

# Clone your forked repository locally
git clone https://github.com/YOUR_USERNAME/matrix-workers
cd matrix-workers

# Authenticate wrangler
npx wrangler login

# Run all migrations in order
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/schema.sql
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/002_phase1_e2ee.sql
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/003_account_management.sql
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/004_reports_and_notices.sql
# Note: Two migrations share the 005 prefix (both must be run)
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/005_server_config.sql
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/005_idp_providers.sql
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/006_query_optimization.sql
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/007_secure_server_keys.sql
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/008_federation_transactions.sql
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/009_reports_extended.sql
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/010_fix_reports_schema.sql
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/011_identity_service.sql
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/012_fts_search.sql
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/013_remote_device_lists.sql
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/014_appservice.sql
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/015_identity_associations.sql
# Critical performance indexes for Sliding Sync
npx wrangler d1 execute YOUR_DB_NAME --remote --file=migrations/016_sliding_sync_indexes.sql
```

#### 3. Configure Custom Domain

Your Worker is deployed at `*.workers.dev` but Matrix federation requires a proper domain:
- Go to your Worker in the dashboard
- Navigate to **Settings → Domains & Routes**
- Click **Add → Custom Domain**
- Enter your domain (e.g., `matrix.yourdomain.com`)
- Cloudflare automatically configures DNS if your domain is on Cloudflare

#### 4. Verify Deployment

Test your deployment:
```bash
# Replace with your domain
curl https://matrix.yourdomain.com/_matrix/client/versions

# Check federation
curl https://matrix.yourdomain.com/_matrix/federation/v1/version
```

Run the [Matrix Federation Tester](https://federationtester.matrix.org/) with your server name.

#### 5. Register Your First User
```bash
curl -X POST "https://matrix.yourdomain.com/_matrix/client/v3/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-secure-password",
    "auth": {"type": "m.login.dummy"}
  }'
```

## Manual Deployment

For more control, deploy manually using the steps below.

## Prerequisites

### Required

- **Cloudflare Account with Workers Paid plan** ($5/month)
  - Required for Durable Objects, which are essential for real-time sync and E2EE key storage
  - Sign up at [cloudflare.com](https://cloudflare.com)

- **Node.js 18+**
  ```bash
  node --version  # Should be v18.0.0 or higher
  ```

- **Wrangler CLI**
  ```bash
  npm install -g wrangler
  wrangler --version
  ```

- **Authenticate Wrangler**
  ```bash
  npx wrangler login
  ```
  This opens a browser to authenticate with your Cloudflare account.

- **A Domain managed by Cloudflare** (for federation to work)
  - Matrix federation requires a proper domain name
  - The domain's DNS must be managed by Cloudflare

## Step 1: Clone and Install

```bash
git clone https://github.com/jc-meowstic-0678/matrix-workers
cd matrix-workers
npm install
```

## Step 2: Create Cloudflare Resources

Run these commands and save the output - you'll need the IDs for configuration.

### 2.1 Get Your Account ID
```bash
npx wrangler whoami
```
Note your Account ID from the output.

### 2.2 Create D1 Database
```bash
npx wrangler d1 create my-matrix-db
```
Output will include:
```
Created D1 database 'my-matrix-db'
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
Save the `database_id`.

### 2.3 Create KV Namespaces (for non-E2EE data only)

Create the KV namespaces for session management and caching. **E2EE keys now use Durable Objects with SQLite for strong consistency**, so they do not require KV namespaces.

```bash
npx wrangler kv namespace create SESSIONS
npx wrangler kv namespace create CACHE
npx wrangler kv namespace create ACCOUNT_DATA
```

Each command outputs an ID. Save all 3 IDs.

Example output:
```
Add the following to your wrangler configuration file:
kv_namespaces = [
  { binding = "SESSIONS", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
]
```

> **Important**: The following KV namespaces are **no longer needed** and should **NOT be created**:
> - ~~`DEVICE_KEYS`~~ (now using Durable Objects)
> - ~~`ONE_TIME_KEYS`~~ (now using Durable Objects)
> - ~~`CROSS_SIGNING_KEYS`~~ (now using Durable Objects)
>
> If you have an existing deployment with these KV namespaces, see the [Migration Guide](#-migrating-e2ee-keys-from-kv-to-durable-objects) below.

### 2.4 Create R2 Bucket
```bash
npx wrangler r2 bucket create my-matrix-media
```
Save the bucket name (you chose it, so just remember it).

### 2.5 Durable Objects (Automatically Created)
Durable Objects are defined in your `wrangler.jsonc` and will be created automatically when you first deploy. No separate creation command is needed.

## Step 3: Configure wrangler.jsonc

Open `wrangler.jsonc` and replace all placeholder values with your actual IDs.

### 3.1 Basic Configuration
```json
{
  "name": "my-matrix-server",
  "account_id": "YOUR_ACCOUNT_ID",
  "compatibility_date": "2025-02-16",
  "compatibility_flags": ["nodejs_compat"],
  "main": "src/index.ts"
}
```

### 3.2 D1 Database
```json
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "my-matrix-db",
    "database_id": "YOUR_DATABASE_ID"
  }
]
```

### 3.3 KV Namespaces (Only 3)
```json
"kv_namespaces": [
  { "binding": "SESSIONS", "id": "YOUR_SESSIONS_KV_ID" },
  { "binding": "CACHE", "id": "YOUR_CACHE_KV_ID" },
  { "binding": "ACCOUNT_DATA", "id": "YOUR_ACCOUNT_DATA_KV_ID" }
  // DEVICE_KEYS, ONE_TIME_KEYS, CROSS_SIGNING_KEYS are NOT used
  // E2EE data now uses Durable Objects for strong consistency
]
```

### 3.4 R2 Bucket
```json
"r2_buckets": [
  {
    "binding": "MEDIA",
    "bucket_name": "my-matrix-media"
  }
]
```

### 3.5 Durable Objects Configuration (CRITICAL for E2EE)
```json
"durable_objects": {
  "bindings": [
    {
      "name": "USER_KEYS_DO",
      "class_name": "UserKeysDurableObject"
    }
  ]
}

"migrations": [
  {
    "tag": "v1",
    "new_classes": ["UserKeysDurableObject"]
  }
]
```

### 3.6 Environment Variables
```json
"vars": {
  "SERVER_NAME": "matrix.yourdomain.com",
  "SERVER_VERSION": "0.1.0",
  
  // Sliding Sync Performance Tuning (Optional)
  "SLIDING_SYNC_MAX_CONCURRENT_LISTS": "5",
  "SLIDING_SYNC_CACHE_TTL_MS": "30000",
  "SLIDING_SYNC_ROOM_BATCH_SIZE": "50",
  "SLIDING_SYNC_PRECOMPUTE_TTL": "300",
  "SLIDING_SYNC_SLOW_THRESHOLD_MS": "1000"
}
```
> **Important**: `SERVER_NAME` must match the domain you'll use for Matrix. This cannot be changed after users register.

### 3.7 Custom Domain (Optional but Recommended)
```json
"routes": [
  {
    "pattern": "matrix.yourdomain.com",
    "custom_domain": true
  }
]
```

### 3.8 Remove Optional Features (If Not Using)

If you're not using LiveKit for video calls, remove or comment out:
```json
// Remove these sections if not using LiveKit:
"vpc_services": [ ... ],
"vars": {
  // Remove these:
  "LIVEKIT_API_KEY": "...",
  "LIVEKIT_URL": "..."
}
```

## Step 4: Run Database Migrations

Apply all migrations to your D1 database in order:

```bash
# Replace 'my-matrix-db' with your actual database name

npx wrangler d1 execute my-matrix-db --remote --file=migrations/schema.sql
npx wrangler d1 execute my-matrix-db --remote --file=migrations/002_phase1_e2ee.sql
npx wrangler d1 execute my-matrix-db --remote --file=migrations/003_account_management.sql
npx wrangler d1 execute my-matrix-db --remote --file=migrations/004_reports_and_notices.sql
# Note: Two migrations share the 005 prefix (both must be run)
npx wrangler d1 execute my-matrix-db --remote --file=migrations/005_server_config.sql
npx wrangler d1 execute my-matrix-db --remote --file=migrations/005_idp_providers.sql
npx wrangler d1 execute my-matrix-db --remote --file=migrations/006_query_optimization.sql
npx wrangler d1 execute my-matrix-db --remote --file=migrations/007_secure_server_keys.sql
npx wrangler d1 execute my-matrix-db --remote --file=migrations/008_federation_transactions.sql
npx wrangler d1 execute my-matrix-db --remote --file=migrations/009_reports_extended.sql
npx wrangler d1 execute my-matrix-db --remote --file=migrations/010_fix_reports_schema.sql
npx wrangler d1 execute my-matrix-db --remote --file=migrations/011_identity_service.sql
npx wrangler d1 execute my-matrix-db --remote --file=migrations/012_fts_search.sql
npx wrangler d1 execute my-matrix-db --remote --file=migrations/013_remote_device_lists.sql
npx wrangler d1 execute my-matrix-db --remote --file=migrations/014_appservice.sql
npx wrangler d1 execute my-matrix-db --remote --file=migrations/015_identity_associations.sql
# Critical performance indexes for Sliding Sync
npx wrangler d1 execute my-matrix-db --remote --file=migrations/016_sliding_sync_indexes.sql
```

Each migration should complete with `"success": true`.

**Verify indexes are created**:
```bash
npx wrangler d1 execute my-matrix-db --remote --command="
  SELECT name FROM sqlite_master 
  WHERE type='index' AND name LIKE 'idx_%' 
  ORDER BY name;
"
```

Expected indexes include:
- `idx_room_memberships_user_membership`
- `idx_events_room_timestamp_desc`
- `idx_rooms_type_encrypted`
- `idx_room_tags_user_tag`
- `idx_direct_rooms_user`

## Step 5: Deploy

```bash
npm run deploy
```
Or directly:
```bash
npx wrangler deploy
```

The output will show your worker URL (e.g., `my-matrix-server.your-subdomain.workers.dev`).

## Step 6: Configure Your Domain

### Option A: Cloudflare Custom Domain (Recommended)
1. Go to **Cloudflare Dashboard**
2. Navigate to **Workers & Pages → Your Worker → Settings → Domains & Routes**
3. Click **Add → Custom Domain**
4. Enter your domain (e.g., `matrix.yourdomain.com`)
5. Cloudflare automatically configures DNS

### Option B: Manual DNS Setup
If using manual DNS, add these records:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | matrix | your-worker.workers.dev | Proxied |

### Required: .well-known Endpoints
Matrix clients and servers need `.well-known` endpoints. These are automatically served by the worker at:
- `https://matrix.yourdomain.com/.well-known/matrix/server`
- `https://matrix.yourdomain.com/.well-known/matrix/client`

### Federation DNS (For Server-to-Server Communication)
For full federation support, ensure your domain resolves correctly. The worker handles the `.well-known` responses automatically.

## Step 7: Verify Deployment

### 7.1 Check Basic Endpoints
```bash
# Replace with your domain
export MATRIX_SERVER="https://matrix.yourdomain.com"

# Check server is responding
curl -s "$MATRIX_SERVER/_matrix/client/versions" | jq .

# Check well-known endpoints
curl -s "$MATRIX_SERVER/.well-known/matrix/server" | jq .
curl -s "$MATRIX_SERVER/.well-known/matrix/client" | jq .

# Check federation keys
curl -s "$MATRIX_SERVER/_matrix/key/v2/server" | jq .

# Check federation version
curl -s "$MATRIX_SERVER/_matrix/federation/v1/version" | jq .
```

### 7.2 Run Federation Tester
Visit the Matrix Federation Tester:
```
https://federationtester.matrix.org/api/report?server_name=matrix.yourdomain.com
```
Look for `"FederationOK": true` in the response.

### 7.3 Performance Verification
Test your Sliding Sync performance (requires an access token):
```bash
# Measure initial sync time
time curl -s -X POST "$MATRIX_SERVER/_matrix/client/v1/sync" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"lists": {"rooms": {"ranges": [[0, 99]]}}}'

# Check for performance logs
npx wrangler tail --format pretty
```

### 7.4 Verify E2EE Keys are in Durable Objects
```bash
# Query device keys (should work without any KV namespaces)
curl -s -X POST "$MATRIX_SERVER/_matrix/client/v3/keys/query" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"device_keys": {"@youruser:domain.com": []}}' | jq .
```

### 7.5 Register Your First User
```bash
curl -X POST "$MATRIX_SERVER/_matrix/client/v3/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-secure-password",
    "auth": {
      "type": "m.login.dummy"
    }
  }'
```

### 7.6 Test with Element
1. Open [Element Web](https://app.element.io)
2. Click **Sign In → Edit homeserver**
3. Enter your server URL: `https://matrix.yourdomain.com`
4. Sign in with your registered user

---

## ⚡ Performance Optimizations

The `dev` branch includes significant performance improvements for Sliding Sync, which powers fast sync in Element X and other modern Matrix clients.

### Key Optimizations

| Feature | Description | Benefit |
|---------|-------------|---------|
| **Parallel List Processing** | Processes sync lists concurrently with controlled limits (default: 5) | 2-5x faster multi-list syncs |
| **Intelligent Room Caching** | KV cache for room summaries with 30-second TTL and staleness checks | 50-80% fewer D1 queries |
| **Pre-computed Lists** | Common lists (invites, DMs, favourites) cached for 5 minutes | 70% faster initial sync |
| **Streaming Responses** | Progressive NDJSON responses using `TransformStream` | Better perceived performance |
| **Priority Connection Pooling** | Smart D1 connection management with high-priority reservations | 30% latency reduction under load |
| **Performance Monitoring** | Built-in metrics for p95 latency and slow sync detection (>1000ms) | Better observability |

### Architecture

The Sliding Sync module has been refactored into focused components:

```
src/api/sliding-sync/
├── optimized-sync.ts       # Parallel list processing with concurrency control
├── caching-strategy.ts     # Room summary caching with TTL and batch fetching
├── precomputed-lists.ts    # Pre-computed room lists for fast initial sync
├── streaming-response.ts   # Progressive NDJSON streaming responses
├── d1-pool.ts              # Priority-based D1 connection pooling
└── performance-monitor.ts  # Metrics tracking and slow sync detection
```

### Configuration Options

You can tune these optimizations via environment variables in your Worker settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `SLIDING_SYNC_MAX_CONCURRENT_LISTS` | 5 | Maximum lists to process in parallel |
| `SLIDING_SYNC_CACHE_TTL_MS` | 30000 | Room cache TTL in milliseconds |
| `SLIDING_SYNC_ROOM_BATCH_SIZE` | 50 | Rooms per D1 batch query |
| `SLIDING_SYNC_PRECOMPUTE_TTL` | 300 | Pre-computed list cache TTL in seconds |
| `SLIDING_SYNC_SLOW_THRESHOLD_MS` | 1000 | Threshold for slow sync logging |

To set these:
1. Go to **Cloudflare Dashboard → Workers & Pages → Your Worker**
2. Navigate to **Settings → Variables**
3. Add each variable under **Environment Variables**
4. Click **Save and Deploy**

### Monitoring Performance

Use `wrangler tail` to monitor sync performance in real-time:
```bash
npx wrangler tail
```

Look for logs like:
- `Slow sync for @user:domain.com: 2345ms with 4 lists` (when sync exceeds threshold)
- Performance metrics are automatically collected and can be viewed in the Cloudflare dashboard under **Workers & Pages → Your Worker → Metrics**

---

## 🔄 Migrating E2EE Keys from KV to Durable Objects

If you are upgrading an existing deployment that previously used KV namespaces for E2EE keys (`DEVICE_KEYS`, `ONE_TIME_KEYS`, `CROSS_SIGNING_KEYS`), follow these steps to migrate your data to Durable Objects.

### Why Migrate?

| Storage | Consistency Model | Risk |
|---------|------------------|------|
| KV | Eventually consistent | One-time keys could be double-claimed; device lists could be out-of-sync |
| Durable Objects | Strongly consistent (SQLite transactions) | Atomic operations guarantee key integrity |

### Pre-Migration Checklist
- [ ] Back up your D1 database (automatic via Cloudflare)
- [ ] Note your current worker version
- [ ] Schedule a maintenance window (migration takes < 1 minute per user)

### Step-by-Step Migration

1. **Update your code** to the latest `dev` branch:
   ```bash
   git pull origin dev
   npm install
   ```

2. **Update your `wrangler.jsonc`** to include the Durable Objects binding (as shown in Step 3.5) and remove the E2EE KV bindings.

3. **Run the migration script** for each user (or use the bulk migration tool):
   ```bash
   # For a single user
   npx wrangler run scripts/migrate-kv-to-do.ts -- --user @user:domain.com
   
   # For all users (will iterate through user list - requires user list to be accessible)
   npx wrangler run scripts/migrate-kv-to-do.ts
   ```

4. **Verify migration** by checking a user's keys:
   ```bash
   # Query the Durable Object through the standard API
   curl -X POST "$MATRIX_SERVER/_matrix/client/v3/keys/query" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"device_keys": {"@user:domain.com": []}}'
   ```

5. **Test one-time key claiming** to ensure atomicity:
   ```bash
   # This should work exactly once per key
   curl -X POST "$MATRIX_SERVER/_matrix/client/v3/keys/claim" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"one_time_keys": {"@user:domain.com": {"DEVICEID": "signed_curve25519"}}}'
   ```

6. **After confirming all users are migrated**, you can safely remove the old KV namespaces:
   ```bash
   npx wrangler kv namespace delete DEVICE_KEYS
   npx wrangler kv namespace delete ONE_TIME_KEYS
   npx wrangler kv namespace delete CROSS_SIGNING_KEYS
   ```

### Rollback Plan
If issues are detected during migration:
1. Keep the old KV namespaces intact (do not delete them)
2. Revert to your previous worker version that uses KV
3. The system will fall back to reading from KV if Durable Objects data is incomplete
4. Investigate and retry migration after fixing issues

---

## Optional Features

### TURN Server (For Voice/Video Calls)
Cloudflare provides TURN servers. To enable:
1. Go to **Cloudflare Dashboard → Calls → TURN**
2. Create a TURN key
3. Add to `wrangler.jsonc`:
   ```json
   "vars": {
     "TURN_KEY_ID": "your-turn-key-id"
   }
   ```
4. Set the secret:
   ```bash
   npx wrangler secret put TURN_API_TOKEN
   # Paste your TURN API token when prompted
   ```

### LiveKit (For MatrixRTC Video Calls)
If you have a LiveKit server:
1. Add to `wrangler.jsonc`:
   ```json
   "vars": {
     "LIVEKIT_API_KEY": "your-api-key",
     "LIVEKIT_URL": "wss://your-livekit-server.com"
   }
   ```
2. Set the secret:
   ```bash
   npx wrangler secret put LIVEKIT_API_SECRET
   ```

### APNs Push Notifications (iOS)
For direct Apple Push Notification support:
```bash
npx wrangler secret put APNS_KEY_ID      # From Apple Developer Portal
npx wrangler secret put APNS_TEAM_ID     # Your Apple Team ID
npx wrangler secret put APNS_PRIVATE_KEY # Contents of .p8 file
```

### OIDC Authentication
For OpenID Connect login:
```bash
npx wrangler secret put OIDC_ENCRYPTION_KEY
# Generate with: openssl rand -base64 32
```

## Troubleshooting

### "Workers Paid plan required"
Durable Objects require the Workers Paid plan ($5/month). Upgrade at: **Cloudflare Dashboard → Workers & Pages → Plans**

### "Database not found"
Ensure you've run all migrations and the database name in `wrangler.jsonc` matches what you created.

### Federation Test Fails
- Verify your domain's DNS is managed by Cloudflare
- Check `.well-known/matrix/server` returns correct content
- Ensure the worker is deployed and responding
- Check the signing key is generated (first request auto-generates it)

### "M_UNKNOWN" Errors
Check Cloudflare Workers logs:
```bash
npx wrangler tail
```

### Registration Disabled
Registration is enabled by default. If you've disabled it and need to create an admin:
```bash
# Connect to D1 directly
npx wrangler d1 execute my-matrix-db --remote --command "SELECT * FROM users LIMIT 5"
```

### Rate Limited
The server has rate limiting. Default limits:
- Login: 10 requests/minute
- Register: 5 requests/minute
- General API: 100 requests/minute

### Slow Sync Performance
If you experience slow sync times:
1. Verify all indexes are created (see Step 4 verification)
2. Check `wrangler tail` for slow sync logs
3. Adjust cache TTL or concurrency settings via environment variables
4. Ensure you're on the Workers Paid plan (required for Durable Objects)

### E2EE Key Errors
If users report encryption failures:
1. Verify Durable Objects are properly deployed: `npx wrangler deploy --dry-run --outdir=dist`
2. Check that `USER_KEYS_DO` binding is correctly configured
3. Ensure old KV namespaces are not being used (they should be deleted or ignored)

## Updating

To update your deployment:
```bash
git pull
npm install
npm run deploy
```

If there are new migrations, run them before deploying:
```bash
npx wrangler d1 execute my-matrix-db --remote --file=migrations/NEW_MIGRATION.sql
```

## Architecture Overview

Your deployed Matrix server uses:

| Component | Cloudflare Service | Purpose | Consistency Model |
|-----------|-------------------|---------|-------------------|
| API & Routing | Workers | HTTP request handling | N/A |
| Database | D1 | Users, rooms, events, messages | Strong (SQLite) |
| Sessions | KV | Access tokens, fast lookups | Eventually consistent |
| **E2EE Keys** | **Durable Objects** | **Device keys, one-time keys, cross-signing** | **Strong (SQLite transactions)** |
| Media Storage | R2 | Files, avatars, thumbnails | Strong |
| Real-time Sync | Durable Objects | Sliding sync connection state | Strong |
| Caching | KV | Room summaries, pre-computed lists | Eventually consistent |
| Workflows | Workflows | Long-running tasks (joins, pushes) | N/A |

> **Key Benefit**: By moving E2EE keys from KV to Durable Objects, we ensure that one-time keys are claimed atomically (no double-claims), device key lists are always consistent, and cross-signing signatures are properly validated - all critical for end-to-end encryption security.

---