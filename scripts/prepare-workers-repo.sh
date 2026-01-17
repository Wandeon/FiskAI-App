#!/bin/bash
# =============================================================================
# prepare-workers-repo.sh
# =============================================================================
# Creates a directory structure for the fiskai-workers repository.
# This script prepares all files needed to set up the workers repo as a
# separate GitHub repository.
#
# Based on: docs/plans/2026-01-17-repo-split-design.md
#
# Usage:
#   ./scripts/prepare-workers-repo.sh [TARGET_DIR]
#
# If TARGET_DIR is not specified, defaults to ../fiskai-workers-staging
#
# This script is IDEMPOTENT - safe to run multiple times.
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_REPO="$(dirname "$SCRIPT_DIR")"

# Target directory (default to sibling directory)
TARGET_DIR="${1:-$SOURCE_REPO/../fiskai-workers-staging}"

# Resolve to absolute path
TARGET_DIR="$(cd "$(dirname "$TARGET_DIR")" 2>/dev/null && pwd)/$(basename "$TARGET_DIR")" || TARGET_DIR="$(pwd)/../fiskai-workers-staging"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  FiskAI Workers Repository Preparation    ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "Source repo: ${GREEN}$SOURCE_REPO${NC}"
echo -e "Target dir:  ${GREEN}$TARGET_DIR${NC}"
echo ""

# =============================================================================
# FILE MANIFEST
# =============================================================================
# These are the files that will be copied or created for the workers repo.

# Directories to copy entirely
COPY_DIRS=(
    "src/lib/regulatory-truth"       # Complete RTL system
    "src/lib/e-invoice/workers"      # E-invoice inbound poller
    "src/generated/regulatory-client" # Generated Prisma client (if exists)
)

# Individual files to copy
COPY_FILES=(
    # Core infrastructure
    "src/lib/ai/ollama-client.ts"
    "src/lib/db/index.ts"
    "src/lib/db/regulatory.ts"
    "src/lib/db/core.ts"
    "src/lib/logging/index.ts"
    "src/lib/logging/logger.ts"
    "src/lib/cache/index.ts"
    "src/lib/cache/redis.ts"
    "src/lib/infra/redis.ts"
    "src/lib/infra/circuit-breaker.ts"
    "src/lib/shared/dsl/index.ts"
    "src/lib/shared/queue-contracts.ts"

    # Prisma
    "prisma/regulatory.prisma"
    "prisma.config.regulatory.ts"

    # Docker
    "Dockerfile.worker"
    "docker-compose.workers.yml"
    "docker-compose.workers.dev.yml"
    "docker-compose.workers.override.yml"

    # TypeScript config
    "tsconfig.workers.json"

    # Documentation
    "docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md"
    "docs/operations/WORKER_BUILD_AUTHORITY.md"
    "docs/operations/BUILD_AUTHORITY.md"
    "docs/operations/WORKER_DEPLOYMENT_INTEGRITY.md"
    "docs/operations/BACKFILL_OPERATOR_RUNBOOK.md"
)

# Worker-related scripts to copy
WORKER_SCRIPTS=(
    "scripts/build-workers.sh"
    "scripts/deploy-workers.sh"
    "scripts/queue-status.ts"
    "scripts/trigger-pipeline.ts"
    "scripts/trigger-full-pipeline.ts"
    "scripts/trigger-arbiter.ts"
    "scripts/drain-content-sync.ts"
    "scripts/test-pipeline.ts"
    "scripts/run-full-pipeline-demo.ts"
    "scripts/backfill-evidence-embeddings.ts"
    "scripts/backfill-candidatefacts.ts"
    "scripts/backfill-run.ts"
    "scripts/check-regulatory-integrity.ts"
    "scripts/check-db-counts.ts"
    "scripts/audit-ocr.ts"
    "scripts/inspect-queues.ts"
    "scripts/pipeline-trace.ts"
    "scripts/analyze-orphaned-evidence.ts"
    "scripts/cleanup-orphaned-evidence.ts"
    "scripts/cleanup-orphan-pointers.ts"
    "scripts/test-ai.ts"
    "scripts/test-embedding-sync.ts"
    "scripts/test-extract-queue.ts"
    "scripts/test-single-extraction.ts"
    "scripts/test-batch-extraction.ts"
)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

copy_file() {
    local src="$1"
    local dest="$2"

    if [[ -f "$src" ]]; then
        mkdir -p "$(dirname "$dest")"
        cp "$src" "$dest"
        log_success "Copied: $(basename "$src")"
    else
        log_warn "Source not found: $src"
    fi
}

