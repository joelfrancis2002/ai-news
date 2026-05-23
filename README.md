# AI Newsroom

AI Newsroom is a monorepo for an automated AI news aggregation pipeline. The current codebase is no longer just a scaffold: it contains a working database schema, a cron-driven worker pipeline, a Fastify API, and a React admin dashboard.

The project is currently at an MVP integration stage. Core pipeline logic exists, but some frontend screens still use mock data or expect API routes that are not implemented yet.

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

Still incomplete or inconsistent:

- Some frontend pages use mock data instead of live API data
- Some frontend screens expect API endpoints that do not exist yet
- BullMQ queue scaffolding exists, but the active runtime uses direct cron execution
- Review, publishing, and fact-check workflows are only partially represented

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

Important note:

- Some frontend pages currently expect additional endpoints such as health, article list/detail, and summaries. Those are not fully implemented in the current backend route file yet.

## Worker Runtime

The active worker process currently runs in direct pipeline mode:

- Reads enabled sources from the database
- Ingests feed items
- Embeds articles with status `fetched`
- Clusters articles with status `embedded`
- Summarizes clusters without existing summaries

Default schedule:

- `INGEST_CRON=*/15 * * * *`

Queue-related code exists in `packages/workers/src/queues.ts`, but that is not the active execution path right now.

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

- Part of the UI uses `src/services/api.ts`
- Another part uses `src/lib/api.ts`
- These two clients expect different response shapes
- `SourcesPage` still uses mock data

## Build Status

The repository builds cleanly end-to-end. Running `npm run build` from the root workspace compiles all packages and apps (shared, database, workers, ai, api, web) sequentially without any TypeScript errors.

## Recommended Next Steps

High-priority cleanup:

1. Unify frontend API clients into one contract
2. Implement missing API routes required by the dashboard
3. Replace mock source management with live backend integration
4. Decide whether to keep direct cron mode or complete the BullMQ queue path

Product completion:

1. Finish review decision workflow
2. Finish publishing workflow
3. Improve fact-checking beyond simple confidence heuristics
4. Add tests for API, workers, and frontend integration
5. Add monitoring and error reporting

## Summary

This project is now a real MVP codebase for AI news aggregation, not just a starter repo. The backend pipeline is substantially implemented. The main work left is integration hardening, missing API coverage, removal of mocks, and product completion.
