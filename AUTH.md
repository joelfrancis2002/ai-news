# Authentication Architecture

## Active System

The project uses a simple stateless JWT auth system built with:
- `jsonwebtoken` for token signing and verification
- Node `crypto` for password hashing and verification
- Fastify `preHandler` hooks (`requireAuth`) for route protection
- React Context (`AuthContext`) for frontend auth state

### Key Files

| File | Role |
|------|------|
| `apps/api/src/auth.ts` | JWT sign/verify, password hash/verify, requireAuth hook |
| `apps/api/src/routes.ts` | Auth routes: `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` |
| `apps/web/src/context/AuthContext.tsx` | Frontend auth state, login/logout/hydrate |
| `apps/web/src/pages/LoginPage.tsx` | Login UI |

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | Yes | JWT signing secret, 64+ chars random |
| `DATABASE_URL` | Yes | Database connection string |
| `ALLOW_FIRST_USER_BOOTSTRAP` | Setup only | Set `true` to allow first admin auto-creation |
| `ADMIN_EMAIL` | Bootstrap only | Email for the first admin user |
| `ADMIN_PASSWORD` | Bootstrap only | Password for the first admin user |
| `ADMIN_NAME` | Optional | Display name for first admin (default: `Admin`) |

## Creating the First Admin User

### Option A — Bootstrap Mode

1. Set in your `.env`:
   ```
   ALLOW_FIRST_USER_BOOTSTRAP=true
   ADMIN_EMAIL=you@example.com
   ADMIN_PASSWORD=a-strong-password
   AUTH_SECRET=<64 char random string>
   DATABASE_URL=<your database url>
   ```
2. Start the API server.
3. `POST /auth/login` with the configured credentials. If no users exist, the admin is created.
4. Remove `ALLOW_FIRST_USER_BOOTSTRAP` from the environment immediately after setup.

### Option B — Seed Script

Create the first user through a database seed or migration flow before starting the UI.

## Auth Flow

```text
Login:    POST /auth/login  -> { token, user } -> stored in localStorage
Hydrate:  GET /auth/me      -> { user }        -> rehydrates React context on refresh
Logout:   POST /auth/logout -> { success }     -> clear localStorage -> navigate to /login
```

## Deprecated / Archived Code

An advanced auth system with service abstractions and refresh token support was
archived to `apps/api/src/_deprecated_auth/`.

Unused Axios-based frontend auth helpers were archived to `apps/web/_deprecated_auth/`.
