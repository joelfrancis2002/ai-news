# Complete Implementation Roadmap

## Executive Summary

This roadmap provides a step-by-step plan to transform the AI Newsroom platform from an unstable, single-server authentication system to a production-grade, scalable, secure architecture.

**Total Duration**: 6 weeks
**Team Size**: 2-3 developers
**Risk Level**: Medium (requires careful testing)

---

## Phase 1: Foundation & Planning (Week 1)

### Goal
Set up infrastructure, validate design, and prepare team

### Tasks

#### 1.1 Environment & Infrastructure Setup
- [ ] Create staging environment matching production architecture
- [ ] Set up Docker containers for PostgreSQL, Redis
- [ ] Configure development environment variables
- [ ] Set up Git branches (main, staging, develop)
- [ ] Configure CI/CD pipeline (GitHub Actions, GitLab CI, etc.)

**Deliverable**: Fully functional staging environment

**Checklist**:
```bash
# Run these commands to verify setup
docker-compose up -d
npm install
npm run db:generate
npm run db:push
npm run dev
```

#### 1.2 Dependency Installation
- [ ] Add backend packages:
  ```bash
  npm install -w @ai-newsroom/api \
    bcrypt \
    rate-limiter-flexible \
    pino \
    pino-pretty \
    zod \
    uuid
  ```

- [ ] Add frontend packages:
  ```bash
  npm install -w @ai-newsroom/web axios
  ```

- [ ] Add dev dependencies:
  ```bash
  npm install -w @ai-newsroom/api -D @types/bcrypt @types/uuid
  ```

**Verification**:
```bash
npm list bcrypt axios
# Should show versions installed
```

#### 1.3 Documentation & Planning
- [ ] Review TECHNICAL_AUDIT.md with team
- [ ] Review IMPLEMENTATION_GUIDE.md with team
- [ ] Identify risks and mitigation strategies
- [ ] Create testing plan
- [ ] Schedule code reviews

**Deliverable**: Team alignment document

---

## Phase 2: Backend Authentication (Weeks 2-3)

### Goal
Implement production-grade authentication backend

### Tasks

#### 2.1 Core Authentication Services
- [ ] Create `apps/api/src/lib/password.ts` (bcrypt hashing)
- [ ] Create `apps/api/src/lib/jwt-service.ts` (token management)
- [ ] Create `apps/api/src/services/auth.ts` (authentication logic)

**Testing**:
```bash
npm run test -- auth.service.test.ts

# Should pass:
# ✓ Password hashing is consistent with bcrypt
# ✓ Tokens are issued with correct payload
# ✓ Token verification works
# ✓ Account lockout after N attempts
# ✓ Session creation on login
```

#### 2.2 Database Schema Migration
- [ ] Update `packages/database/prisma/schema.prisma` with new tables:
  - User (add fields: emailVerified, lastLoginAt, loginAttempts, lockedUntil, etc.)
  - Session (new)
  - RefreshToken (new)
  - LoginAttempt (new)
  - AuditLog (new)
  - Role (new)
  - UserRole (new)
  - Permission (new)

**Commands**:
```bash
npm run db:generate
npm run db:push
# Review schema in database
psql ai_newsroom -c "\dt"
```

**Verification**:
```sql
-- Verify new tables exist
SELECT tablename FROM pg_tables WHERE schemaname='public';
-- Should include: session, refresh_token, login_attempt, audit_log, role, user_role, permission
```

#### 2.3 API Middleware
- [ ] Create `apps/api/src/middleware/auth.ts` (token validation)
- [ ] Create `apps/api/src/middleware/rate-limit.ts` (request limiting)
- [ ] Create `apps/api/src/middleware/request-logger.ts` (structured logging)
- [ ] Create `apps/api/src/middleware/security-headers.ts` (security headers)

**Testing**:
```bash
npm run test -- middleware.test.ts

# Should pass:
# ✓ Valid token passes authentication
# ✓ Invalid token returns 401
# ✓ Expired token returns 401 with specific error
# ✓ Rate limiting blocks after threshold
# ✓ Security headers are present in response
```