copy_dir() {
    local src="$1"
    local dest="$2"

    if [[ -d "$src" ]]; then
        mkdir -p "$(dirname "$dest")"
        cp -r "$src" "$dest"
        log_success "Copied directory: $(basename "$src")"
    else
        log_warn "Source directory not found: $src"
    fi
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

# Create target directory
mkdir -p "$TARGET_DIR"
log_info "Created target directory: $TARGET_DIR"

# -----------------------------------------------------------------------------
# Copy directories
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}=== Copying directories ===${NC}"

for dir in "${COPY_DIRS[@]}"; do
    src="$SOURCE_REPO/$dir"
    dest="$TARGET_DIR/$dir"
    copy_dir "$src" "$dest"
done

# -----------------------------------------------------------------------------
# Copy individual files
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}=== Copying individual files ===${NC}"

for file in "${COPY_FILES[@]}"; do
    src="$SOURCE_REPO/$file"
    dest="$TARGET_DIR/$file"
    copy_file "$src" "$dest"
done

# -----------------------------------------------------------------------------
# Copy worker scripts
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}=== Copying worker scripts ===${NC}"

for script in "${WORKER_SCRIPTS[@]}"; do
    src="$SOURCE_REPO/$script"
    dest="$TARGET_DIR/$script"
    copy_file "$src" "$dest"
done

# -----------------------------------------------------------------------------
# Create workers-specific package.json
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}=== Creating package.json ===${NC}"

