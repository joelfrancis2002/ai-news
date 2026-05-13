# Production Security & Deployment Guide

## Pre-Deployment Security Checklist

### ✓ Environment Variables

```bash
# ✓ Validate all required variables set
# ✓ Generate new AUTH_SECRET (never reuse development one)
AUTH_SECRET=$(openssl rand -base64 32)

# ✓ Store in secure vault (not git)
# ✓ Never log or expose AUTH_SECRET

# ✓ Set different values per environment
ENVIRONMENT=production
DATABASE_URL=postgresql://user:password@host/db
REDIS_URL=redis://:password@host:6379
WEB_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com,https://app.your-domain.com
```

### ✓ Database Security

```sql
-- ✓ Create database with restricted permissions
CREATE DATABASE ai_newsroom
  WITH OWNER newsroom
  ENCODING 'UTF8'
  LOCALE 'en_US.UTF-8';

-- ✓ Create restricted user (not superuser)
CREATE USER newsroom_api WITH PASSWORD 'secure_password_here';
GRANT CONNECT ON DATABASE ai_newsroom TO newsroom_api;
GRANT USAGE ON SCHEMA public TO newsroom_api;
GRANT CREATE ON SCHEMA public TO newsroom_api;

-- ✓ Enable SSL/TLS
sslmode=require
sslcert=/path/to/client-cert.pem
sslkey=/path/to/client-key.pem
sslrootcert=/path/to/ca-cert.pem

-- ✓ Enable row-level security (advanced)
ALTER TABLE public.user ENABLE ROW LEVEL SECURITY;
```

### ✓ Redis Security

```bash
# ✓ Require password authentication
requirepass YOUR_SECURE_PASSWORD

# ✓ Use TLS encryption
tls-port 6380
tls-cert-file /path/to/cert.pem
tls-key-file /path/to/key.pem
tls-ca-cert-file /path/to/ca.pem

# ✓ Restrict network access
bind 127.0.0.1 # Only loopback in production
# Or use VPN/network policies
```

### ✓ Application Secrets

```bash
# Generate secure tokens
# For AUTH_SECRET (JWT signing)
openssl rand -base64 32

# For API_KEY (service-to-service auth)
uuidgen

# Store in secure vault
# Options: AWS Secrets Manager, HashiCorp Vault, Azure Key Vault, etc.

# ✗ Never:
# - Commit secrets to git
# - Log secrets
# - Share via email or chat
# - Use default/demo secrets in production
```

### ✓ TLS/SSL Configuration

```nginx
# ✓ Use strong TLS version (1.2+)
ssl_protocols TLSv1.2 TLSv1.3;

# ✓ Use secure cipher suites
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers on;

# ✓ Enable HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# ✓ Enable OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /path/to/chain.pem;

# ✓ Session configuration
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off; # Disable session tickets for better security
```

### ✓ Security Headers

```nginx
# ✓ Content Security Policy
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;

# ✓ Prevent clickjacking
add_header X-Frame-Options "DENY" always;

# ✓ Prevent MIME sniffing
add_header X-Content-Type-Options "nosniff" always;

# ✓ Enable XSS protection
add_header X-XSS-Protection "1; mode=block" always;

# ✓ Referrer policy
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# ✓ Permissions policy (replaces Feature-Policy)
add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()" always;

# ✓ Remove server header
server_tokens off;
```

### ✓ CORS Configuration

```typescript
// ✓ Restrict origins to known domains only
const allowedOrigins = [
  'https://your-domain.com',
  'https://app.your-domain.com',
];

// ✗ Never use wildcard '*'
// ✗ Never use http:// in production

// ✓ Enable credentials
credentials: true,
allowedHeaders: ['Content-Type', 'Authorization'],
maxAge: 86400,
```

### ✓ Rate Limiting

```typescript
// ✓ Protect authentication endpoints
POST /api/auth/login:     5 attempts per 15 minutes per IP
POST /api/auth/refresh:  10 attempts per minute per IP
GET  /api/*:             100 requests per minute per IP

// ✓ Use distributed rate limiting in production
// Store limits in Redis, not memory
```

### ✓ Account Lockout

```typescript
// ✓ After 5 failed login attempts:
// - Lock account for 15 minutes
// - Require email verification to unlock
// - Log security event

// ✓ Monitor lockout patterns:
// - Multiple failures from different IPs = potential attack
// - Same user always fails = weak password guidance needed
```

### ✓ Password Policy

