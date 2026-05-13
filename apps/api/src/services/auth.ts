/**
 * @file apps/api/src/services/auth.ts
 * Core authentication service with session management
 * Handles login, logout, token refresh, and security features
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { JwtService } from '../lib/jwt-service';
import { hashPassword, verifyPassword } from '../lib/password';

export interface DeviceInfo {
  ipAddress: string;
  userAgent: string;
  deviceName?: string;
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    name: string;
    roles: string[];
    permissions: string[];
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  sessionId: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken?: string;
}

/**
 * AuthService handles all authentication operations
 * - Login with rate limiting and account lockout
 * - Token issuance and refresh
 * - Session management
 * - Logout and token revocation
 * - Audit logging
 */
export class AuthService {
  private jwtService: JwtService;
  private prisma: PrismaClient;
  private tokenBlacklist: Set<string>; // In-memory for demo; use Redis in production
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 15;

  constructor(
    jwtService: JwtService,
    prisma: PrismaClient,
  ) {
    this.jwtService = jwtService;
    this.prisma = prisma;
    this.tokenBlacklist = new Set();
  }

  /**
   * Authenticate user and create session
   * @throws Error with descriptive message for client
   */
  async login(email: string, password: string, deviceInfo: DeviceInfo): Promise<LoginResult> {
    // Rate limiting by email
    const recentAttempts = await this.prisma.loginAttempt.count({
      where: {
        email,
        createdAt: {
          gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
        },
      },
    });

    if (recentAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      // Log failed attempt
      await this.prisma.loginAttempt.create({
        data: {
          email,
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent,
          success: false,
          failureReason: 'rate_limited',
        },
      });

      throw new Error('Too many login attempts. Please try again in 15 minutes.');
    }

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: { include: { role: true } },
        permissions: true,
      },
    });

    if (!user) {
      // Log failed attempt
      await this.prisma.loginAttempt.create({
        data: {
          email,
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent,
          success: false,
          failureReason: 'user_not_found',
        },
      });

      throw new Error('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesRemaining = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000
      );

      // Log failed attempt
      await this.prisma.loginAttempt.create({
        data: {
          userId: user.id,
          email,
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent,
          success: false,
          failureReason: 'account_locked',
        },
      });

      throw new Error(
        `Account is locked. Please try again in ${minutesRemaining} minutes.`
      );
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      // Increment login attempts
      const newAttempts = (user.loginAttempts ?? 0) + 1;

      const updateData: any = {
        loginAttempts: newAttempts,
        lastLoginAttempt: new Date(),
      };

      // Lock account if threshold reached
      if (newAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date();
        lockUntil.setMinutes(
          lockUntil.getMinutes() + this.LOCKOUT_DURATION_MINUTES
        );
        updateData.lockedUntil = lockUntil;
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      // Log failed attempt
      await this.prisma.loginAttempt.create({
        data: {
          userId: user.id,
          email,
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent,
          success: false,
          failureReason: 'invalid_password',
        },
      });

      throw new Error('Invalid credentials');
    }

    // Create session
    const deviceId = this.generateDeviceId(deviceInfo);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        deviceId,
        deviceName: deviceInfo.deviceName || this.parseUserAgent(deviceInfo.userAgent),
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        accessTokenJti: '', // Set after token creation
        refreshTokenId: '', // Set after token creation
        isActive: true,
      },
    });

    // Extract roles and permissions
    const roles = user.roles.map(ur => ur.role.name);
    const permissions = user.permissions.map(p => p.code);

    // Issue tokens
    const { token: accessToken, jti } = this.jwtService.issueAccessToken({
      userId: user.id,
      email: user.email,
      roles,
      permissions,
      deviceId,
    });

    const { token: refreshToken } = this.jwtService.issueRefreshToken({
      userId: user.id,
      sessionId: session.id,
      deviceId,
    });

    // Store token identifiers in session
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        accessTokenJti: jti,
        refreshTokenId: refreshToken,
      },
    });

    // Store refresh token record
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        token: refreshToken,
        deviceId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isRevoked: false,
      },
    });

    // Reset login attempts
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lastLoginAt: new Date(),
        lastLoginIp: deviceInfo.ipAddress,
        lockedUntil: null,
      },
    });

    // Log successful login
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth.login',
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        status: 'success',
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles,
        permissions,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
      sessionId: session.id,
    };
  }

  /**
   * Refresh access token using refresh token
   * Includes optional token rotation
   */
  async refreshAccessToken(
    refreshToken: string,
    sessionId: string,
  ): Promise<RefreshResult> {
    // Verify refresh token signature
    const { payload, valid } = this.jwtService.verifyRefreshToken(refreshToken);
    if (!valid) {
      throw new Error('Invalid refresh token');
    }

    if (!payload) {
      throw new Error('Invalid token payload');
    }

    // Find session
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            roles: { include: { role: true } },
            permissions: true,
          },
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Validate session is still active
    if (!session.isActive || session.revokedAt) {
      throw new Error('Session has been revoked');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { isActive: false, revokedAt: new Date() },
      });
      throw new Error('Session has expired');
    }

    // Verify device ID matches (prevent token theft)
    if (session.deviceId !== payload.device_id) {
      // Log suspicious activity
      await this.prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'auth.device_mismatch',
          status: 'failure',
          errorMessage: 'Device ID mismatch on token refresh',
        },
      });
      throw new Error('Device mismatch');
    }

    // Issue new access token
    const roles = session.user.roles.map(ur => ur.role.name);
    const permissions = session.user.permissions.map(p => p.code);

    const { token: newAccessToken, jti } = this.jwtService.issueAccessToken({
      userId: session.userId,
      email: session.user.email,
      roles,
      permissions,
      deviceId: session.deviceId,
    });

    // Update session last activity
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        lastActivityAt: new Date(),
        accessTokenJti: jti,
      },
    });

    // Log refresh
    await this.prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'auth.token_refresh',
        status: 'success',
      },
    });

    return {
      accessToken: newAccessToken,
    };
  }

  /**
   * Logout and revoke all tokens for session
   */
  async logout(sessionId: string, reason: string = 'logout'): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return; // Already logged out
    }

    // Revoke session and tokens
    const [, , , log] = await Promise.all([
      this.prisma.session.update({
        where: { id: sessionId },
        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { sessionId },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: reason,
        },
      }),
      // Add JTI to blacklist
      this.tokenBlacklist.add(session.accessTokenJti),
      this.prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'auth.logout',
          status: 'success',
        },
      }),
    ]);

    return log;
  }

  /**
   * Logout all sessions for a user (e.g., after password change)
   */
  async logoutAllSessions(userId: string, reason: string = 'logout_all'): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, isActive: true },
    });

    for (const session of sessions) {
      await this.logout(session.id, reason);
    }
  }

  /**
   * Check if access token has been revoked
   */
  isTokenBlacklisted(jti: string): boolean {
    return this.tokenBlacklist.has(jti);
  }

  /**
   * Add token JTI to blacklist (for immediate revocation)
   */
  blacklistToken(jti: string): void {
    this.tokenBlacklist.add(jti);
    // In production, also store in Redis with TTL
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveSessionsForUser(userId: string) {
    return this.prisma.session.findMany({
      where: {
        userId,
        isActive: true,
        revokedAt: null,
      },
      select: {
        id: true,
        deviceName: true,
        ipAddress: true,
        userAgent: true,
        lastActivityAt: true,
        createdAt: true,
      },
      orderBy: { lastActivityAt: 'desc' },
    });
  }

  /**
   * Revoke a specific session (user initiated)
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new Error('Session not found or unauthorized');
    }

    await this.logout(sessionId, 'user_revoked');
  }

  /**
   * Generate device ID from device info
   * Used to bind tokens to specific devices
   */
  private generateDeviceId(deviceInfo: DeviceInfo): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${deviceInfo.userAgent}:${deviceInfo.ipAddress}`)
      .digest('hex');
    return hash.substring(0, 16);
  }

  /**
   * Parse user agent to extract device name
   */
  private parseUserAgent(userAgent: string): string {
    if (!userAgent) return 'Unknown Device';

    // Simple parsing - could be more sophisticated
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Mobile')) return 'Mobile';

    return 'Unknown Device';
  }
}