cat > "$TARGET_DIR/package.json" << 'PACKAGE_JSON'
{
  "name": "fiskai-workers",
  "version": "0.1.0",
  "private": true,
  "description": "FiskAI Regulatory Truth Layer workers - background processing for Croatian regulatory content",
  "scripts": {
    "worker:sentinel": "npx tsx src/lib/regulatory-truth/workers/sentinel.worker.ts",
    "worker:extractor": "npx tsx src/lib/regulatory-truth/workers/extractor.worker.ts",
    "worker:composer": "npx tsx src/lib/regulatory-truth/workers/composer.worker.ts",
    "worker:reviewer": "npx tsx src/lib/regulatory-truth/workers/reviewer.worker.ts",
    "worker:arbiter": "npx tsx src/lib/regulatory-truth/workers/arbiter.worker.ts",
    "worker:releaser": "npx tsx src/lib/regulatory-truth/workers/releaser.worker.ts",
    "worker:orchestrator": "npx tsx src/lib/regulatory-truth/workers/orchestrator.worker.ts",
    "worker:scheduler": "npx tsx src/lib/regulatory-truth/workers/scheduler.service.ts",
    "worker:ocr": "npx tsx src/lib/regulatory-truth/workers/ocr.worker.ts",
    "worker:embedding": "npx tsx src/lib/regulatory-truth/workers/embedding.worker.ts",
    "worker:evidence-embedding": "npx tsx src/lib/regulatory-truth/workers/evidence-embedding.worker.ts",
    "worker:content-sync": "npx tsx src/lib/regulatory-truth/workers/content-sync.worker.ts",
    "worker:article": "npx tsx src/lib/regulatory-truth/workers/article.worker.ts",
    "worker:einvoice-inbound": "npx tsx src/lib/e-invoice/workers/eposlovanje-inbound-poller.worker.ts",
    "bull-board": "npx tsx src/lib/regulatory-truth/workers/bull-board.server.ts",
    "build:workers": "tsc -p tsconfig.workers.json && tsc-alias -p tsconfig.workers.json && cp -r src/generated dist/workers/",
    "workers:start": "docker compose -f docker-compose.workers.yml up -d",
    "workers:stop": "docker compose -f docker-compose.workers.yml down",
    "workers:logs": "docker compose -f docker-compose.workers.yml logs -f",
    "workers:status": "docker compose -f docker-compose.workers.yml ps",
    "lint": "eslint src --ext .ts",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate --config=prisma.config.regulatory.ts",
    "prisma:push": "prisma db push --config=prisma.config.regulatory.ts",
    "prisma:migrate": "prisma migrate deploy --config=prisma.config.regulatory.ts",
    "prisma:studio": "prisma studio --config=prisma.config.regulatory.ts",
    "queue:status": "npx tsx scripts/queue-status.ts",
    "queue:inspect": "npx tsx scripts/inspect-queues.ts",
    "pipeline:trigger": "npx tsx scripts/trigger-pipeline.ts",
    "pipeline:test": "npx tsx scripts/test-pipeline.ts",
    "postinstall": "npm run prisma:generate"
  },
  "dependencies": {
    "@bull-board/api": "^6.15.0",
    "@bull-board/express": "^6.15.0",
    "@prisma/client": "^7.1.0",
    "bullmq": "^5.66.2",
    "cron": "^4.4.0",
    "date-fns": "^4.1.0",
    "decimal.js": "^10.6.0",
    "dotenv": "^16.4.7",
    "express": "^5.2.1",
    "fast-xml-parser": "^4.5.0",
    "ioredis": "^5.8.2",
    "jsdom": "^27.3.0",
    "mammoth": "^1.11.0",
    "node-cron": "^4.2.1",
    "opossum": "^9.0.0",
    "pdf-parse": "^1.1.4",
    "pg": "^8.16.3",
    "pino": "^10.1.0",
    "pino-pretty": "^13.1.3",
    "rss-parser": "^3.13.0",
    "sharp": "^0.34.5",
    "word-extractor": "^1.0.4",
    "zod": "^4.1.13"
  },
  "devDependencies": {
    "@types/express": "^5.0.6",
    "@types/jsdom": "^27.0.0",
    "@types/node": "^20.19.27",
    "@types/node-cron": "^3.0.11",
    "@types/opossum": "^8.1.9",
    "@types/pdf-parse": "^1.1.5",
    "@types/pg": "^8.15.6",
    "@types/word-extractor": "^1.0.6",
    "eslint": "^8",
    "prisma": "^7.1.0",
    "tsc-alias": "^1.8.16",
    "tsx": "^4.21.0",
    "typescript": "^5",
    "vitest": "^4.0.16"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
PACKAGE_JSON
log_success "Created package.json"

# -----------------------------------------------------------------------------
# Create standalone tsconfig.json (not extending app tsconfig)
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}=== Creating tsconfig.json ===${NC}"

cat > "$TARGET_DIR/tsconfig.json" << 'TSCONFIG_JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist/workers",
    "rootDir": "src",
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true,
    "noEmit": false,
    "paths": {
      "@/*": ["./src/*"]
    },
    "baseUrl": "."
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/__tests__/**"
  ]
}
TSCONFIG_JSON
log_success "Created tsconfig.json"

# -----------------------------------------------------------------------------
# Create .env.example
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}=== Creating .env.example ===${NC}"

cat > "$TARGET_DIR/.env.example" << 'ENV_EXAMPLE'
# =============================================================================
# fiskai-workers Environment Variables
# =============================================================================
# Copy this file to .env.local and fill in the values

# -----------------------------------------------------------------------------
# Database Connections
# -----------------------------------------------------------------------------
# Core database (read-only access for company/tenant context)
DATABASE_URL=postgresql://fiskai:password@localhost:5432/fiskai?schema=public

# Regulatory database (full access for RTL data)
REGULATORY_DATABASE_URL=postgresql://fiskai:password@localhost:5432/fiskai?schema=regulatory

# -----------------------------------------------------------------------------
# Redis / Queue Configuration
# -----------------------------------------------------------------------------
REDIS_URL=redis://localhost:6379
BULLMQ_PREFIX=fiskai

# -----------------------------------------------------------------------------
# Worker Configuration
# -----------------------------------------------------------------------------
WORKER_CONCURRENCY=2
JOB_RETENTION_HOURS=24
WATCHDOG_ENABLED=true
WATCHDOG_TIMEZONE=Europe/Zagreb

# RTL Pipeline Mode: PHASE_D | LEGACY | OFF
RTL_PIPELINE_MODE=OFF

# -----------------------------------------------------------------------------
# LLM Configuration (Ollama)
# -----------------------------------------------------------------------------
# Extraction (large models for regulatory fact extraction)
OLLAMA_EXTRACT_ENDPOINT=https://ollama-cloud.example.com/api
OLLAMA_EXTRACT_API_KEY=your-api-key
OLLAMA_EXTRACT_MODEL=gemma-3-27b

# Embeddings (local/fast models for vector generation)
OLLAMA_EMBED_ENDPOINT=http://100.100.47.43:11434/api
OLLAMA_EMBED_API_KEY=
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_EMBED_DIMS=768

# General purpose (fallback)
OLLAMA_ENDPOINT=http://100.100.47.43:11434/api
OLLAMA_API_KEY=
OLLAMA_MODEL=llama3.1

# Vision model for OCR
OLLAMA_VISION_MODEL=llama3.2-vision

# -----------------------------------------------------------------------------
# E-Invoice Configuration
# -----------------------------------------------------------------------------
EPOSLOVANJE_API_BASE=https://api.eposlovanje.hr
EPOSLOVANJE_API_KEY=your-api-key
EINVOICE_POLL_INTERVAL_MS=300000
EINVOICE_TENANT_DELAY_MS=10000
EINVOICE_MAX_WINDOW_DAYS=7

# -----------------------------------------------------------------------------
# Content Sync (GitHub)
# -----------------------------------------------------------------------------
GITHUB_TOKEN=your-github-pat

# -----------------------------------------------------------------------------
# Observability
# -----------------------------------------------------------------------------
LOG_LEVEL=info
ENV_EXAMPLE
log_success "Created .env.example"

# -----------------------------------------------------------------------------
# Create .gitignore
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}=== Creating .gitignore ===${NC}"

cat > "$TARGET_DIR/.gitignore" << 'GITIGNORE'
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
*.tsbuildinfo

# Environment files
.env
.env.local
.env.*.local

# Prisma
src/generated/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*
pnpm-debug.log*

# Test coverage
coverage/

# Temporary files
tmp/
temp/
*.tmp
GITIGNORE
log_success "Created .gitignore"

# -----------------------------------------------------------------------------
# Create README.md
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}=== Creating README.md ===${NC}"

cat > "$TARGET_DIR/README.md" << 'README'
# fiskai-workers

Background worker services for the FiskAI Regulatory Truth Layer (RTL).

## Overview

This repository contains the worker processes that:

1. **Discover** regulatory content from Croatian government sources (Narodne novine, Porezna uprava, FINA)
2. **Extract** facts from PDFs and web pages using LLM-based analysis
3. **Compose** extracted facts into validated regulatory rules
4. **Review** rules for quality and consistency
5. **Publish** rules to the production database

## Architecture

```
Layer A: Daily Discovery (Scheduled)
├── Sentinel Worker - Scans regulatory endpoints
└── Creates Evidence records

Layer B: 24/7 Processing (Continuous)
├── OCR Worker - Tesseract + Vision for scanned PDFs
├── Extractor - LLM-based fact extraction
├── Composer - Aggregates facts into rules
├── Reviewer - Quality checks
├── Arbiter - Conflict resolution
└── Releaser - Publication to production
```

## Workers

| Worker | Purpose |
|--------|---------|
| orchestrator | Main pipeline coordinator |
| sentinel | Scrapes regulatory sources |
| extractor | Extracts facts using LLM |
| ocr | OCR for scanned PDFs |
| composer | Composes facts into rules |
| reviewer | Quality checks |
| arbiter | Conflict resolution |
| releaser | Publishes rules |
| scheduler | Schedules daily tasks |
| content-sync | Syncs to GitHub |
| embedding | Rule embeddings |
| evidence-embedding | Evidence embeddings |
| einvoice-inbound | E-invoice polling |

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Copy and configure environment
cp .env.example .env.local

# Run a worker locally
npm run worker:sentinel

# Check queue status
npm run queue:status

# Start all workers (Docker)
npm run workers:start
```

## Environment Variables

See `.env.example` for all required configuration.

Key variables:
- `DATABASE_URL` - Core database (read-only)
- `REGULATORY_DATABASE_URL` - Regulatory database (read/write)
- `REDIS_URL` - BullMQ queue backend
- `OLLAMA_*` - LLM configuration

## Deployment

Workers are deployed via Docker Compose:

```bash
# Build images
./scripts/build-workers.sh

# Deploy to production
./scripts/deploy-workers.sh
```

See `docs/operations/WORKER_BUILD_AUTHORITY.md` for CI/CD details.

## Documentation

- [RTL Architecture](docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md)
- [Worker Build Authority](docs/operations/WORKER_BUILD_AUTHORITY.md)
- [Backfill Runbook](docs/operations/BACKFILL_OPERATOR_RUNBOOK.md)
README
log_success "Created README.md"

# -----------------------------------------------------------------------------
# Create CLAUDE.md for AI assistants
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}=== Creating CLAUDE.md ===${NC}"

cat > "$TARGET_DIR/CLAUDE.md" << 'CLAUDEMD'
# FiskAI Workers - Project Notes

> Canonical document for AI assistants working with the workers repository.

## Repository Purpose

This repository contains background worker services for the FiskAI Regulatory Truth Layer (RTL).
It processes Croatian regulatory content into verified, evidence-backed rules.

**This is NOT a web application.** There is no Next.js, no React, no frontend code.

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/lib/regulatory-truth/workers/` | 15+ BullMQ worker implementations |
| `src/lib/regulatory-truth/agents/` | LLM agents for extraction/composition |
| `src/lib/regulatory-truth/pipeline/` | Orchestration logic |
| `src/lib/regulatory-truth/services/` | Core services |
| `src/lib/db/` | Database clients (Prisma) |
| `src/lib/ai/` | Ollama LLM client |
| `scripts/` | Operational scripts |

## Worker Architecture

Workers use BullMQ with Redis as the queue backend.

**Two-layer execution:**
- Layer A (Scheduled): Daily discovery by sentinel
- Layer B (Continuous): 24/7 processing pipeline

**Key invariants:**
- Every rule has evidence-backed source pointers
- No hallucinations - LLM outputs verified against sources
- Fail-closed - ambiguous content goes to human review
- Evidence.rawContent is immutable

## Running Workers

```bash
# Run locally with tsx
npx tsx src/lib/regulatory-truth/workers/sentinel.worker.ts

# Check queue status
npm run queue:status

# Docker deployment
npm run workers:start
```

## Database

Two Prisma schemas:
- `prisma/regulatory.prisma` - RTL data (full access)
- Core database accessed read-only for tenant context

## Environment

Required variables (see .env.example):
- `DATABASE_URL` / `REGULATORY_DATABASE_URL`
- `REDIS_URL`
- `OLLAMA_*` (extraction, embedding endpoints)

## Development Workflow

1. Test workers locally with `npx tsx`
2. Verify with `npm run queue:status`
3. Only rebuild Docker when changes are verified

**Never rebuild Docker images just to test code changes** - use tsx for fast iteration.
CLAUDEMD
log_success "Created CLAUDE.md"

# -----------------------------------------------------------------------------
# Create Dockerfile (modified from Dockerfile.worker)
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}=== Creating Dockerfile ===${NC}"

cat > "$TARGET_DIR/Dockerfile" << 'DOCKERFILE'
# Dockerfile for fiskai-workers
# Builds the worker image - compiles TypeScript and runs JavaScript with Node.js

FROM node:20-alpine@sha256:658d0f63e501824d6c23e06d4bb95c71e7d704537c9d9272f488ac03a370d448 AS base

# Build stage - install all deps
FROM base AS builder

# Build args for version tracking (set by CI/deploy)
ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown

WORKDIR /app

# Install build tools for native modules
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./

# Copy prisma schema and config before npm ci (needed for postinstall prisma generate)
COPY prisma ./prisma
COPY prisma.config.regulatory.ts ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Compile workers to JavaScript
RUN npm run build:workers

# Production image
FROM base AS runner
WORKDIR /app

# Bake version info into image
ARG GIT_SHA
ARG BUILD_DATE
ENV GIT_SHA=${GIT_SHA}
ENV BUILD_DATE=${BUILD_DATE}

ENV NODE_ENV=production

# ========== OCR DEPENDENCIES (conditional) ==========
ARG WITH_OCR=false
RUN if [ "$WITH_OCR" = "true" ]; then \
    apk add --no-cache \
        tesseract-ocr \
        tesseract-ocr-data-hrv \
        tesseract-ocr-data-eng \
        poppler-utils \
        ghostscript; \
    fi
# ====================================================

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 worker

# Copy everything needed to run workers (with proper ownership)
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/src ./src
COPY --from=builder --chown=worker:nodejs /app/dist ./dist
COPY --from=builder --chown=worker:nodejs /app/prisma ./prisma
COPY --from=builder --chown=worker:nodejs /app/package.json ./
COPY --from=builder --chown=worker:nodejs /app/tsconfig.json ./
COPY --from=builder --chown=worker:nodejs /app/prisma.config.regulatory.ts ./

USER worker

# Default command - run compiled JavaScript (override in docker-compose)
CMD ["node", "dist/workers/lib/regulatory-truth/workers/orchestrator.worker.js"]
DOCKERFILE
log_success "Created Dockerfile"

# -----------------------------------------------------------------------------
# Create .dockerignore
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}=== Creating .dockerignore ===${NC}"

cat > "$TARGET_DIR/.dockerignore" << 'DOCKERIGNORE'
# Git
.git
.gitignore

# Dependencies (will be reinstalled)
node_modules

# Build artifacts
dist

# Environment files
.env
.env.*
!.env.example

# Documentation
docs/
*.md
!README.md

# Tests
**/*.test.ts
**/__tests__/
coverage/

# IDE
.idea/
.vscode/

# OS
.DS_Store
DOCKERIGNORE
log_success "Created .dockerignore"

# -----------------------------------------------------------------------------
# Create GitHub Actions workflow
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}=== Creating GitHub Actions workflow ===${NC}"