```typescript
// ✓ Minimum 8 characters
// ✓ Require complexity:
//   - At least 1 uppercase letter
//   - At least 1 lowercase letter
//   - At least 1 number
//   - At least 1 special character

// ✓ Hash with bcrypt (SALT_ROUNDS >= 12)
// ✗ Never accept plaintext in logs
// ✗ Never email passwords (reset token instead)
```

### ✓ Logging & Monitoring

```typescript
// ✓ Log authentication events
- login (success, failure reason)
- logout
- token refresh
- account lockout
- password change
- permission changes
- admin actions

// ✓ Never log:
- Passwords
- Tokens
- Credit cards
- Personal identification numbers

// ✓ Centralize logs:
- Use ELK Stack, Datadog, or similar
- Ensure logs have long retention
- Encrypt log storage
- Restrict access to logs
```

### ✓ API Versioning

```typescript
// ✓ Use version in URL
GET /api/v1/auth/me
POST /api/v1/articles

// ✓ Support deprecated versions for 12+ months
// ✓ Clearly communicate sunset dates
// ✓ Never break existing clients
```

### ✓ Error Handling

```typescript
// ✓ Return generic error messages to client
❌ "User not found"  // Leaks information
✓ "Invalid credentials"

❌ Stack traces in response
✓ Unique error ID for support lookup

❌ SQL errors exposed
✓ "Database error - please retry"

❌ File paths exposed
✓ "Resource not accessible"
```

---

## Deployment Procedures

### Pre-Deployment Verification

```bash
# 1. Build application
npm run build

# 2. Run security tests
npm run test:security

# 3. Run load tests
npm run test:load

# 4. Run integration tests
npm run test:integration

# 5. Create database backup
pg_dump -U newsroom ai_newsroom > backup_$(date +%s).sql

# 6. Test database migration
# (in isolated environment)
npm run db:push

# 7. Verify all environment variables
node scripts/validate-env.ts
```

### Staging Deployment

```bash
# 1. Deploy to staging environment
docker-compose -f docker-compose.staging.yml up -d

# 2. Run smoke tests
npm run test:smoke -- --url https://staging.example.com

# 3. Manual testing:
#    - Login flow
#    - Token refresh
#    - Logout
#    - Permission checks
#    - Error handling

# 4. Performance testing:
npm run test:load -- --url https://staging.example.com

# 5. Security scanning:
npm run test:security
```

### Production Deployment

#### Blue-Green Deployment (Recommended)

```bash
# 1. Start new version (Green) alongside old (Blue)
docker-compose -f docker-compose.prod-green.yml up -d

# 2. Run health checks
curl https://api-green.example.com/api/health

# 3. Run smoke tests
npm run test:smoke -- --url https://api-green.example.com

# 4. Switch traffic to Green
# Update load balancer/DNS

# 5. Monitor Green for 30 minutes
# Check logs, error rates, performance

# 6. Keep Blue running for quick rollback
# Delete after 24 hours of stable Green

# 7. Rollback if issues detected
# Switch traffic back to Blue immediately
```

#### Canary Deployment (Alternative)

```bash
# 1. Deploy new version to subset of servers (5%)
# 2. Monitor error rates, latency
# 3. Gradually increase (10%, 25%, 50%, 100%)
# 4. Rollback at any point if issues detected
```

### Post-Deployment

```bash
# 1. Verify health checks
curl https://api.example.com/api/health

# 2. Check logs for errors
docker-compose logs -f api

# 3. Monitor metrics
# - Error rate
# - Response time
# - Database connections
# - Token refresh rate

# 4. Notify users if needed
# - Downtime windows
# - New features

# 5. Keep rollback plan ready for 24 hours
```

---

## Monitoring & Alerting

### Key Metrics

```
1. Authentication Metrics
   - login_attempts_total (gauge)
   - login_success_total (counter)
   - login_failure_total (counter)
   - token_refresh_total (counter)
   - session_count (gauge)
   - account_lockouts (counter)

2. API Metrics
   - http_request_duration_seconds (histogram)
   - http_request_total (counter)
   - http_errors_total (counter)
   - database_query_duration_seconds (histogram)

3. Security Metrics
   - failed_auth_attempts (counter)
   - rate_limit_violations (counter)
   - cors_violations (counter)
   - invalid_tokens (counter)

4. System Metrics
   - process_cpu_seconds_total (counter)
   - process_resident_memory_bytes (gauge)
   - nodejs_eventloop_lag_seconds (gauge)
   - database_connections (gauge)
```

