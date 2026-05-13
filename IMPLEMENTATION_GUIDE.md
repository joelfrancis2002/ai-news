# AI Newsroom - Implementation Guide

This guide provides step-by-step instructions to implement the architectural redesign from the technical audit.

## Quick Start Implementation

### Step 1: Update Environment Configuration

Create `.env.production`:

```env
# Environment
NODE_ENV=production
API_PORT=4000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://newsroom:YOUR_PASSWORD@postgres:5432/ai_newsroom

# Redis (for distributed sessions)
REDIS_URL=redis://:YOUR_PASSWORD@redis:6379

# Authentication
AUTH_SECRET=YOUR_SECRET_KEY_MIN_32_BYTES_LENGTH
JWT_ISSUER=ai-newsroom
JWT_AUDIENCE=ai-newsroom-api
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# CORS & URLs
WEB_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Logging
LOG_FORMAT=json

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

Generate secure AUTH_SECRET:
```bash
openssl rand -base64 32
```

### Step 2: Install New Dependencies

```bash
# Backend auth packages
npm install -w @ai-newsroom/api \
  bcrypt \
  axios \
  rate-limiter-flexible \
  pino \
  pino-pretty \
  zod \
  uuid

npm install -w @ai-newsroom/api -D \
  @types/bcrypt \
  @types/uuid

# Frontend packages
npm install -w @ai-newsroom/web \
  axios
```

### Step 3: Update Prisma Schema

Replace `packages/database/prisma/schema.prisma` with the new schema from the audit document.

Run migrations:
```bash
npm run db:generate
npm run db:push
```

### Step 4: Implement Backend Services

Create the following files:

1. `apps/api/src/lib/password.ts` - Password hashing
2. `apps/api/src/lib/jwt-service.ts` - JWT token management
3. `apps/api/src/services/auth.ts` - Authentication logic
4. `apps/api/src/middleware/auth.ts` - Auth middleware
5. `apps/api/src/middleware/rate-limit.ts` - Rate limiting
6. `apps/api/src/config/env.ts` - Environment validation
7. `apps/api/src/config/cors.ts` - CORS configuration
8. `apps/api/src/lib/logger.ts` - Structured logging

### Step 5: Update API Routes

Restructure `apps/api/src/routes.ts`:

```typescript
// Split into separate files
apps/api/src/routes/
├── auth.ts          # New auth endpoints
├── users.ts         # User management
├── articles.ts      # Existing article routes
├── clusters.ts      # Existing cluster routes
└── index.ts         # Route aggregation
```

Create new auth endpoints:
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

### Step 6: Update Frontend Auth

Replace:
1. `apps/web/src/lib/api.ts` - New API client with Axios
2. `apps/web/src/lib/storage.ts` - Token storage (new file)
3. `apps/web/src/context/AuthContext.tsx` - Redesigned auth context
4. `apps/web/src/pages/LoginPage.tsx` - Improved login page
5. `apps/web/src/components/ProtectedRoute.tsx` - Enhanced protection

### Step 7: Security Setup

1. Generate SSL certificates for production:
```bash
# Self-signed (development)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365

