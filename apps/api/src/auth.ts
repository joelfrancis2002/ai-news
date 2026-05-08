import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@newsroom.ai";
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";
const DEFAULT_ADMIN_NAME = process.env.ADMIN_NAME ?? "Admin";
const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 7);

function authSecret(): string {
  return process.env.AUTH_SECRET ?? `${DEFAULT_ADMIN_EMAIL}:${DEFAULT_ADMIN_PASSWORD}`;
}

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

export function getAdminUser() {
  return {
    email: DEFAULT_ADMIN_EMAIL,
    password: DEFAULT_ADMIN_PASSWORD,
    name: DEFAULT_ADMIN_NAME,
  };
}

export function issueAuthToken(email: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${email}:${expiresAt}`;
  return `${base64Url(payload)}.${sign(payload)}`;
}

export function verifyAuthToken(token: string): { email: string } | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  if (sign(payload) !== signature) {
    return null;
  }

  const [email, expiresAtRaw] = payload.split(":");
  const expiresAt = Number(expiresAtRaw);
  if (!email || !Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return null;
  }

  if (email !== DEFAULT_ADMIN_EMAIL) {
    return null;
  }

  return { email };
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !verifyAuthToken(token)) {
    throw request.server.httpErrors.unauthorized("Authentication required");
  }
}