#### 2.4 Authentication Routes
- [ ] Create `apps/api/src/routes/auth.ts` with endpoints:
  - POST `/api/v1/auth/login`
  - POST `/api/v1/auth/refresh`
  - POST `/api/v1/auth/logout`
  - GET `/api/v1/auth/me`

**Testing with curl**:
```bash
# Test login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@newsroom.ai","password":"admin123"}'

# Should return:
# {
#   "user": {...},
#   "tokens": {"accessToken": "...", "refreshToken": "..."},
#   "sessionId": "..."
# }
```

#### 2.5 Configuration & Validation
- [ ] Create `apps/api/src/config/env.ts` (environment validation with Zod)
- [ ] Create `apps/api/src/config/cors.ts` (CORS configuration)
- [ ] Create `apps/api/src/lib/logger.ts` (structured logging)

**Testing**:
```bash
# Test environment validation
NODE_ENV=production npm run dev

# Should fail with helpful error if required vars missing
```

**Deliverable**: Working backend authentication system with all endpoints functional

**Rollback Plan**:
```bash
# If issues arise, revert schema changes
npm run db:reset
# Or restore from backup
psql ai_newsroom < backup.sql
```

---

## Phase 3: Frontend Authentication (Week 3-4)

### Goal
Implement stable, session-persisting frontend auth

### Tasks

#### 3.1 Storage Layer
- [ ] Create `apps/web/src/lib/storage.ts` with functions:
  - `setStoredTokens()` - Store tokens securely
  - `getStoredTokens()` - Retrieve with expiry validation
  - `setStoredUser()` - Store user info
  - `getStoredUser()` - Retrieve user
  - `setStoredSession()` - Store session ID
  - `clearStoredAuth()` - Clear on logout
  - `isTokenExpiringSoon()` - Check for refresh need

**Testing**:
```bash
npm run test -- storage.test.ts

# Should pass:
# ✓ Tokens stored and retrieved correctly
# ✓ Expired tokens return null
# ✓ Invalid JSON in storage is handled gracefully
# ✓ Clear auth removes all data
```

#### 3.2 API Client with Interceptors
- [ ] Create/update `apps/web/src/lib/axios-client.ts` with:
  - Token injection in request headers
  - 401 response handling with token refresh
  - Request queue during refresh
  - Error handling utilities

**Testing**:
```bash
npm run test -- axios-client.test.ts

# Should pass:
# ✓ Token is injected in Authorization header
# ✓ 401 triggers token refresh
# ✓ Original request is retried with new token
# ✓ Multiple 401 requests don't refresh multiple times
# ✓ Refresh failure dispatches auth:unauthorized event
```

#### 3.3 Auth Context Redesign
- [ ] Update `apps/web/src/context/AuthContext.tsx` with:
  - Session restoration on mount
  - Automatic token refresh before expiry
  - Proper async/await handling
  - Clear error states

**Testing**:
```bash
npm run test -- AuthContext.test.tsx

# Should pass:
# ✓ Auth state restored from localStorage on mount
# ✓ Token refresh scheduled automatically
# ✓ Login stores tokens and user
# ✓ Logout clears all data
# ✓ Auth error event triggers logout
```

#### 3.4 Protected Routes & Loading States
- [ ] Update `apps/web/src/components/ProtectedRoute.tsx` with:
  - Loading spinner while auth verifies
  - Permission checking
  - Graceful redirect on auth failure

**Testing**:
```bash
npm run test -- ProtectedRoute.test.tsx

# Should pass:
# ✓ Shows loading spinner while isLoading=true
# ✓ Renders children when authenticated
# ✓ Redirects to login when not authenticated
# ✓ Shows error when lacking permissions
```

#### 3.5 Login Page Enhancement
- [ ] Update `apps/web/src/pages/LoginPage.tsx` with:
  - Better UX (demo credentials display)
  - Loading state management
  - Error display
  - Proper redirect after login