mkdir -p "$TARGET_DIR/.github/workflows"

cat > "$TARGET_DIR/.github/workflows/ci.yml" << 'CI_WORKFLOW'
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma client
        run: npm run prisma:generate

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

  build:
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma client
        run: npm run prisma:generate

      - name: Build workers
        run: npm run build:workers

      - name: Verify build output
        run: |
          test -d dist/workers
          ls -la dist/workers/lib/regulatory-truth/workers/

  build-docker:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push worker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/fiskai-worker:${{ github.sha }}
            ghcr.io/${{ github.repository_owner }}/fiskai-worker:latest
          build-args: |
            GIT_SHA=${{ github.sha }}
            BUILD_DATE=${{ github.event.head_commit.timestamp }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push worker-ocr image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/fiskai-worker-ocr:${{ github.sha }}
            ghcr.io/${{ github.repository_owner }}/fiskai-worker-ocr:latest
          build-args: |
            GIT_SHA=${{ github.sha }}
            BUILD_DATE=${{ github.event.head_commit.timestamp }}
            WITH_OCR=true
          cache-from: type=gha
          cache-to: type=gha,mode=max
CI_WORKFLOW
log_success "Created .github/workflows/ci.yml"

# -----------------------------------------------------------------------------
# Create directory structure for missing files
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}=== Creating placeholder directories ===${NC}"

