import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env"), override: true });

import Fastify, { type FastifyInstance } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { PrismaClient } from "@prisma/client";
import routes from "./routes.js";

// ─── Fail-Fast Environment Validation ────────────────────────────────────────
function validateEnv() {
  const required = ["AUTH_SECRET", "DATABASE_URL"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `\n[STARTUP ERROR] Missing required environment variables:\n` +
      missing.map((key) => `  - ${key}`).join("\n") +
      "\n\nCheck your .env file or environment configuration.\n",
    );
    process.exit(1);
  }

  if ((process.env.AUTH_SECRET?.length ?? 0) < 32) {
    console.error(
      "\n[STARTUP ERROR] AUTH_SECRET is too short. Use a 64+ character random string.\n" +
      "Generate: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"\n",
    );
    process.exit(1);
  }
}

validateEnv();

// ─── Prisma type augmentation ─────────────────────────────────────────────────
declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// ─── Singleton Prisma client ──────────────────────────────────────────────────
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

// ─── Build app ────────────────────────────────────────────────────────────────
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // 1. CORS
  const rawOrigins = process.env.ALLOWED_ORIGINS ?? "";
  const allowlist = new Set(
    rawOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  );

  const isDevelopment = process.env.NODE_ENV === "development";
  if (isDevelopment) {
    for (const port of ["5173", "5174", "5175"]) {
      allowlist.add(`http://localhost:${port}`);
      allowlist.add(`http://127.0.0.1:${port}`);
    }
  }

  await app.register(cors, {
    origin: (origin: string | undefined, callback) => {
      const allowed = !origin || allowlist.has(origin);
      if (!allowed && isDevelopment) {
        app.log.warn({ origin }, "cors_origin_blocked");
      }
      callback(null, allowed);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With"],
    credentials: true,
  });

  // 2. Sensible (httpErrors helpers)
  await app.register(sensible);

  // 3. Decorate with Prisma before routes need it
  app.decorate("prisma", prisma);

  // 4. Disconnect Prisma on server close
  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  // 5. Global error handler — RFC 7807 shape
  app.setErrorHandler((error: unknown, _request, reply) => {
    const maybeError = error as { statusCode?: number; name?: string; message?: string };
    const statusCode = maybeError.statusCode ?? 500;
    app.log.error({ err: error, statusCode }, "request_error");
    return reply.code(statusCode).send({
      statusCode,
      error: maybeError.name ?? "Error",
      message: maybeError.message ?? "Unexpected error",
    });
  });

  // 6. Routes under /api prefix
  await app.register(routes, { prefix: "/api" });

  return app;
}