# Production: Use Let's Encrypt with Certbot
certbot certonly --standalone -d your-domain.com
```

2. Create `nginx.conf` from the audit document

3. Update Docker configuration with security best practices

### Step 8: Database Seeding

Update `packages/database/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create admin role
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrator with full access',
    },
  });

  // Create editor role
  const editorRole = await prisma.role.upsert({
    where: { name: 'editor' },
    update: {},
    create: {
      name: 'editor',
      description: 'Editorial staff',
    },
  });

  // Create permissions
  const permissions = [
    'articles:read',
    'articles:create',
    'articles:edit',
    'articles:delete',
    'clusters:read',
    'clusters:edit',
    'summaries:read',
    'summaries:edit',
    'sources:read',
    'sources:create',
    'sources:edit',
    'sources:delete',
    'users:manage',
    'admin:access',
  ];

  for (const code of permissions) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@newsroom.ai' },
    update: {},
    create: {
      email: 'admin@newsroom.ai',
      name: 'Administrator',
      passwordHash: adminPassword,
      emailVerified: new Date(),
      roles: {
        create: [{ roleId: adminRole.id }],
      },
    },
  });

  console.log('✅ Database seeded successfully');
  console.log(`   Admin user: ${adminUser.email}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Run seed:
```bash
npm run db:seed
```

### Step 9: Testing

Create test files:

```typescript
// Test login flow
describe('Authentication', () => {
  it('should login with valid credentials', async () => {
    const response = await api.post('/api/v1/auth/login', {
      email: 'admin@newsroom.ai',
      password: 'admin123',
    });

    expect(response.status).toBe(200);
    expect(response.data.tokens.accessToken).toBeDefined();
    expect(response.data.tokens.refreshToken).toBeDefined();
  });

  it('should refresh access token', async () => {
    // Login first
    const loginResponse = await api.post('/api/v1/auth/login', {
      email: 'admin@newsroom.ai',
      password: 'admin123',
    });

    // Refresh token
    const refreshResponse = await api.post('/api/v1/auth/refresh', {
      refreshToken: loginResponse.data.tokens.refreshToken,
    });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.data.accessToken).toBeDefined();
  });

  it('should reject expired token', async () => {
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkyMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    try {
      const response = await api.get('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      expect(response.status).not.toBe(200);
    } catch (error) {
      expect(error.response.status).toBe(401);
    }
  });
});
```

### Step 10: Deployment

#### Local Development

```bash
# Start all services
npm run dev:all

# Or separately
npm run dev:api
npm run dev:web
npm run dev:workers
```

#### Docker Deployment

```bash
# Build and start
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f api

# Run migrations
docker-compose -f docker-compose.prod.yml exec api npm run db:push
```

#### Kubernetes Deployment

See `k8s/` directory for Helm charts.

---

## Migration from Old System

### For Existing Users

Create a migration script to:

1. Hash all existing passwords with bcrypt
2. Create sessions for active users
3. Migrate roles to new RBAC system
4. Create audit logs for historical data

```typescript
// scripts/migrate-auth.ts
async function migrateUsers() {
  const users = await prisma.user.findMany();

  for (const user of users) {
    // Check if already hashed with bcrypt
    if (!user.passwordHash.startsWith('$2')) {
      // Re-hash with bcrypt
      const newHash = await bcrypt.hash(user.passwordHash, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
    }

    // Create initial session for active users
    if (user.lastLoginAt) {
      await prisma.session.create({
        data: {
          userId: user.id,
          deviceId: 'migrated',
          deviceName: 'Migrated Session',
          ipAddress: '0.0.0.0',
          userAgent: 'Migration Script',
          accessTokenJti: '',
          refreshTokenId: '',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  console.log('✅ User migration complete');
}
```

---

## Troubleshooting

### Issue: "Invalid token" on login

**Solution**: Ensure AUTH_SECRET is set consistently across all instances.

```bash
# Check if set
echo $AUTH_SECRET

# Set if missing
export AUTH_SECRET=$(openssl rand -base64 32)
```

### Issue: CORS errors when refreshing token

**Solution**: Ensure credentials are enabled in API client.

```typescript
// In axios client
api.defaults.withCredentials = true;
```

### Issue: Token expiry not being handled

**Solution**: Check token refresh interceptor is installed.

```typescript
// Verify in api.ts
api.interceptors.response.use(
  response => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Refresh logic here
    }
  }
);
```

### Issue: Database migration fails

**Solution**: Check Prisma setup and database connection.

```bash
# Test connection
npm run db:migrate -- --name test

# Check schema
npm run db:generate
```

---

## Performance Optimization

### Caching

Add Redis caching for frequently accessed data:

```typescript
// Implement cache decorator
export async function getCachedUser(userId: string) {
  const cached = await redis.get(`user:${userId}`);
  if (cached) return JSON.parse(cached);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  await redis.set(`user:${userId}`, JSON.stringify(user), 'EX', 3600);
  return user;
}
```

### Database Indexing

Ensure all indexes from schema are created:

```bash
npm run db:push
```

Key indexes added:
- `User.email` - For login lookups
- `Session.userId` - For session retrieval
- `LoginAttempt.email, ipAddress` - For rate limiting
- `AuditLog.userId, action, createdAt` - For audit queries

### Connection Pooling

Update database connection:

```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?schema=public&sslmode=require',
    },
  },
});
```

---

## Rollback Plan

If issues occur, rollback procedure:

```bash
# 1. Stop new deployment
docker-compose down

# 2. Restore from backup
pg_restore -d ai_newsroom backup.sql

# 3. Revert to previous API version
docker-compose -f docker-compose.yml up -d

# 4. Clear browser cache and cookies
# Users will need to re-login
```

---

## Monitoring Setup

### Essential Metrics

Track in your monitoring system:

```
- api_request_duration (histogram)
- auth_login_attempts (counter)
- auth_login_failures (counter)
- token_refresh_count (counter)
- session_count (gauge)
- db_query_duration (histogram)
```

### Alert Rules

```yaml
- name: HighFailureRate
  condition: auth_login_failures / auth_login_attempts > 0.1
  duration: 5m
  
- name: TooManyLoginAttempts
  condition: rate(auth_login_failures[5m]) > 10
  duration: 5m
  
- name: HighErrorRate
  condition: rate(api_errors[5m]) > 0.05
  duration: 5m
```

---

## Security Validation Checklist

Before going to production:

- [ ] AUTH_SECRET is 32+ bytes
- [ ] Database uses SSL/TLS
- [ ] Redis uses password and TLS
- [ ] All secrets in vault (not .env)
- [ ] HTTPS enforced
- [ ] HSTS header configured
- [ ] Rate limiting enabled
- [ ] CORS restricted to known origins
- [ ] Security headers set
- [ ] No hardcoded credentials
- [ ] Audit logging functional
- [ ] Error logging doesn't leak secrets
- [ ] Login rate limit working
- [ ] Account lockout working
- [ ] Token refresh working
- [ ] Logout revokes tokens
- [ ] Admin user password changed
- [ ] Backups configured
- [ ] Monitoring setup
- [ ] Alerts configured

---

## Next Steps

1. **Immediate** (Day 1-2):
   - Update environment config
   - Install dependencies
   - Run database migrations

2. **Short-term** (Week 1):
   - Implement backend auth services
   - Test auth endpoints
   - Update frontend auth

3. **Medium-term** (Week 2-3):
   - Deploy to staging
   - Run security tests
   - Load testing

4. **Production** (Week 4):
   - Gradual rollout
   - Monitor error rates
   - Support for existing users

---

For more details, see `TECHNICAL_AUDIT.md`.
