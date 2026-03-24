-- Migration 006: Secure Server Keys
-- Ensures server_keys table has proper versioning and indexes
-- Note: private_key_jwk and key_version columns already exist in base schema

-- Mark existing keys without version as version 1 (legacy)
UPDATE server_keys SET key_version = 1 WHERE key_version IS NULL OR key_version = 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_server_keys_version ON server_keys(key_version);