**Testing - Manual**:
1. Open http://localhost:5173/login
2. Clear localStorage
3. Enter credentials: admin@newsroom.ai / admin123
4. Verify:
   - [ ] Loading state appears
   - [ ] After login, redirects to dashboard
   - [ ] No race condition (doesn't redirect back to login)
   - [ ] Page refresh keeps user logged in
   - [ ] Token refreshes automatically on expiry
   - [ ] Error displayed on login failure

#### 3.6 Integration Testing
- [ ] Test full login flow end-to-end
- [ ] Test session restoration after refresh
- [ ] Test token automatic refresh
- [ ] Test logout across all tabs
- [ ] Test permission-based access

**E2E Test Script**:
```bash
npm run test:e2e

# Test scenarios:
# 1. Login → Dashboard (no errors)
# 2. Refresh page → Still logged in
# 3. Wait for token expiry → Auto-refresh happens
# 4. Logout → Redirected to login
# 5. Click login button again → Can login again
```

**Deliverable**: Fully functional frontend authentication with session persistence

---

## Phase 4: Integration & Testing (Week 4-5)

### Goal
Verify all components work together and perform under load

### Tasks

#### 4.1 End-to-End Testing
- [ ] Create login flow tests
- [ ] Create token refresh tests
- [ ] Create logout tests
- [ ] Create permission-based access tests
- [ ] Create error handling tests

**Test Scenarios**:
```typescript
describe('E2E Authentication Flow', () => {
  it('should login, navigate, refresh, and logout', async () => {
    // 1. Login
    cy.visit('/login');
    cy.get('[data-cy=email]').type('admin@newsroom.ai');
    cy.get('[data-cy=password]').type('admin123');
    cy.get('[data-cy=submit]').click();
    
    // 2. Should redirect to dashboard
    cy.location('pathname').should('eq', '/dashboard');
    
    // 3. Reload page
    cy.reload();
    cy.location('pathname').should('eq', '/dashboard');
    
    // 4. Should still be logged in
    cy.get('[data-cy=user-menu]').should('be.visible');
    
    // 5. Logout
    cy.get('[data-cy=user-menu]').click();
    cy.get('[data-cy=logout]').click();
    
    // 6. Should redirect to login
    cy.location('pathname').should('eq', '/login');
  });
});
```

#### 4.2 Security Testing
- [ ] Test password hashing (bcrypt)
- [ ] Test token expiration
- [ ] Test rate limiting
- [ ] Test account lockout
- [ ] Test CORS restrictions
- [ ] Test malformed token rejection
- [ ] Test token revocation

**Security Test Checklist**:
```bash
# Manual testing
# 1. Try invalid token
curl -H "Authorization: Bearer invalid" http://localhost:4000/api/v1/auth/me
# Should return 401

# 2. Try expired token
# (Generate token with 1-second expiry)
sleep 2
curl -H "Authorization: Bearer $EXPIRED_TOKEN" http://localhost:4000/api/v1/auth/me
# Should return 401

# 3. Try rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:4000/api/v1/auth/login \
    -d '{"email":"test@test.com","password":"wrong"}'
done
# Should hit rate limit after 5 attempts

# 4. Test CORS
curl -H "Origin: https://evil.com" http://localhost:4000/api/v1/auth/me
# Should fail if origin not in ALLOWED_ORIGINS
```

#### 4.3 Load Testing
- [ ] Test 100 concurrent logins
- [ ] Test token refresh performance
- [ ] Test API response under load
- [ ] Monitor database query performance

**Load Test Script**:
```bash
# Using Apache Bench
ab -n 1000 -c 100 -p login.json \
  -H "Content-Type: application/json" \
  http://localhost:4000/api/v1/auth/login

# Using wrk
wrk -t4 -c100 -d30s \
  -s scripts/login-test.lua \
  http://localhost:4000/api/v1/auth/login
```

#### 4.4 Database Migration Testing
- [ ] Test migration on production-like database
- [ ] Verify zero downtime migration possible
- [ ] Test rollback procedure
- [ ] Verify data integrity after migration

#### 4.5 Staging Deployment
- [ ] Deploy to staging environment
- [ ] Run full test suite
- [ ] Manual testing for 3-5 days
- [ ] Get team sign-off

**Staging Deployment Checklist**:
- [ ] Environment variables set correctly
- [ ] Database migrations applied
- [ ] Docker containers running
- [ ] Health check passing
- [ ] API responding
- [ ] Frontend loading
- [ ] Login works
- [ ] Logs aggregated and searchable
- [ ] Monitoring/alerting operational

**Deliverable**: Fully tested, production-ready codebase

---

## Phase 5: Production Deployment (Week 5-6)

### Goal
Deploy to production with minimal downtime and fast rollback capability

### Tasks

#### 5.1 Pre-Deployment
- [ ] Final security audit
- [ ] Performance baseline established
- [ ] Rollback plan documented
- [ ] Team training on new system
- [ ] On-call schedule updated

#### 5.2 Blue-Green Deployment
- [ ] Start "Green" environment (new version)
- [ ] Run smoke tests on Green
- [ ] Monitor Green for 30 minutes
- [ ] Switch load balancer to Green
- [ ] Keep Blue running for rollback (24 hours)

```bash
# Step-by-step deployment
# 1. Deploy new version to green slot
docker-compose -f docker-compose.prod-green.yml up -d

# 2. Verify health
curl https://api-green.example.com/api/health

# 3. Run smoke tests
npm run test:smoke -- --url https://api-green.example.com

# 4. Monitor for errors
docker-compose -f docker-compose.prod-green.yml logs -f api

# 5. Switch traffic
# (Update load balancer or DNS)

# 6. Monitor
# Check error rates, latency, token refresh rate

# 7. After 24 hours of stability, remove Blue
docker-compose -f docker-compose.prod-blue.yml down
```

#### 5.3 Post-Deployment Verification
- [ ] All health checks passing
- [ ] Error rates within baseline
- [ ] Response times acceptable
- [ ] Database connections healthy
- [ ] Logs aggregating properly
- [ ] Monitoring/alerting working

**Verification Checklist**:
```bash
# Check health
curl https://api.example.com/api/health

# Check logs
docker-compose logs -f api | grep -i error

# Check metrics
# - Login success rate > 95%
# - Login latency < 500ms
# - API error rate < 0.1%
# - Token refresh rate healthy

# Test key flows
# 1. Login
# 2. Access protected resource
# 3. Token refresh
# 4. Logout
```

#### 5.4 User Communication
- [ ] Send notification about authentication improvements
- [ ] Document new features (session management, device tracking)
- [ ] Create FAQ for common questions
- [ ] Monitor support channels

**Sample Notification**:
```
🔐 Authentication System Upgraded

We've improved your account security with:
✓ More reliable login experience
✓ Automatic session persistence (stay logged in on refresh)
✓ Better account protection (device tracking, login history)
✓ Improved password security (bcrypt hashing)

What's changed:
- First-time users will need to login again
- Existing sessions will be validated
- You'll see device information in settings

Questions? Email support@newsroom.ai
```

#### 5.5 Monitoring & Support (Week 6)
- [ ] Monitor error rates continuously
- [ ] Watch for login issues
- [ ] Monitor token refresh behavior
- [ ] Check database performance
- [ ] Support users with questions

**On-Call Runbook**:
```
ISSUE: High login failure rate

1. Check error logs
   docker-compose logs api | grep "auth.login"

2. Check database connectivity
   psql -c "SELECT NOW();"

3. Check Redis connectivity
   redis-cli ping

4. Check rate limiting
   Log into Redis: CHECK login:* keys

5. If issue found, fix and restart
   docker-compose restart api

6. If unfixable, initiate rollback
   docker-compose -f docker-compose.prod-blue.yml up -d
   Update load balancer to point to blue
```

**Deliverable**: Production system with stable authentication

---

## Phase 6: Post-Launch Optimization (Ongoing)

### Goal
Continuous improvement based on real-world usage

### Tasks

#### 6.1 Performance Optimization
- [ ] Monitor slow queries, optimize as needed
- [ ] Implement caching for frequently accessed data
- [ ] Optimize token refresh timing
- [ ] Profile and optimize hot paths

#### 6.2 Security Hardening
- [ ] Implement MFA (optional)
- [ ] Add OAuth/OIDC support (optional)
- [ ] Implement password reset flow
- [ ] Add email verification
- [ ] Implement audit log export

#### 6.3 Feature Enhancements
- [ ] Session management UI (view devices, logout sessions)
- [ ] Login history view
- [ ] Device management
- [ ] Two-factor authentication
- [ ] Single Sign-On (SSO) integration

#### 6.4 Scaling
- [ ] Implement Redis session storage (from in-memory)
- [ ] Set up load balancing
- [ ] Configure database replication
- [ ] Implement distributed token blacklist
- [ ] Plan for multi-region deployment

#### 6.5 Documentation
- [ ] Create operator runbook
- [ ] Document troubleshooting procedures
- [ ] Create disaster recovery procedures
- [ ] Document architecture decisions

---

## Risk Mitigation

### High Risk: Database Migration Failure

**Mitigation**:
- Test migration on staging first
- Backup production database
- Have rollback script ready
- Plan maintenance window (low traffic)
- Have DBA on standby

**Rollback**:
```bash
# Restore from backup
pg_restore -d ai_newsroom backup.sql
# Verify data integrity
psql ai_newsroom -c "SELECT COUNT(*) FROM public.user;"
```

### Medium Risk: Token Format Change Breaks Clients

**Mitigation**:
- Support both token formats for 30 days
- API versioning (/api/v1 vs /api/v2)
- Clear communication to clients
- Gradual rollout (5% → 25% → 100%)

### Medium Risk: Race Condition in Login Flow

**Mitigation**:
- Extensive end-to-end testing
- Load testing under high concurrency
- Manual testing of race condition scenarios
- Code review by security expert

### Low Risk: Environment Variable Issues

**Mitigation**:
- Environment validation (Zod schema)
- Staging deployment first
- Clear documentation
- Pre-flight checks before deployment

---

## Success Metrics

### Pre-Launch Baseline
- Current login success rate: ~70%
- Session persistence on refresh: 0%
- Token refresh: Not implemented
- Brute-force protection: None
- Audit logging: None

### Post-Launch Goals (2 weeks)
- Login success rate: > 99%
- Session persistence on refresh: 100%
- Token refresh: Automatic
- Brute-force protection: 5 attempts / 15 minutes
- Audit logging: 100% of auth events

### 3-Month Goals
- Login latency: < 500ms (p95)
- API availability: 99.9%
- Zero unplanned downtime
- Users per second: 1000+
- Token refresh: < 50ms

---

## Communication Plan

### Week 1
- [ ] Team kickoff meeting
- [ ] Technical architecture review
- [ ] Risk assessment discussion

### Week 3
- [ ] Mid-point review
- [ ] Frontend demo to stakeholders
- [ ] Address any concerns

### Week 5
- [ ] Final review before production
- [ ] User communication (notify about changes)
- [ ] Support team training

### Week 6+
- [ ] Daily monitoring updates
- [ ] Weekly post-launch reviews
- [ ] Monthly improvements

---

## Key Contacts

- **Project Lead**: [Name]
- **Backend Lead**: [Name]
- **Frontend Lead**: [Name]
- **DevOps Lead**: [Name]
- **Security Review**: [Name]
- **Database Admin**: [Name]

---

## Appendix: Quick Reference

### Environment Variables Template
```bash
# .env.production
NODE_ENV=production
API_PORT=4000
DATABASE_URL=postgresql://user:pass@host/db
REDIS_URL=redis://:pass@host:6379
AUTH_SECRET=$(openssl rand -base64 32)
WEB_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com
```

### Deployment Checklist
```bash
☐ Environment validated
☐ Dependencies installed
☐ Database migrated
☐ Tests passing
☐ Staging verified
☐ Rollback plan ready
☐ Team trained
☐ On-call setup
☐ Monitoring ready
☐ Alert rules configured
```

### Testing Commands
```bash
npm run dev              # Start all services
npm run test            # Run all tests
npm run test:e2e        # End-to-end tests
npm run test:load       # Load tests
npm run test:security   # Security tests
npm run build           # Build for production
```

### Database Commands
```bash
npm run db:generate     # Generate Prisma client
npm run db:push         # Apply migrations
npm run db:seed         # Seed initial data
npm run db:reset        # Reset database (⚠️ destructive)
npm run db:validate     # Validate schema
```

---

**Project Status**: Ready to begin
**Expected Completion**: 6 weeks
**Target Go-Live**: [Date]

For questions or concerns, contact the project lead.
