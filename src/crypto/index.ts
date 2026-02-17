// Crypto utilities for E2EE and password hashing
// This file exports crypto-related utilities for the application

// ============================================
// Password Hashing (PBKDF2-SHA256)
// ============================================

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

/**
 * Generate a random salt
 */
export async function generateSalt(): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return btoa(String.fromCharCode(...salt));
}

/**
 * Hash a password using PBKDF2-SHA256 (matches your user password hashing)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await generateSalt();
  const encoder = new TextEncoder();
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    HASH_LENGTH * 8
  );
  
  const hashArray = new Uint8Array(hashBuffer);
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  
  // Store as salt:hash format
  return `${salt}:${hashBase64}`;
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  
  const encoder = new TextEncoder();
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    HASH_LENGTH * 8
  );
  
  const hashArray = new Uint8Array(hashBuffer);
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  
  return hashBase64 === originalHash;
}

// ============================================
// Other crypto utilities (existing)
// ============================================

// ... (keep your existing E2EE crypto functions here)