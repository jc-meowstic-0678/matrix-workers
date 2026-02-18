// Cloudflare Workers Environment Types

export interface Env {
  // D1 Database
  DB: D1Database;

  // KV Namespaces - Only 3 remaining (E2EE keys moved to Durable Objects)
  SESSIONS: KVNamespace;    // Session tokens
  CACHE: KVNamespace;       // Room summaries, precomputed lists
  ACCOUNT_DATA: KVNamespace; // User account data

  // R2 Bucket
  MEDIA: R2Bucket;

  // Durable Objects
  ROOMS: DurableObjectNamespace;
  SYNC: DurableObjectNamespace;
  FEDERATION: DurableObjectNamespace;
  ADMIN: DurableObjectNamespace;
  USER_KEYS_DO: DurableObjectNamespace;
  PUSH: DurableObjectNamespace;
  RATE_LIMIT: DurableObjectNamespace;
  DEVICE_KEYS: DurableObjectNamespace;
  CROSS_SIGNING_KEYS: DurableObjectNamespace;

  // Environment variables
  SERVER_NAME: string;
  SERVER_VERSION: string;

  // Support contact info (optional)
  ADMIN_CONTACT_EMAIL?: string;
  ADMIN_CONTACT_MXID?: string;
  SUPPORT_PAGE_URL?: string;

  // Secrets (to be configured)
  SIGNING_KEY?: string;
  ADMIN_PASSWORD_HASH?: string; // Add this for admin dashboard

  // OIDC encryption key for client secrets (32 random bytes, base64 encoded)
  OIDC_ENCRYPTION_KEY?: string;

  // Cloudflare TURN Server Configuration
  TURN_KEY_ID?: string;
  TURN_API_TOKEN?: string;

  // Cloudflare Calls Configuration (native video calling)
  CALLS_APP_ID?: string;
  CALLS_APP_SECRET?: string;

  // Durable Object for call signaling
  CALL_ROOMS?: DurableObjectNamespace;

  // Workers VPC Service binding for LiveKit
  LIVEKIT_API: Fetcher;

  // LiveKit Configuration for MatrixRTC
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  LIVEKIT_URL?: string;

  // APNs Direct Push Configuration (optional - bypasses Sygnal)
  APNS_KEY_ID?: string;
  APNS_TEAM_ID?: string;
  APNS_PRIVATE_KEY?: string;
  APNS_ENVIRONMENT?: string;

  // Cloudflare Workflows for durable multi-step operations
  ROOM_JOIN_WORKFLOW: Workflow;
  PUSH_NOTIFICATION_WORKFLOW: Workflow;

  // Email Service Configuration (Cloudflare Email Service)
  EMAIL?: SendEmail;
  EMAIL_FROM?: string;

  // Browser Rendering (for URL previews of JS-rendered pages)
  BROWSER?: Fetcher;

  // Analytics Engine (for server metrics)
  ANALYTICS?: AnalyticsEngineDataset;

  // Workers AI (for embeddings and content moderation)
  AI?: Ai;
}

// Variables set by middleware and available via c.get()
export type Variables = {
  userId: string;
  deviceId: string | null;
  accessToken: string;
  auth: {
    userId: string;
    deviceId: string | null;
    accessToken: string;
  };
  isAdmin?: boolean; // Add this for admin checks
};

// Combined Hono app type with bindings and variables
export type AppEnv = {
  Bindings: Env;
  Variables: Variables;
};