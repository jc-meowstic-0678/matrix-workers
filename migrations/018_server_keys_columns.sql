-- Migration 018: Add server_keys columns for federation
-- Adds private_key_jwk and key_version columns to server_keys table

-- Add private_key_jwk column for storing JSON Web Key format
ALTER TABLE server_keys ADD COLUMN private_key_jwk TEXT;

-- Add key_version column for versioning signing keys
ALTER TABLE server_keys ADD COLUMN key_version INTEGER DEFAULT 2;

-- Copy existing private_key data to private_key_jwk if private_key is not empty
-- This is a placeholder since the actual JWK format is different from legacy
-- The new key generation will populate this correctly
