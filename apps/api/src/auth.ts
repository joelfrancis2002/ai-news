// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVE SIMPLE AUTH SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// This is the sole active authentication implementation for the API.
// It uses jsonwebtoken directly with Fastify route preHandlers.
//
// A more advanced auth system (with service abstractions and refresh tokens)
// was built but archived because it was incompatible with the current schema.
// See the deprecated auth README for historical context.
// ═══════════════════════════════════════════════════════════════════════════════
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";

const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS ?? 900); // 15 minutes
const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 7); // 7 days

// ─── Admin Bootstrap Credentials ─────────────────────────────────────────────
// These are REQUIRED only when ALLOW_FIRST_USER_BOOTSTRAP=true is set.
// They must never have fallback values. The app will throw on first use if missing.
export function getAdminBootstrapCredentials() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";

  if (!email || !password) {
    throw new Error(
      "[AUTH] ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required " +
      "when ALLOW_FIRST_USER_BOOTSTRAP=true. Set them in your .env file.",
    );
  }

  return { email, password, name };
}

// ─── JWT Secret ───────────────────────────────────────────────────────────────
// AUTH_SECRET is STRICTLY REQUIRED. The application will not start without it.
// Use a cryptographically random string of 64+ characters.
// Generate one with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
// ─────────────────────────────────────────────────────────────────────────────
function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "[AUTH] AUTH_SECRET environment variable is not set. " +
      "This is required for JWT signing. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
    );
  }
  if (secret.length < 32) {
    throw new Error(
      "[AUTH] AUTH_SECRET is too short (minimum 32 characters). " +
      "Use a random 64+ character string for security.",
    );
  }
  return secret;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === key;
}

export interface JwtPayload {
  userId: string;
  email?: string;
  userType: "admin" | "reader";
  role: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

export function issueAuthToken(payload: JwtPayload): string {
  return jwt.sign(payload, authSecret(), {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAuthToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, authSecret()) as JwtPayload;
  } catch (error) {
    return null;
  }
}

export function issueRefreshToken(payload: { userId: string; userType: "admin" | "reader" }): string {
  return jwt.sign(payload, authSecret(), {
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function verifyRefreshToken(token: string): { userId: string; userType: "admin" | "reader" } | null {
  try {
    return jwt.verify(token, authSecret()) as { userId: string; userType: "admin" | "reader" };
  } catch {
    return null;
  }
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  
  if (!token) {
    throw request.server.httpErrors.unauthorized("Authentication required");
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    throw request.server.httpErrors.unauthorized("Invalid or expired token");
  }

  request.user = payload;
}

export async function requireAdminOrEditor(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user) {
    await requireAuth(request, reply);
  }
  
  if (request.user.userType !== "admin" || (request.user.role !== "ADMIN" && request.user.role !== "EDITOR")) {
    throw request.server.httpErrors.forbidden("Forbidden: Admin or Editor access required");
  }
}
