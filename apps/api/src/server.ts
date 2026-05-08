// FILE: apps/api/src/server.ts

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { type FastifyInstance } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { PrismaClient } from "@prisma/client";
import routes from "./routes.js";

// ─── Prisma type augmentation ─────────────────────────────────────────────────

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// ─── Singleton Prisma client ──────────────────────────────────────────────────

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

// ─── Build app ────────────────────────────────────────────────────────────────

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // 1. CORS
  await app.register(cors, {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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

// ─── Start ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const app = await buildApp();
  const port = Number(process.env.API_PORT ?? 4000);

  try {
    await app.listen({ port, host: "0.0.0.0" });
    app.log.info(`API listening on http://0.0.0.0:${port}`);
  } catch (err) {
    app.log.error(err, "startup_failure");
    process.exit(1);
  }
}

void main();
