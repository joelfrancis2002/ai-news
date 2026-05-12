import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";

export const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@newsroom.ai";
export const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";
export const DEFAULT_ADMIN_NAME = process.env.ADMIN_NAME ?? "Admin";
const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 7);

function authSecret(): string {
  return process.env.AUTH_SECRET ?? `${DEFAULT_ADMIN_EMAIL}:${DEFAULT_ADMIN_PASSWORD}`;
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
  email: string;
  role: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

export function issueAuthToken(payload: JwtPayload): string {
  return jwt.sign(payload, authSecret(), {
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

export function verifyAuthToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, authSecret()) as JwtPayload;
  } catch (error) {
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
