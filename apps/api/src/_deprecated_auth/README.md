# Deprecated Auth System

This folder contains the remains of an "advanced" auth system that was built
but never integrated with the active codebase.

## Why it was archived

- It was incompatible with the current Prisma schema
- It was never imported or used by any active route or service
- It introduced confusion alongside the working simple auth system in `src/auth.ts`

## What it was trying to do

- `services/auth.ts`: A service-layer abstraction for user auth logic
- `lib/jwt-service.ts`: A dedicated JWT service with refresh token support
- `lib/password.ts`: Bcrypt-based password helpers for the unfinished auth flow

## Current active auth system

See `apps/api/src/auth.ts` and the auth routes in `apps/api/src/routes.ts`.

## If you want to revive this

1. Align the Prisma schema to support refresh tokens
2. Wire up the service layer to the Fastify routes
3. Replace the simple auth.ts with these services
4. Update the frontend to use the axios client's interceptor-based refresh flow
