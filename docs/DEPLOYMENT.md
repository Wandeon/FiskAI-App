# FiskAI Deployment Guide

This document covers deployment, configuration, and operations for FiskAI in production environments.

---

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Database Migrations](#database-migrations)
3. [Cron Job Setup](#cron-job-setup)
4. [Fiscalisation Configuration](#fiscalisation-configuration)
5. [Docker Deployment](#docker-deployment)
6. [Monitoring and Observability](#monitoring-and-observability)

---

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Authentication
NEXTAUTH_URL=https://your-app.example.com
NEXTAUTH_SECRET=<generate: openssl rand -base64 32>

# Application
NEXT_PUBLIC_APP_NAME=FiskAI
NEXT_PUBLIC_APP_URL=https://your-app.example.com
EINVOICE_KEY_SECRET=<generate: openssl rand -hex 32>

# Fiscalisation Certificate Encryption
FISCAL_CERT_KEY=<generate: openssl rand -hex 32>

# Cron Job Authorization
CRON_SECRET=<generate: openssl rand -hex 32>
```

### Optional Variables

```bash
# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com

# AI/OCR
OPENAI_API_KEY=

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Authentication
WEBAUTHN_RP_ID=
WEBAUTHN_RP_NAME=

# Bank Sync
BANK_SYNC_PROVIDER=
GOCARDLESS_SECRET_ID=
GOCARDLESS_SECRET_KEY=
GOCARDLESS_BASE_URL=

# Email Import
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# File Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

### Generating Secrets

```bash
# CRON_SECRET (hex format)
openssl rand -hex 32

# FISCAL_CERT_KEY (hex format)
openssl rand -hex 32

# NEXTAUTH_SECRET (base64 format)
openssl rand -base64 32

# EINVOICE_KEY_SECRET (hex format)
openssl rand -hex 32
```

---

## Database Migrations

FiskAI uses both Prisma and Drizzle ORM for database migrations. Drizzle is used for news system tables, while Prisma is used for the main application tables.

### Drizzle Migrations (News System)

#### Local Development

```bash
# Generate new migration after schema changes
npm run db:generate

# Apply all pending Drizzle migrations
npm run db:migrate

# Push schema changes directly (development only)
npm run db:push

# Open Drizzle Studio to view data
npm run db:studio
```

#### Production Deployment

**Automatic (Recommended)**: Drizzle migrations run automatically on container startup via `docker-entrypoint.sh`.

**Manual (if needed)**:

```bash
# Inside the container
docker exec -it fiskai-app npx drizzle-kit migrate

# Or using docker-compose
docker-compose exec fiskai-app npx drizzle-kit migrate
```

**Verify migrations were applied**:

```sql
-- Check if news tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('compliance_deadlines', 'news_items', 'news_sources', 'news_posts', 'news_categories', 'news_tags');
```

### Prisma Migrations (Main Application)

#### Local Development

```bash
# Run all pending migrations
npx prisma migrate deploy

# Create a new migration after schema changes
npx prisma migrate dev --name descriptive_migration_name

# Validate schema
npx prisma validate
```

#### Production Deployment

```bash
# Before deploying, generate migration from schema changes
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datasource prisma/schema.prisma --script

# Deploy migrations in production
npx prisma migrate deploy

# Verify migration status
npx prisma migrate status
```

### Migration Execution Order

On deployment, migrations run in this order:

1. **Drizzle migrations** (automatic via docker-entrypoint.sh)
2. **Prisma migrations** (manual via `prisma migrate deploy` if needed)

The Docker entrypoint script (`docker-entrypoint.sh`) automatically applies Drizzle migrations before starting the application.

### Emergency: Rollback

Neither Prisma nor Drizzle support automatic rollbacks. Instead:

1. **Drizzle**: Review migration SQL in `drizzle/[number]_[name].sql`
2. **Prisma**: Review migration SQL in `prisma/migrations/[timestamp]_[name]/migration.sql`
3. Create a new migration to undo changes if needed
4. Test thoroughly in staging before applying to production

---

## Cron Job Setup

The fiscalisation processor runs as a scheduled job that processes queued fiscal requests. It must be triggered regularly (every 1 minute recommended).

### Endpoint Details

```
GET /api/cron/fiscal-processor
Authorization: Bearer ${CRON_SECRET}
```

### Authorization

The endpoint verifies the `Authorization` header must be exactly:

```
Bearer 69dc676aaeb0c9e08cedeaaafb497ad549444aeece7f9339baa3947cef9305eb
```

If the header is missing or incorrect, the endpoint returns `401 Unauthorized`.

### Response Format

**Success (200)**

```json
{
  "processed": 10,
  "results": [
    {
      "id": "cuid_request_id",
      "success": true
    },
    {
      "id": "cuid_request_id_2",
      "success": false,
      "error": "Certificate has expired"
    }
  ]
}
```

**Unauthorized (401)**

```
Unauthorized
```

**Server Error (500)**

```json
{
  "error": "Processing failed"
}
```

### Option 1: Coolify Cron Configuration

If you're using Coolify for deployment:

1. Go to your application settings
2. Navigate to **Scheduled Jobs** or **Crons**
3. Create a new scheduled job with:
   - **Command/URL**: `curl -X GET "https://your-app.example.com/api/cron/fiscal-processor" -H "Authorization: Bearer 69dc676aaeb0c9e08cedeaaafb497ad549444aeece7f9339baa3947cef9305eb"`
   - **Schedule**: `*/1 * * * *` (every 1 minute)
   - **Timeout**: 60 seconds

### Option 2: System Crontab (Linux/macOS)

For a standalone server or VPS:

```bash
# Edit crontab
crontab -e

# Add this line (runs every 1 minute)
*/1 * * * * curl -X GET "https://your-app.example.com/api/cron/fiscal-processor" -H "Authorization: Bearer 69dc676aaeb0c9e08cedeaaafb497ad549444aeece7f9339baa3947cef9305eb" >> /var/log/fiskai-cron.log 2>&1
```

### Option 3: Docker Container Cron

If running in a Docker container, use a cron service:

```dockerfile
# In Dockerfile or docker-compose.yml
RUN apt-get update && apt-get install -y curl

# Add cron job
RUN echo '*/1 * * * * curl -X GET "https://your-app.example.com/api/cron/fiscal-processor" -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/fiskai-cron.log 2>&1' | crontab -
```

### Option 4: External Cron Service

Use a service like:

- **EasyCron**: https://www.easycron.com
- **Cron-job.org**: https://cron-job.org
- **AWS EventBridge**: For AWS deployments
- **Google Cloud Scheduler**: For Google Cloud deployments

Configure the service to make HTTP GET requests to:

```
https://your-app.example.com/api/cron/fiscal-processor
```

With header:

```
Authorization: Bearer 69dc676aaeb0c9e08cedeaaafb497ad549444aeece7f9339baa3947cef9305eb
```

Every 1 minute.

### Monitoring the Cron Job

Check logs for cron execution:

```bash
# If using system crontab
tail -f /var/log/fiskai-cron.log

# If using Coolify, check application logs
# If using Docker, check container logs
docker logs -f <container_id>
```

Expected log output:

```
{"processed": 10, "results": [...]}
```

### Cron Job Behavior

- **Batch size**: Processes up to 10 requests per run
- **Lock duration**: 60 seconds per request
- **Lock recovery**: Automatically recovers stale locks after 5 minutes
- **Exponential backoff**: Failed requests retry with exponential backoff (30s, 2m, 8m, 32m, 2h max)
- **Dead letter queue**: Requests exceeding max attempts (5) are marked as DEAD

---

## Fiscalisation Configuration

### Setup for Croatian Fiscalisation (Fiskalizacija 1.0)

#### 1. Generate Certificate Encryption Key

```bash
# Generate a 32-byte (256-bit) key
openssl rand -hex 32

# Output example: 95ce54fa38ef2236ef24ac62fe2ed9e8e4857545e2f5c335465fd9678a1def6c
```

Add to `.env` as `FISCAL_CERT_KEY`.

#### 2. Enable Fiscalisation for Company

In the application, enable fiscalisation in company settings:

```sql
UPDATE "Company"
SET
  "fiscalEnabled" = true,
  "fiscalEnvironment" = 'PROD',  -- or 'TEST' for testing
  "premisesCode" = '1',           -- FINA premises code
  "deviceCode" = '1'              -- FINA device code
WHERE id = 'company_id';
```

#### 3. Upload Fiscal Certificate

The certificate must be in P12/PFX format with:

- Subject containing the company OIB (11-digit Croatian tax ID)
- Valid for the chosen environment (TEST or PROD)
- Not expired

Upload via the UI at `/settings/fiscalisation` or via API:

```typescript
import { saveCertificateAction } from "@/app/actions/fiscal-certificate"

const result = await saveCertificateAction({
  p12Base64: base64EncodedP12File,
  password: "certificate_password",
  environment: "PROD",
})
```

#### 4. Test Fiscalisation

1. Create a cash invoice
2. Finalize the invoice
3. A fiscal request is automatically queued
4. Wait for cron job to process (max 1 minute)
5. Check invoice details for JIR (Jedinstveni Redni Broj - unique serial number)

---

## Docker Deployment

### docker-compose.prod.yml Example

```yaml
version: "3.9"

services:
  fiskai-app:
    image: fiskai:latest
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://fiskai:${POSTGRES_PASSWORD}@fiskai-db:5432/fiskai
      NEXTAUTH_URL: https://erp.metrica.hr
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      FISCAL_CERT_KEY: ${FISCAL_CERT_KEY}
      CRON_SECRET: ${CRON_SECRET}
      # Set other env vars from secrets management
    depends_on:
      - fiskai-db
    networks:
      - fiskai-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  fiskai-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: fiskai
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: fiskai
    volumes:
      - fiskai-data:/var/lib/postgresql/data
    networks:
      - fiskai-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fiskai"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  fiskai-network:
    driver: bridge

volumes:
  fiskai-data:
```

### Deployment Steps

```bash
# 1. Set production environment variables
export POSTGRES_PASSWORD="your_secure_password"
export NEXTAUTH_SECRET=$(openssl rand -base64 32)
export FISCAL_CERT_KEY=$(openssl rand -hex 32)
export CRON_SECRET=$(openssl rand -hex 32)

# 2. Build and run
docker-compose -f docker-compose.prod.yml up -d

# 3. Drizzle migrations run automatically on startup
# Check logs to verify migrations completed
docker-compose -f docker-compose.prod.yml logs -f fiskai-app

# 4. (Optional) Run Prisma migrations if needed
docker-compose -f docker-compose.prod.yml exec fiskai-app npx prisma migrate deploy
```

### Migration Behavior on Deployment

When the container starts:

1. The `docker-entrypoint.sh` script runs Drizzle migrations automatically
2. If migrations succeed, the application starts
3. If migrations fail, the container exits with an error

This ensures the database is always in sync with the application code.

---

## Monitoring and Observability

### Application Health

```bash
# Health check endpoint
curl https://your-app.example.com/api/health

# Expected response
{"status": "ok", "timestamp": "2025-12-15T10:00:00Z"}
```

### Cron Job Monitoring

Check recent fiscal requests:

```sql
SELECT id, status, createdAt, attemptCount, errorMessage
FROM "FiscalRequest"
ORDER BY createdAt DESC
LIMIT 20;
```

Status breakdown:

- `QUEUED`: Waiting to be processed
- `PROCESSING`: Currently being handled by cron worker
- `COMPLETED`: Successfully fiscalized with JIR
- `FAILED`: Temporary error, will retry
- `DEAD`: Permanent error, no more retries

### Certificate Status

```sql
SELECT
  id,
  environment,
  status,
  certNotAfter,
  lastUsedAt
FROM "FiscalCertificate"
WHERE companyId = 'company_id'
ORDER BY certNotAfter ASC;
```

Alert if:

- `status` != 'ACTIVE'
- `certNotAfter` < NOW() + INTERVAL '30 days' (expiring soon)

### Performance Metrics

Key metrics to monitor:

- **Cron job latency**: Time from request queuing to completion
- **Success rate**: Percentage of COMPLETED vs FAILED+DEAD
- **Error types**: Distribution of error codes
- **Certificate coverage**: Percentage of companies with active certificates
- **Fiscalisation lag**: Time between invoice finalization and fiscal request creation

---

## Troubleshooting

### Cron Job Not Running

1. Verify `CRON_SECRET` environment variable is set
2. Check cron logs for HTTP status codes
3. Verify the endpoint is accessible: `curl https://your-app.example.com/api/cron/fiscal-processor -H "Authorization: Bearer $CRON_SECRET"`
4. Check application logs for errors

### Fiscal Requests Stuck in QUEUED

1. Check if CRON_SECRET is correct and endpoint is accessible
2. Verify fiscalisation is enabled for the company
3. Check certificate status and expiry
4. Look for errors in application logs with prefix `[fiscal-*]`

### Certificate Validation Errors

1. Verify certificate is in P12/PFX format
2. Confirm OIB (11-digit tax ID) is in certificate subject
3. Check certificate expiry date
4. Verify password is correct

---

## Security Best Practices

1. **Never commit secrets** to version control - use environment variables only
2. **Rotate CRON_SECRET** periodically (quarterly recommended)
3. **Monitor certificate expiry** and plan renewal 30 days in advance
4. **Audit all fiscal operations** via AuditLog table
5. **Encrypt P12 certificates** using FISCAL_CERT_KEY (handled automatically)
6. **Use HTTPS only** for cron endpoints
7. **Restrict IP access** to cron endpoint if possible (firewall rules)

---

## Support

For issues with:

- **Fiscalisation**: Contact your FINA representative or Porezna Uprava
- **Application**: Check logs and contact FiskAI support
- **Cron setup**: Refer to your hosting provider's documentation