### Alert Rules

```yaml
groups:
  - name: authentication
    rules:
      - alert: HighLoginFailureRate
        expr: (rate(login_failure_total[5m]) / rate(login_attempts_total[5m])) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High login failure rate"

      - alert: TooManyLoginAttempts
        expr: rate(login_failure_total[5m]) > 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Potential brute force attack"

      - alert: HighAccountLockouts
        expr: rate(account_lockouts[1h]) > 5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Multiple account lockouts detected"

  - name: api
    rules:
      - alert: HighErrorRate
        expr: (rate(http_errors_total[5m]) / rate(http_request_total[5m])) > 0.05
        for: 5m
        labels:
          severity: warning

      - alert: SlowAPI
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning

      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
```

---

## Incident Response

### Authentication Down

1. Check API and database health
2. Verify environment variables
3. Check logs for errors
4. Roll back recent changes
5. Notify users

### Brute Force Attack Detected

1. Enable rate limiting (may already be active)
2. Block IP addresses
3. Check for compromised accounts
4. Force password resets if needed
5. Notify security team

### Data Breach Suspected

1. Revoke all active tokens
2. Force re-authentication
3. Isolate affected systems
4. Preserve logs
5. Notify users and authorities

### Performance Degradation

1. Check database query performance
2. Check Redis connectivity
3. Scale horizontally if needed
4. Review recent changes
5. Optimize slow queries

---

## Compliance & Auditing

### Required Auditing

```typescript
// ✓ Log and audit trail for all:
- User login/logout
- Account creation/deletion
- Permission changes
- Admin actions
- API access by sensitive operations
- Data exports
- Password changes
- Account recovery attempts

// ✓ Retention: Minimum 1 year
// ✓ Encryption at rest and in transit
// ✓ Access restricted to authorized personnel only
// ✓ Tamper-proof (immutable logs preferred)
```

### Compliance Standards

- **OWASP Top 10**: Addressed in security design
- **NIST Cybersecurity Framework**: Implemented practices
- **GDPR**: Data retention, user deletion, consent tracking
- **SOC 2**: Logging, monitoring, access controls
- **PCI DSS**: If handling payment data (not applicable for news app)

### Regular Security Reviews

```bash
# Monthly
- Review login failure patterns
- Review audit logs for anomalies
- Check for expired/revoked tokens still in use

# Quarterly
- Penetration testing
- Code review
- Dependency vulnerability scanning
- Access control review

# Annually
- Full security assessment
- Compliance audit
- Disaster recovery testing
```

---

## Disaster Recovery

### Backup Strategy

```bash
# Daily automated backups
0 2 * * * pg_dump -U newsroom ai_newsroom | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz

# Monthly offsite backups
0 3 1 * * aws s3 cp /backups/db_$(date +\%Y\%m\%d).sql.gz s3://offsite-backups/

# Test restore monthly
0 4 1 * * restore-backup.sh
```

### Recovery Procedures

```bash
# 1. Restore database
psql ai_newsroom < backup.sql

# 2. Verify data integrity
SELECT COUNT(*) FROM "user";
SELECT COUNT(*) FROM "session";

# 3. Verify application can connect
npm run db:push

# 4. Clear token cache
FLUSHALL # (Redis)

# 5. Force user re-authentication
# Update all sessions to isActive=false

# 6. Restart application
docker-compose restart api

# 7. Verify system is operational
curl https://api.example.com/api/health
```

---

## Maintenance & Updates

### Dependency Updates

```bash
# Monthly
npm audit
npm update --save

# Test after updates
npm run test

# Deploy to staging
npm run deploy:staging

# After 1 week of stability, promote to production
```

### Node.js/Runtime Updates

- Update Node.js version
- Test in staging for 1 week
- Plan maintenance window
- Deploy during low-traffic period
- Have rollback plan ready

### Database Schema Updates

```bash
# 1. Create migration
npx prisma migrate dev --name description

# 2. Review changes
git diff schema.prisma

# 3. Test on staging database
npm run db:push --environment staging

# 4. Backup production database
pg_dump ... > backup.sql

# 5. Deploy migration
npm run db:push --environment production

# 6. Verify success
npm run db:validate

# 7. Monitor for issues
# Check error logs for ORM issues
```

---

This security and deployment guide should be reviewed and updated regularly as threats evolve and your infrastructure scales.
