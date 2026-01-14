# FiskAI Deployment Guide

This document covers deployment, configuration, and operations for FiskAI in production environments.

---

## Table of Contents

1. [Infrastructure Architecture](#infrastructure-architecture)
2. [Docker Image Build Process](#docker-image-build-process)
3. [Environment Variables](#environment-variables)
4. [Database Migrations](#database-migrations)
5. [Cron Job Setup](#cron-job-setup)
6. [Fiscalisation Configuration](#fiscalisation-configuration)
7. [Docker Deployment](#docker-deployment)
8. [Worker Deployment](#worker-deployment)
9. [Monitoring and Observability](#monitoring-and-observability)

---

## Infrastructure Architecture

FiskAI uses a split infrastructure approach for security, performance, and scalability.

### Server Topology

```
                                    INTERNET
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
              ┌─────────┐         ┌─────────┐         ┌─────────┐
              │Cloudflare│        │Cloudflare│        │Cloudflare│
              │fiskai.hr │        │app.fiskai│        │ci.fiskai │
              └────┬────┘         └────┬────┘         └────┬────┘
                   │                   │                   │
                   │              HTTPS│443           HTTPS│443
                   │                   │                   │
    ═══════════════╪═══════════════════╪═══════════════════╪═══════════
                   │                   │                   │
              ┌────┴────┐         ┌────┴────┐         ┌────┴────┐
              │ VPS-03  │         │ VPS-01  │         │ VPS-01  │
              │Marketing│         │ Caddy   │         │ Coolify │
              │(static) │         │:443     │         │:8000    │
              └─────────┘         └────┬────┘         └─────────┘
                                       │
                              ┌────────┴────────┐
                              │   FiskAI App    │
                              │  (Next.js)      │
                              │  :3000          │
                              └────────┬────────┘
                                       │
    ═══════════════════════════════════╪═══════════════════════════════
                              TAILSCALE MESH (100.x.x.x)
    ═══════════════════════════════════╪═══════════════════════════════
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         │                             │                             │
         ▼                             ▼                             ▼
    ┌─────────┐                  ┌─────────┐                  ┌─────────┐
    │ VPS-01  │                  │ VPS     │                  │ GPU-01  │
    │(Primary)│                  │(Workers)│                  │ (LLM)   │
    └────┬────┘                  └────┬────┘                  └────┬────┘
         │                             │                             │
    ┌────┴────┐                  ┌────┴────┐                  ┌────┴────┐
    │fiskai-db│◄─────────────────│Workers  │─────────────────►│ Ollama  │
    │Postgres │   DATABASE_URL   │(16x)    │   OLLAMA_API     │ :11434  │
    │:5432    │                  │         │                  │         │
    └─────────┘                  │Redis    │                  └─────────┘
                                 │:6379    │
                                 └─────────┘
```

### VPS Roles

| Server     | IP             | Role                  | Services                                          |
| ---------- | -------------- | --------------------- | ------------------------------------------------- |
| **VPS-01** | 152.53.146.3   | Application hosting   | Next.js app, PostgreSQL, Coolify, Traefik         |
| **VPS**    | 152.53.179.101 | Background processing | 16 BullMQ workers, Redis queue, E-invoice polling |
| **VPS-03** | Separate       | Marketing             | Static marketing pages (separate repository)      |
| **GPU-01** | Tailscale only | AI inference          | Ollama models for RTL pipeline                    |

### Key Infrastructure Changes

1. **Marketing Split**: Marketing pages (`fiskai.hr`) now deployed separately from app (`app.fiskai.hr`)
2. **Workers Co-located with Redis**: Worker processes and Redis queue run on same device (VPS) for optimal performance
3. **Tailscale Mesh**: Internal services communicate over encrypted Tailscale network
4. **GHCR Image Registry**: All deployments pull pre-built images from GitHub Container Registry

---

## Docker Image Build Process

FiskAI uses a 3-image build process managed by GitHub Actions. Images are built on ARM64 architecture and published to GHCR.

### Images Produced

| Image                               | Description          | Base             | Key Dependencies                |
| ----------------------------------- | -------------------- | ---------------- | ------------------------------- |
| `ghcr.io/wandeon/fiskai-app`        | Next.js application  | `node:22-alpine` | Prisma, Drizzle, Next.js        |
| `ghcr.io/wandeon/fiskai-worker`     | RTL pipeline workers | `node:20-alpine` | BullMQ, Prisma                  |
| `ghcr.io/wandeon/fiskai-worker-ocr` | OCR worker           | `node:20-alpine` | Tesseract, Poppler, Ghostscript |

### Image Tags

Each image is tagged with:

- **Commit SHA (short)**: e.g., `abc123d` - 7-character short SHA
- **Commit SHA (full)**: e.g., `abc123def456...` - full 40-character SHA
- **`latest`**: Updated on every push to main (convenience only)

**For production deployments, always use the commit SHA tag** to ensure reproducibility.

### Build Dockerfiles

#### App Image: `Dockerfile`

Multi-stage build optimized for Next.js:

1. **base**: Node.js 22 Alpine with OpenSSL
2. **deps**: Install dependencies with npm cache mount
3. **builder**: Generate Prisma clients, build Next.js with build cache mount
4. **runner**: Production image with standalone output, Drizzle migrations, docker-entrypoint.sh

Key features:

- BuildKit cache mounts for fast warm builds
- Standalone Next.js output (minimal runtime)
- Automatic Drizzle migrations on startup via `docker-entrypoint.sh`
- Health check endpoint: `/api/health`

#### Worker Images: `Dockerfile.worker`

Build controlled by `WITH_OCR` argument:

- `WITH_OCR=false`: Standard worker (default)
- `WITH_OCR=true`: OCR worker with Tesseract, Poppler, Ghostscript

Multi-stage build:

1. **builder**: Compile TypeScript workers with `npm run build:workers`
2. **runner**: Copy compiled JavaScript and node_modules

Environment variables baked into image:

- `GIT_SHA`: Commit SHA for version tracking
- `BUILD_DATE`: Build timestamp

### Build Workflow

Located at `.github/workflows/build-and-publish-images.yml`:

```yaml
# Triggers on main branch push (excluding docs/markdown)
# Builds all 3 images in parallel
# Uses remote BuildKit on VPS-01 for ARM64 builds
# Automatically deploys app to Coolify on success
```

**Build process:**

1. GitHub Actions push to main branch
2. Parallel builds on self-hosted runner using remote ARM64 BuildKit
3. Images pushed to GHCR with SHA and latest tags
4. App deployment triggered automatically via Coolify API
5. Workers deployed manually via SSH to VPS

### Authentication to GHCR

Both servers require GHCR authentication:

```bash
# Create GitHub PAT with read:packages scope at:
# https://github.com/settings/tokens

# Authenticate Docker
echo "$GHCR_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Verify
docker pull ghcr.io/wandeon/fiskai-app:latest
```

---

## Environment Variables

### Required Variables (App)

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname
REGULATORY_DATABASE_URL=postgresql://user:password@host:5432/dbname?schema=regulatory

# Authentication
NEXTAUTH_URL=https://your-app.example.com
NEXTAUTH_SECRET=<generate: openssl rand -base64 32>

# Application
NEXT_PUBLIC_APP_NAME=FiskAI
NEXT_PUBLIC_APP_URL=https://your-app.example.com
EINVOICE_KEY_SECRET=<generate: openssl rand -hex 32>

# OAuth State Signing (required for email OAuth)
STATE_SECRET=<generate: openssl rand -hex 32>

# Fiscalisation Certificate Encryption
FISCAL_CERT_KEY=<generate: openssl rand -hex 32>

# Cron Job Authorization
CRON_SECRET=<generate: openssl rand -hex 32>
```

### Required Variables (Workers)

Workers require these environment variables in addition to database URLs:

```bash
# Redis Queue
REDIS_URL=redis://localhost:6379

# Ollama Endpoints (split for extraction vs embeddings)
# EXTRACTION: Ollama Cloud (larger models for regulatory fact extraction)
OLLAMA_EXTRACT_ENDPOINT=https://api.ollama.ai
OLLAMA_EXTRACT_MODEL=gemma-3-27b
OLLAMA_EXTRACT_API_KEY=<your-ollama-cloud-api-key>

# EMBEDDINGS: Local Ollama (fast vector generation via Tailscale)
OLLAMA_EMBED_ENDPOINT=http://100.89.2.111:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_EMBED_API_KEY=local
OLLAMA_EMBED_DIMS=768

# Legacy/fallback (used if OLLAMA_EXTRACT_* not set)
OLLAMA_ENDPOINT=https://api.ollama.ai
OLLAMA_API_KEY=<your-ollama-cloud-api-key>
OLLAMA_MODEL=llama3.1
OLLAMA_VISION_MODEL=llama3.2-vision

# E-invoice Inbound Polling (ePoslovanje integration)
EPOSLOVANJE_API_BASE=https://api.eposlovanje.gov.hr
EPOSLOVANJE_API_KEY=<your-eposlovanje-api-key>
EINVOICE_COMPANY_ID=<company-id-for-polling>
EINVOICE_POLL_INTERVAL_MS=300000
EINVOICE_MAX_WINDOW_DAYS=7

# Content Sync Worker (GitHub integration)
GITHUB_TOKEN=<github-pat-for-content-sync>
```

### Optional Variables

```bash
# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com

# AI/OCR
OPENAI_API_KEY=
DEEPSEEK_API_KEY=

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_WEBHOOK_SECRET=

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

# Worker Configuration
WORKER_CONCURRENCY=2
BULLMQ_PREFIX=fiskai
JOB_RETENTION_HOURS=24

# Watchdog Configuration
WATCHDOG_ENABLED=true
WATCHDOG_TIMEZONE=Europe/Zagreb

# Monitoring & Alerting
ADMIN_ALERT_EMAIL=admin@example.com
SLACK_WEBHOOK_URL=
SLACK_CHANNEL=#fiskai-alerts
SYSTEM_STATUS_WEBHOOK_URL=
```

### Environment Variable Scope

| Variable Category | App (VPS-01) | Workers (VPS) | Notes                         |
| ----------------- | ------------ | ------------- | ----------------------------- |
| Database URLs     | Required     | Required      | Workers connect via Tailscale |
| Authentication    | Required     | Not needed    | App-only                      |
| Redis             | Optional     | Required      | Workers use BullMQ queues     |
| Ollama            | Optional     | Required      | RTL pipeline workers          |
| ePoslovanje       | Not needed   | Required      | E-invoice inbound worker      |
| GitHub Token      | Not needed   | Required      | Content sync worker           |

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

FiskAI uses Coolify for app deployment and docker-compose for worker deployment. All images are pre-built by GitHub Actions and pulled from GHCR.

### App Deployment (Coolify on VPS-01)

The app is deployed via Coolify using the `ghcr.io/wandeon/fiskai-app` image.

**Coolify Configuration:**

- Platform: Docker
- Source: Public Docker Registry (GHCR)
- Image: `ghcr.io/wandeon/fiskai-app:latest`
- Port: 3000
- Health Check: `/api/health`
- Auto-deploy: Enabled (triggered by GitHub Actions)

**docker-compose.prod.yml** (Coolify-managed):

```yaml
# Production overrides for Coolify deployment
services:
  fiskai-db:
    environment:
      POSTGRES_USER: ${POSTGRES_USER:?POSTGRES_USER required}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}
      POSTGRES_DB: ${POSTGRES_DB:-fiskai}
    networks:
      - fiskai_internal

  fiskai-app:
    image: ghcr.io/wandeon/fiskai-app:latest
    environment:
      - DATABASE_URL=${DATABASE_URL:?DATABASE_URL required}
      - REGULATORY_DATABASE_URL=${REGULATORY_DATABASE_URL:?REGULATORY_DATABASE_URL required}
      - NEXTAUTH_URL=${NEXTAUTH_URL:?NEXTAUTH_URL required}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET:?NEXTAUTH_SECRET required}
      # AUTH_TRUST_HOST: Required when behind reverse proxy (Traefik)
      # SECURITY: This setting is safe ONLY because:
      #   1. No 'ports:' directive - container is NOT exposed to host network
      #   2. fiskai_internal network isolates container from external access
      #   3. Only Traefik (via coolify network) can reach the app
      #   4. Traefik validates Host header via routing rules before forwarding
      - AUTH_TRUST_HOST=true
      - NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME:-FiskAI}
      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:?NEXT_PUBLIC_APP_URL required}
      - EINVOICE_KEY_SECRET=${EINVOICE_KEY_SECRET:?EINVOICE_KEY_SECRET required}
      - FISCAL_CERT_KEY=${FISCAL_CERT_KEY}
      - STATE_SECRET=${STATE_SECRET:?STATE_SECRET required}
    networks:
      - fiskai_internal
      - coolify
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.fiskai.rule=Host(`${APP_DOMAIN:-app.fiskai.hr}`)"
      - "traefik.http.routers.fiskai.entrypoints=https"
      - "traefik.http.routers.fiskai.tls=true"
      - "traefik.http.routers.fiskai.tls.certresolver=letsencrypt"
      - "traefik.http.services.fiskai.loadbalancer.server.port=3000"

networks:
  fiskai_internal:
    driver: bridge
  coolify:
    external: true
```

**Deployment Steps:**

```bash
# 1. Automatic deployment (via GitHub Actions)
# When GitHub Actions completes building images, it triggers Coolify deployment automatically

# 2. Manual deployment via Coolify API
curl -X POST "http://152.53.146.3:8000/api/v1/applications/tgg4gkcco8k8s0wwg08cck40/restart" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"

# 3. Manual deployment via Coolify dashboard
# Navigate to https://ci.fiskai.hr
# Select FiskAI application
# Click "Restart" or "Redeploy"
```

### docker-entrypoint.sh

The app image includes `docker-entrypoint.sh` which runs automatically on container startup:

```bash
#!/bin/sh
set -e

echo "🔄 Running Drizzle migrations..."

# Ensure pgcrypto extension for gen_random_uuid() defaults
echo "🔑 Ensuring pgcrypto extension..."
node - <<'NODE'
const { Client } = require("pg");
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
  await client.end();
}
main().catch((error) => {
  console.error("❌ Failed to ensure pgcrypto extension:", error);
  process.exit(1);
});
NODE

# Run Drizzle migrations
if ! node ./node_modules/drizzle-kit/bin.cjs migrate --config=drizzle.config.ts; then
  echo "❌ Drizzle migrations failed"
  exit 1
fi

echo "✅ Drizzle migrations completed successfully"
echo "🚀 Starting application..."
exec node server.js
```

**Migration Behavior:**

1. Container starts
2. docker-entrypoint.sh runs Drizzle migrations automatically
3. If migrations succeed, app starts
4. If migrations fail, container exits with error

This ensures the database schema is always in sync with the application code.

---

## Worker Deployment

FiskAI uses 16 background workers for the Regulatory Truth Layer (RTL) pipeline and e-invoice processing. Workers run on VPS (152.53.179.101) and use pre-built images from GHCR.

### Worker Architecture

Workers use BullMQ for job queuing and Redis for state management. All workers are co-located with Redis on the same VPS for optimal performance.

```
┌─────────────────────────────────────────────────────────────┐
│                      VPS (152.53.179.101)                   │
│                                                             │
│  ┌────────────┐                                            │
│  │   Redis    │◄──────────┬──────────┬──────────┬────────┐ │
│  │   :6379    │           │          │          │        │ │
│  └────────────┘           │          │          │        │ │
│                           ▼          ▼          ▼        ▼ │
│  ┌────────────┐  ┌────────────┐  ┌────────┐  ┌─────────┐ │
│  │Orchestrator│  │  Sentinel  │  │Extractor│  │   OCR   │ │
│  └────────────┘  └────────────┘  └────────┘  └─────────┘ │
│  ┌────────────┐  ┌────────────┐  ┌────────┐  ┌─────────┐ │
│  │  Composer  │  │  Reviewer  │  │Releaser│  │ Arbiter │ │
│  └────────────┘  └────────────┘  └────────┘  └─────────┘ │
│  ┌────────────┐  ┌────────────┐  ┌────────┐  ┌─────────┐ │
│  │ Scheduler  │  │Cont-Drainer│  │Content │  │ Article │ │
│  └────────────┘  └────────────┘  └──Sync──┘  └─────────┘ │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │Evidence-Emb│  │ Embedding  │  │ E-invoice Inbound  │  │
│  └────────────┘  └────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Worker Services

| Worker                 | Image             | Purpose                                  | Concurrency |
| ---------------------- | ----------------- | ---------------------------------------- | ----------- |
| **orchestrator**       | fiskai-worker     | Coordinates RTL pipeline phases          | 1           |
| **sentinel**           | fiskai-worker     | Discovers new regulatory content         | 1           |
| **extractor**          | fiskai-worker     | Extracts regulatory facts using LLM      | 1           |
| **ocr**                | fiskai-worker-ocr | OCR processing for scanned PDFs          | 1           |
| **composer**           | fiskai-worker     | Aggregates facts into regulatory rules   | 1           |
| **reviewer**           | fiskai-worker     | Quality checks on generated rules        | 1           |
| **arbiter**            | fiskai-worker     | Conflict resolution between rules        | 1           |
| **releaser**           | fiskai-worker     | Publishes approved rules to production   | 1           |
| **scheduler**          | fiskai-worker     | Watchdog for pipeline health             | N/A         |
| **continuous-drainer** | fiskai-worker     | Drains completed jobs from queues        | N/A         |
| **content-sync**       | fiskai-worker     | Syncs content to GitHub repository       | 1           |
| **article**            | fiskai-worker     | Generates regulatory articles            | 1           |
| **evidence-embedding** | fiskai-worker     | Generates embeddings for evidence        | 2           |
| **embedding**          | fiskai-worker     | Generates embeddings for rules           | 2           |
| **einvoice-inbound**   | fiskai-worker     | Polls ePoslovanje for inbound e-invoices | N/A         |

### Worker Configuration File

Workers are configured via `docker-compose.workers.yml`:

```yaml
# Usage:
#   IMAGE_TAG=abc123 docker compose -f docker-compose.workers.yml up -d
#
# IMAGE_TAG can be:
#   - A commit SHA (e.g., abc123def) - recommended for production
#   - "latest" - convenience tag, updated on each main push
#   - A full digest (e.g., sha256:abc...) - most reproducible

services:
  redis:
    image: redis:7-alpine
    container_name: fiskai-redis
    restart: unless-stopped
    volumes:
      - fiskai_redis_data:/data
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy noeviction
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - default
      - coolify

  worker-orchestrator:
    image: ghcr.io/wandeon/fiskai-worker:${IMAGE_TAG:-latest}
    container_name: fiskai-worker-orchestrator
    restart: unless-stopped
    command: ["node", "dist/workers/lib/regulatory-truth/workers/orchestrator.worker.js"]
    environment:
      NODE_ENV: production
      REDIS_URL: redis://fiskai-redis:6379
      DATABASE_URL: ${DATABASE_URL}
      REGULATORY_DATABASE_URL: ${REGULATORY_DATABASE_URL}
      WORKER_TYPE: orchestrator
      WORKER_CONCURRENCY: 1
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - default
      - coolify
    deploy:
      resources:
        limits:
          memory: 512M
```

### Deployment Steps

#### 1. Verify GHCR Authentication

```bash
# SSH to worker server
ssh admin@152.53.179.101

# Test GHCR access
docker pull ghcr.io/wandeon/fiskai-worker:latest
```

If authentication fails, re-authenticate:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

#### 2. Deploy Workers

Using the deployment script (recommended):

```bash
# Navigate to project directory
cd /home/admin/FiskAI

# Deploy with specific commit SHA
IMAGE_TAG=abc123def ./scripts/deploy-workers.sh

# Or deploy latest
IMAGE_TAG=latest ./scripts/deploy-workers.sh
```

Manual deployment:

```bash
# Export IMAGE_TAG
export IMAGE_TAG=abc123def

# Pull images
docker compose -f docker-compose.workers.yml pull

# Recreate containers
docker compose -f docker-compose.workers.yml up -d --remove-orphans
```

#### 3. Verify Deployment

Check running containers:

```bash
docker compose -f docker-compose.workers.yml ps
```

Expected output:

```
NAME                             STATUS              PORTS
fiskai-redis                     Up (healthy)        6379/tcp
fiskai-worker-orchestrator       Up
fiskai-worker-sentinel           Up
fiskai-worker-extractor          Up
... (all 16 workers should be Up)
```

Check image versions:

```bash
docker compose -f docker-compose.workers.yml images
```

View logs:

```bash
# All workers
docker compose -f docker-compose.workers.yml logs -f

# Specific worker
docker compose -f docker-compose.workers.yml logs -f worker-extractor
```

### Worker Environment Variables

Workers read environment variables from `.env` file in project directory:

```bash
# /home/admin/FiskAI/.env
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public
REGULATORY_DATABASE_URL=postgresql://user:pass@host:5432/db?schema=regulatory

REDIS_URL=redis://fiskai-redis:6379

OLLAMA_EXTRACT_ENDPOINT=https://api.ollama.ai
OLLAMA_EXTRACT_API_KEY=your-key
OLLAMA_EXTRACT_MODEL=gemma-3-27b

OLLAMA_EMBED_ENDPOINT=http://100.89.2.111:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_EMBED_API_KEY=local
OLLAMA_EMBED_DIMS=768

OLLAMA_ENDPOINT=https://api.ollama.ai
OLLAMA_API_KEY=your-key
OLLAMA_MODEL=llama3.1
OLLAMA_VISION_MODEL=llama3.2-vision

EPOSLOVANJE_API_BASE=https://api.eposlovanje.gov.hr
EPOSLOVANJE_API_KEY=your-key
EINVOICE_COMPANY_ID=company-id
EINVOICE_POLL_INTERVAL_MS=300000
EINVOICE_MAX_WINDOW_DAYS=7

GITHUB_TOKEN=ghp_your-token

WATCHDOG_TIMEZONE=Europe/Zagreb
```

### Worker Monitoring

#### Queue Status

Check queue health:

```bash
npx tsx scripts/queue-status.ts
```

#### Worker Health

Individual worker logs:

```bash
docker logs fiskai-worker-extractor --tail 50
docker logs fiskai-worker-ocr --tail 50
```

Resource usage:

```bash
docker stats --no-stream
```

#### Common Issues

**Worker not starting:**

- Check logs: `docker logs fiskai-worker-<name>`
- Verify environment variables in `.env`
- Confirm Redis is healthy: `docker logs fiskai-redis`

**Worker keeps restarting:**

- Check memory limits in docker-compose.workers.yml
- Verify Ollama endpoints are accessible via Tailscale
- Check database connectivity

**Jobs not processing:**

- Verify Redis connection: `redis-cli -h localhost ping`
- Check queue backlog: `npx tsx scripts/queue-status.ts`
- Verify WORKER_CONCURRENCY setting

### Rollback Procedure

To rollback to a previous version:

1. Find the previous commit SHA from GitHub or git log
2. Deploy with old SHA:
   ```bash
   IMAGE_TAG=<previous-sha> ./scripts/deploy-workers.sh
   ```
3. Verify rollback:
   ```bash
   docker compose -f docker-compose.workers.yml images
   ```

### Local Development

For local development, use the dev override to build locally:

```bash
docker compose -f docker-compose.workers.yml -f docker-compose.workers.dev.yml up -d --build
```

Or run workers directly with tsx:

```bash
# Run individual worker for testing
npx tsx src/lib/regulatory-truth/scripts/run-extractor.ts [evidenceId]
npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts --fetch
```

**CRITICAL: Never rebuild Docker images for code testing!** Docker builds take 10-15 minutes. Always test changes locally with tsx first, then rebuild images only when verified working.

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

---

## Related Documentation

### Infrastructure & Operations

- **[GHCR Image Delivery](./ops/ghcr-delivery.md)** - Complete guide to image build and delivery pipeline
- **[Coolify Setup](./infrastructure/coolify-setup.md)** - Coolify installation and configuration guide
- **[Clean Production Topology](./incidents/2026-01-13-vps02-compromise/2026-01-13-clean-production-topology.md)** - Zero-trust production architecture design
- **[Worker Build Authority](./operations/WORKER_BUILD_AUTHORITY.md)** - CI/CD pipeline for worker images
- **[Marketing Separation](./operations/MARKETING_SEPARATION.md)** - Marketing site separation from app

### Architecture

- **[Regulatory Truth Layer](./01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md)** - Complete RTL pipeline architecture
- **[Domain Ownership](./architecture/DOMAIN_OWNERSHIP.md)** - Domain and subdomain configuration

### Environment Configuration

- **[Environment Variables Inventory](./_meta/inventory/env-vars.md)** - Complete inventory of all environment variables
- **[.env.example](../.env.example)** - Template for environment configuration

### Security

- **[Security Rotation Checklist](./07_AUDITS/SECURITY_ROTATION_CHECKLIST.md)** - Secret rotation procedures
- **[VPS-01 Inspection](./audits/VPS-01-INSPECTION-2026-01-09.md)** - VPS-01 security audit
- **[Network Isolation Security](./04_OPERATIONS/NETWORK_ISOLATION_SECURITY.md)** - Network security architecture

### Monitoring & Troubleshooting

- **[Queue Status Script](../scripts/queue-status.ts)** - Check BullMQ queue health
- **[Verify AI Setup](../scripts/verify-ai-setup.sh)** - Test Ollama connectivity
- **[Regulatory Truth Scripts](../src/lib/regulatory-truth/scripts/README.md)** - Manual worker execution scripts

---

## Quick Reference

### Server IPs

| Server | Public IP      | Tailscale IP  | Purpose          |
| ------ | -------------- | ------------- | ---------------- |
| VPS-01 | 152.53.146.3   | 100.64.123.81 | App, DB, Coolify |
| VPS    | 152.53.179.101 | (internal)    | Workers, Redis   |
| GPU-01 | (none)         | 100.100.47.43 | Ollama models    |

### Key URLs

| Service                | URL                        |
| ---------------------- | -------------------------- |
| Application            | https://app.fiskai.hr      |
| Marketing              | https://fiskai.hr          |
| Coolify Dashboard      | https://ci.fiskai.hr       |
| PostgreSQL (Tailscale) | 100.64.123.81:5432         |
| Redis (Workers)        | localhost:6379 (VPS only)  |
| Ollama (Tailscale)     | http://100.100.47.43:11434 |

### Docker Images

| Image      | Registry URL                      | Purpose                       |
| ---------- | --------------------------------- | ----------------------------- |
| App        | ghcr.io/wandeon/fiskai-app        | Next.js application           |
| Worker     | ghcr.io/wandeon/fiskai-worker     | Background workers (standard) |
| Worker OCR | ghcr.io/wandeon/fiskai-worker-ocr | OCR worker with Tesseract     |

### Critical Commands

```bash
# Check app status (VPS-01)
docker ps | grep fiskai-app
docker logs fiskai-app --tail 50

# Check worker status (VPS)
docker compose -f docker-compose.workers.yml ps
docker compose -f docker-compose.workers.yml logs -f worker-extractor

# Check database connectivity
docker exec fiskai-db psql -U fiskai -d fiskai -c "SELECT version();"

# Check Redis connectivity
redis-cli -h localhost ping

# Deploy workers with specific SHA
IMAGE_TAG=abc123def ./scripts/deploy-workers.sh

# Trigger Coolify deployment
curl -X POST "http://152.53.146.3:8000/api/v1/applications/tgg4gkcco8k8s0wwg08cck40/restart" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"
```
