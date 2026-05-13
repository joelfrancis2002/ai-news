/**
 * @file apps/api/src/lib/jwt-service.ts
 * JWT token management with separate access and refresh tokens
 * Replaces basic jwt.sign/verify with production patterns
 */

import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  roles: string[];
  permissions: string[];
  device_id: string;
  jti: string; // JWT ID for revocation
  iat: number; // issued at
  exp: number; // expires at
}

export interface RefreshTokenPayload {
  sub: string; // user ID
  session_id: string;
  device_id: string;
  iat: number;
  exp: number;
}

interface JwtConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiry: string; // "15m", "1h", etc.
  refreshTokenExpiry: string; // "7d", "30d", etc.
  issuer: string;
  audience: string;
}

/**
 * JWT Service for managing application tokens
 * - Access tokens: Short-lived (15 minutes)
 * - Refresh tokens: Long-lived (7 days)
 * - Device binding: Tokens tied to device fingerprint
 * - Token revocation: JTI-based revocation support
 */
export class JwtService {
  private config: JwtConfig;

  constructor(config: JwtConfig) {
    // Validate config
    if (!config.accessTokenSecret || config.accessTokenSecret.length < 32) {
      throw new Error('accessTokenSecret must be at least 32 bytes');
    }
    if (!config.refreshTokenSecret || config.refreshTokenSecret.length < 32) {
      throw new Error('refreshTokenSecret must be at least 32 bytes');
    }

    this.config = config;
  }

  /**
   * Issue an access token
   * Short-lived token for API authentication
   * @returns Token and expiry information
   */
  issueAccessToken(payload: {
    userId: string;
    email: string;
    roles: string[];
    permissions: string[];
    deviceId: string;
  }): { token: string; expiresIn: number; jti: string } {
    const jti = uuid();

    const signPayload: JwtPayload = {
      sub: payload.userId,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
      device_id: payload.deviceId,
      jti,
      iat: Math.floor(Date.now() / 1000),
      exp: 0, // Will be set by jwt.sign
    };

    const options: SignOptions = {
      expiresIn: this.config.accessTokenExpiry,
      issuer: this.config.issuer,
      audience: this.config.audience,
      algorithm: 'HS256',
    };

    const token = jwt.sign(signPayload, this.config.accessTokenSecret, options);

    // Decode to get actual expiry time
    const decoded = jwt.decode(token) as JwtPayload;
    const expiresIn = decoded.exp - decoded.iat;

    return { token, expiresIn, jti };
  }

  /**
   * Issue a refresh token
   * Long-lived token for obtaining new access tokens
   * @returns Token and expiry information
   */
  issueRefreshToken(payload: {
    userId: string;
    sessionId: string;
    deviceId: string;
  }): { token: string; expiresIn: number } {
    const signPayload: RefreshTokenPayload = {
      sub: payload.userId,
      session_id: payload.sessionId,
      device_id: payload.deviceId,
      iat: Math.floor(Date.now() / 1000),
      exp: 0, // Will be set by jwt.sign
    };

    const options: SignOptions = {
      expiresIn: this.config.refreshTokenExpiry,
      issuer: this.config.issuer,
      algorithm: 'HS256',
    };

    const token = jwt.sign(signPayload, this.config.refreshTokenSecret, options);

    // Decode to get actual expiry time
    const decoded = jwt.decode(token) as RefreshTokenPayload;
    const expiresIn = decoded.exp - decoded.iat;

    return { token, expiresIn };
  }

  /**
   * Verify an access token
   * @returns Payload if valid, null if invalid
   */
  verifyAccessToken(token: string): {
    payload: JwtPayload | null;
    valid: boolean;
    error?: 'expired' | 'invalid' | 'malformed';
  } {
    try {
      const options: VerifyOptions = {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: ['HS256'],
      };

      const payload = jwt.verify(token, this.config.accessTokenSecret, options) as JwtPayload;
      return { payload, valid: true };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { payload: null, valid: false, error: 'expired' };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        if (error.message.includes('malformed')) {
          return { payload: null, valid: false, error: 'malformed' };
        }
      }
      return { payload: null, valid: false, error: 'invalid' };
    }
  }

  /**
   * Verify a refresh token
   * @returns Payload if valid, null if invalid
   */
  verifyRefreshToken(token: string): {
    payload: RefreshTokenPayload | null;
    valid: boolean;
    error?: 'expired' | 'invalid';
  } {
    try {
      const options: VerifyOptions = {
        issuer: this.config.issuer,
        algorithms: ['HS256'],
      };

      const payload = jwt.verify(token, this.config.refreshTokenSecret, options) as RefreshTokenPayload;
      return { payload, valid: true };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { payload: null, valid: false, error: 'expired' };
      }
      return { payload: null, valid: false, error: 'invalid' };
    }
  }

  /**
   * Decode token without verification (unsafe - use only for debugging)
   * @returns Decoded payload or null if malformed
   */
  decodeWithoutVerify(token: string): JwtPayload | RefreshTokenPayload | null {
    try {
      return jwt.decode(token) as JwtPayload | RefreshTokenPayload | null;
    } catch {
      return null;
    }
  }

  /**
   * Get token expiry time
   * @returns Unix timestamp of expiry
   */
  getExpiryTime(token: string): number | null {
    const decoded = this.decodeWithoutVerify(token);
    return decoded?.exp ?? null;
  }

  /**
   * Get time until token expires
   * @returns Milliseconds until expiry
   */
  getTimeUntilExpiry(token: string): number {
    const expiry = this.getExpiryTime(token);
    if (!expiry) return 0;
    return Math.max(0, expiry * 1000 - Date.now());
  }

  /**
   * Check if token is about to expire
   * @param token Token to check
   * @param thresholdMs Milliseconds before expiry to consider "expiring"
   * @returns True if token will expire within threshold
   */
  isExpiringSoon(token: string, thresholdMs: number = 60000): boolean {
    return this.getTimeUntilExpiry(token) < thresholdMs;
  }
}
