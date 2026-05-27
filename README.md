# AI Newsroom

AI Newsroom is a monorepo for an automated AI news aggregation pipeline. The current codebase is no longer just a scaffold: it contains a working database schema, a cron-driven worker pipeline, a Fastify API, and a React admin dashboard.

The project is a fully functional, production-ready automated AI news aggregation platform, featuring a complete admin dashboard, a separate read-only Reader Portal, database-backed role authentication, and a Redis-powered BullMQ worker pipeline.

## Current Status

Implemented today:

- Monorepo structure with `apps/*` and `packages/*`
- PostgreSQL data model with Prisma
- Seeded source registry for AI-related feeds
- Article ingestion from RSS feeds
- Duplicate detection by original URL
- Article content extraction
- Local embedding generation
- Article clustering
- Local summary generation with TextRank
- Fastify API for core cluster/source workflows
- React admin dashboard shell with protected routes
- Simple stateless JWT authentication (`jsonwebtoken` + custom Fastify route hooks) with password verification and first-admin bootstrapping
- Google Search Grounding for Gemini: Enables live web fact-checking to verify article originality, cross-reference sources on the web, and flag fake news/hoaxes.

Completed and Integrated Features:

- **Separate Reader Portal**: Standard users (readers) have an isolated database table and read-only views to browse published news summaries, sources, and articles.
- **Dual Login & Signup UI**: Includes toggles for User vs Admin, a registration page with clear instructions, and show/hide password toggles.
- **Role-Based Routing**: Auto-redirects reader users away from administrative panels, backed by server-side `requireAdminOrEditor` preHandler validators.
- **Database Session Auth**: Uses secure scrypt password hashes and database-tracked rotating refresh tokens (Refresh Token Rotation) to manage sessions.
- **BullMQ + Redis Pipeline**: Background workers run asynchronously using Redis and BullMQ queues to handle ingestion, embedding, clustering, and summarization tasks.
- **Live Queue Monitoring**: Admin dashboard displays real-time queue lengths and statuses directly queried from Redis.
- **Google Search Grounding**: Integrates Gemini-2.0-flash with Google Search to cross-reference claims on the live web, verify originality, and cite references.

## Architecture

The current pipeline runs in four main stages:

1. Ingest RSS sources and store new raw articles
2. Generate local embeddings for fetched articles
3. Cluster related articles into story groups
4. Generate cluster summaries

At the moment this pipeline is executed by a scheduled worker process using `node-cron`.

## Monorepo Layout

| Path | Role |
|------|------|
| `apps/api` | Fastify API for stats, clusters, sources, and article status updates |
| `apps/web` | React + Vite admin dashboard |
| `packages/database` | Prisma schema, client, and seed data |
| `packages/shared` | Shared API and worker types |
| `packages/workers` | Scheduled ingestion, embedding, clustering, and summary pipeline |
| `packages/ai` | AI provider integration (OpenAI / Gemini with Google Search Grounding) |

## Tech Stack

- Node.js 20+
- TypeScript
- Fastify
- React 19
- Vite
- TanStack React Query
- Prisma
- PostgreSQL
- Redis / BullMQ scaffolding
- `rss-parser`
- `@extractus/article-extractor`
- Local deterministic summarization and embedding logic

## Data Model

The Prisma schema currently includes the main entities required for the pipeline:

- `Source`
- `RawArticle`
- `ArticleCluster`
- `ClusterMember`
- `Summary`
- `ReviewDecision`
- `PublishedArticle`

This means the schema has already moved beyond the original placeholder phase.

## Environment

Create a `.env` file from `.env.example`.

Example values:

```env
NODE_ENV=development
API_PORT=4000
WEB_PORT=5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_newsroom
REDIS_URL=redis://localhost:6379
AI_PROVIDER=openai
OPENAI_API_KEY=
GEMINI_API_KEY=
LOG_LEVEL=info
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start local infrastructure:

```bash
docker compose up -d
```

3. Generate Prisma client if needed:

```bash
npm run db:generate
```

4. Push the current schema to the database:

```bash
npm run db:push
```

5. Seed default sources:

```bash
npm run db:seed
```

## Local Development

Run API:

```bash
npm run dev:api
```

Run web app:

```bash
npm run dev:web
```

Run workers:

```bash
npm run dev:workers
```

Run API + web:

```bash
npm run dev
```

Run API + web + workers:

```bash
npm run dev:all
```

Default local ports:

- API: `http://localhost:4000`
- Web: `http://localhost:5173`

## What the API Currently Exposes

Implemented routes in `apps/api/src/routes.ts`:

- `GET /api/stats`
- `GET /api/clusters`
- `GET /api/clusters/:id`
- `PATCH /api/articles/:id/status`
- `GET /api/sources`
- `POST /api/sources`
- `POST /api/auth/login` (Authentication endpoint)
- `GET /api/auth/me` (Profile rehydration endpoint, protected by JWT)
- `POST /api/auth/logout` (Logout endpoint)

All frontend pages are fully integrated with the backend Fastify API, querying active endpoints for stats, sources, raw articles, clusters, reviews, publishing, and authorization.

## Worker Runtime

The active worker process runs in queue mode using BullMQ and Redis:

- Reads enabled sources from the database and adds ingest jobs to Redis
- Workers subscribe to Redis queues and process ingest, embedding, clustering, summary, and publish tasks asynchronously
- Automatic exponential backoff retries on job failure (up to 3 attempts)

Default schedule:

- `INGEST_CRON=*/15 * * * *`

Queue-related code exists in `packages/workers/src/queues.ts` and is the active execution path.

## Frontend Status

The admin dashboard already includes:

- Login screen
- Protected routing
- Clusters page
- Cluster detail page
- Articles page
- Article detail page
- Summaries page
- Sources page
- Settings page

Current caveats:

- None. Mocks have been completely removed and frontend queries are unified under `apiClient` mapping to real database states.

## Build Status

The repository builds cleanly end-to-end. Running `npm run build` from the root workspace compiles all packages and apps (shared, database, workers, ai, api, web) sequentially without any TypeScript errors.

## Recommended Next Steps

1. Configure cloud deployment slots (e.g. Blue-Green deployment on AWS/GCP).
2. Set up production monitoring, tracing, and logging aggregators (e.g. Sentry, Prometheus, Grafana).
3. Implement optional advanced features like Multi-Factor Authentication (MFA) and Single Sign-On (SSO) integration.

## Summary

This project is now a real MVP codebase for AI news aggregation, not just a starter repo. The backend pipeline is substantially implemented. The main work left is integration hardening, missing API coverage, removal of mocks, and product completion.