# Create src directories that might not exist
mkdir -p "$TARGET_DIR/src/lib/ai"
mkdir -p "$TARGET_DIR/src/lib/db"
mkdir -p "$TARGET_DIR/src/lib/logging"
mkdir -p "$TARGET_DIR/src/lib/cache"
mkdir -p "$TARGET_DIR/src/lib/infra"
mkdir -p "$TARGET_DIR/src/lib/shared/dsl"
mkdir -p "$TARGET_DIR/src/generated"
mkdir -p "$TARGET_DIR/prisma"
mkdir -p "$TARGET_DIR/scripts"
mkdir -p "$TARGET_DIR/docs/01_ARCHITECTURE"
mkdir -p "$TARGET_DIR/docs/operations"

log_success "Created placeholder directories"

# -----------------------------------------------------------------------------
# Final Summary
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Preparation Complete!                    ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "Target directory: ${BLUE}$TARGET_DIR${NC}"
echo ""
echo "Directory structure created with:"
echo "  - package.json (workers-specific dependencies)"
echo "  - tsconfig.json (standalone TypeScript config)"
echo "  - Dockerfile (with OCR support option)"
echo "  - docker-compose.workers.yml"
echo "  - .env.example"
echo "  - .gitignore"
echo "  - README.md"
echo "  - CLAUDE.md"
echo "  - .github/workflows/ci.yml"
echo ""
echo "Files copied from source repo (if they exist):"
echo "  - src/lib/regulatory-truth/ (RTL system)"
echo "  - src/lib/e-invoice/workers/ (e-invoice poller)"
echo "  - prisma/regulatory.prisma"
echo "  - Worker-related scripts"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. cd $TARGET_DIR"
echo "  2. Review and customize the generated files"
echo "  3. git init && git add -A && git commit -m 'Initial workers repo'"
echo "  4. Create GitHub repository: gh repo create fiskai-workers --private"
echo "  5. git remote add origin git@github.com:wandeon/fiskai-workers.git"
echo "  6. git push -u origin main"
echo ""

# -----------------------------------------------------------------------------
# Print file manifest for documentation
# -----------------------------------------------------------------------------
echo -e "${YELLOW}=== File Manifest (for reference) ===${NC}"
echo ""
echo "Files that WOULD be copied (source -> workers repo):"
echo ""
echo "DIRECTORIES:"
for dir in "${COPY_DIRS[@]}"; do
    echo "  $dir/"
done
echo ""
echo "FILES:"
for file in "${COPY_FILES[@]}"; do
    echo "  $file"
done
echo ""
echo "SCRIPTS:"
for script in "${WORKER_SCRIPTS[@]}"; do
    echo "  $script"
done
