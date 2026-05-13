/**
 * @file apps/api/src/lib/password.ts
 * Password hashing and verification using bcrypt
 * Replaces crypto.scryptSync for production-grade security
 */

import bcrypt from 'bcrypt';

// Use 12 rounds for balanced security/performance
// Production recommendation: 12-14 rounds
const SALT_ROUNDS = 12;

/**
 * Hash password using bcrypt
 * @param password Plain text password
 * @returns Hashed password
 * @throws Error if hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    return await bcrypt.hash(password, SALT_ROUNDS);
  } catch (error) {
    throw new Error(`Password hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify password against stored hash
 * @param password Plain text password to verify
 * @param hash Stored bcrypt hash
 * @returns True if password matches hash
 * @throws Error if verification fails
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    throw new Error(`Password verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a hash is in bcrypt format
 * Useful for migrations from older password systems
 * @param hash Password hash to check
 * @returns True if hash is bcrypt format
 */
export function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash);
}
