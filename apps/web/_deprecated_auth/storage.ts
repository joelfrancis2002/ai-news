/**
 * @file apps/web/src/lib/storage.ts
 * Secure token and session storage with expiry validation
 * Handles localStorage with proper error handling and cleanup
 */

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

const STORAGE_KEY_TOKENS = 'ai-newsroom-tokens';
const STORAGE_KEY_USER = 'ai-newsroom-user';
const STORAGE_KEY_SESSION = 'ai-newsroom-session';

/**
 * Store tokens in localStorage with expiry
 * @param tokens Access and refresh tokens
 * @param expiresAt Optional override for expiry (default: 15 minutes)
 */
export function setStoredTokens(
  tokens: { accessToken: string; refreshToken: string },
  expiresAt?: number
): void {
  try {
    const stored: StoredTokens = {
      ...tokens,
      expiresAt: expiresAt || Date.now() + 15 * 60 * 1000, // 15 minutes default
    };

    localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(stored));
  } catch (error) {
    console.error('[Storage] Failed to store tokens:', error);
    // Continue even if storage fails (might be in private mode)
  }
}

/**
 * Retrieve tokens from localStorage
 * Returns null if missing, expired, or invalid
 */
export function getStoredTokens(): StoredTokens | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_TOKENS);
    if (!stored) return null;

    const tokens = JSON.parse(stored) as StoredTokens;

    // Validate structure
    if (!tokens.accessToken || !tokens.refreshToken || !tokens.expiresAt) {
      clearStoredAuth();
      return null;
    }

    // Check expiry (with 30-second buffer)
    if (tokens.expiresAt < Date.now() + 30000) {
      clearStoredAuth();
      return null;
    }

    return tokens;
  } catch (error) {
    console.error('[Storage] Failed to read tokens:', error);
    clearStoredAuth();
    return null;
  }
}

/**
 * Store user info in localStorage
 * @param user User object with id, email, name, roles, permissions
 */
export function setStoredUser(user: StoredUser): void {
  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  } catch (error) {
    console.error('[Storage] Failed to store user:', error);
  }
}

/**
 * Retrieve user from localStorage
 */
export function getStoredUser(): StoredUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_USER);
    if (!stored) return null;

    const user = JSON.parse(stored) as StoredUser;

    // Validate structure
    if (!user.id || !user.email || !Array.isArray(user.roles)) {
      clearStoredAuth();
      return null;
    }

    return user;
  } catch (error) {
    console.error('[Storage] Failed to read user:', error);
    clearStoredAuth();
    return null;
  }
}

/**
 * Store session ID
 * Used for logout and token refresh operations
 */
export function setStoredSession(sessionId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_SESSION, sessionId);
  } catch (error) {
    console.error('[Storage] Failed to store session:', error);
  }
}

/**
 * Retrieve session ID
 */
export function getStoredSession(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_SESSION);
  } catch (error) {
    console.error('[Storage] Failed to read session:', error);
    return null;
  }
}

/**
 * Clear all authentication data
 * Called on logout or auth failure
 */
export function clearStoredAuth(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_TOKENS);
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_SESSION);
  } catch (error) {
    console.error('[Storage] Failed to clear auth:', error);
  }
}

/**
 * Check if user is locally authenticated
 * Does NOT validate with server - use for UI state only
 */
export function isLocallyAuthenticated(): boolean {
  try {
    const tokens = getStoredTokens();
    const user = getStoredUser();
    return !!(tokens && user);
  } catch {
    return false;
  }
}

/**
 * Get time until token expires in seconds
 * Useful for scheduling automatic refresh
 */
export function getTokenTimeToLive(): number {
  try {
    const tokens = getStoredTokens();
    if (!tokens) return 0;
    return Math.max(0, (tokens.expiresAt - Date.now()) / 1000);
  } catch {
    return 0;
  }
}

/**
 * Check if token is expiring soon
 * @param thresholdSeconds Consider expiring if less than this many seconds remain
 */
export function isTokenExpiringSoon(thresholdSeconds: number = 60): boolean {
  return getTokenTimeToLive() < thresholdSeconds;
}
