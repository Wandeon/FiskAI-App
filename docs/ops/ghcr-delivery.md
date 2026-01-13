# GHCR Image Delivery

This document describes how FiskAI application and worker images are built, published, and deployed.

## Overview

All Docker images are built by GitHub Actions and pushed to GitHub Container Registry (GHCR). Production deployments pull pre-built images rather than building on the server.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  GitHub Push    │────▶│  GitHub Actions │────▶│      GHCR       │
│  (main branch)  │     │  (Build Images) │     │  (Image Store)  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                         ┌───────────────────────────────┤
                         │                               │
                         ▼                               ▼
                ┌─────────────────┐             ┌─────────────────┐
                │  VPS-01         │             │  VPS            │
                │  152.53.146.3   │             │  152.53.179.101 │
                │  Coolify (App)  │             │  Workers        │
                └─────────────────┘             └─────────────────┘
```

## Images Produced

| Image                               | Description                 | Platform    |
| ----------------------------------- | --------------------------- | ----------- |
| `ghcr.io/wandeon/fiskai-app`        | Next.js application         | linux/arm64 |
| `ghcr.io/wandeon/fiskai-worker`     | RTL pipeline workers        | linux/arm64 |
| `ghcr.io/wandeon/fiskai-worker-ocr` | OCR worker (with Tesseract) | linux/arm64 |

## Tagging Strategy

Each image is tagged with:

- **Commit SHA (short)**: e.g., `abc123d` - 7-character short SHA
- **Commit SHA (full)**: e.g., `abc123def456...` - full 40-character SHA
- **`latest`**: Updated on every push to main (convenience only)

**For production deployments, always use the commit SHA tag** to ensure reproducibility.

## Server Requirements

### GHCR Authentication

Both servers need to authenticate with GHCR to pull private images:

- **VPS-01** (152.53.146.3): App server (Coolify)
- **VPS** (152.53.179.101): Worker server

1. Create a Personal Access Token (PAT) with `read:packages` scope at:
   https://github.com/settings/tokens

2. On each server, authenticate Docker:

   ```bash
   echo "$GHCR_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
   ```

3. Verify authentication:
   ```bash
   docker pull ghcr.io/wandeon/fiskai-app:latest
   ```

### Environment Variables

Workers require environment variables. These should be in `/home/admin/FiskAI/.env`:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public
REGULATORY_DATABASE_URL=postgresql://user:pass@host:5432/db?schema=regulatory

# Ollama endpoints
OLLAMA_ENDPOINT=...
OLLAMA_API_KEY=...
OLLAMA_MODEL=...
OLLAMA_EXTRACT_ENDPOINT=...
OLLAMA_EMBED_ENDPOINT=...
# ... etc
```

## Deployment Procedures

### App Deployment (Automatic)

The app is automatically deployed via Coolify when the workflow completes:

1. GitHub Actions builds `fiskai-app` image
2. Image is pushed to GHCR
3. Workflow triggers Coolify restart
4. Coolify pulls new image and restarts container

**Manual app deployment** (if needed):

```bash
# Via Coolify API
curl -X POST "http://152.53.146.3:8000/api/v1/applications/tgg4gkcco8k8s0wwg08cck40/restart" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"
```

### Worker Deployment (Manual)

Workers are deployed via docker compose on VPS (152.53.179.101):

```bash
# SSH to VPS (worker server)
ssh admin@152.53.179.101

# Navigate to project directory
cd /home/admin/FiskAI

# Deploy with specific commit SHA
IMAGE_TAG=abc123def ./scripts/deploy-workers.sh

# Or deploy latest
IMAGE_TAG=latest ./scripts/deploy-workers.sh
```

The deploy script will:

1. Verify GHCR authentication
2. Pull the specified image tag
3. Restart all worker containers

### Verifying Deployment

Check running containers and their images:

```bash
# View all worker containers
docker compose -f docker-compose.workers.yml ps

# Check which image version is running
docker compose -f docker-compose.workers.yml images

# View specific container details
docker inspect fiskai-worker-extractor | jq '.[0].Config.Image'
```

Check container logs:

```bash
# All workers
docker compose -f docker-compose.workers.yml logs -f

# Specific worker
docker compose -f docker-compose.workers.yml logs -f worker-extractor
```

## Rollback Procedure

To rollback to a previous version:

1. Find the previous commit SHA from GitHub or `git log`

2. Deploy workers with the old SHA:

   ```bash
   IMAGE_TAG=<previous-sha> ./scripts/deploy-workers.sh
   ```

3. For the app, trigger Coolify with the old image:
   ```bash
   # Update Coolify app config to use specific tag
   # Or manually pull and restart:
   docker pull ghcr.io/wandeon/fiskai-app:<previous-sha>
   # Then restart via Coolify dashboard
   ```

## Troubleshooting

### "unauthorized" when pulling images

GHCR authentication has expired or is missing:

```bash
# Re-authenticate
echo "$GHCR_TOKEN" | docker login ghcr.io -u USERNAME --password-stdin
```

### Image not found for tag

The workflow may have failed or the tag doesn't exist:

```bash
# List available tags
docker manifest inspect ghcr.io/wandeon/fiskai-worker:latest

# Check GitHub Actions for build status
# https://github.com/Wandeon/FiskAI/actions
```

### Workers not starting

Check logs for the specific worker:

```bash
docker compose -f docker-compose.workers.yml logs worker-<name>
```

Common issues:

- Missing environment variables in `.env`
- Database connection issues
- Redis not healthy

### Disk space issues

Old images can accumulate. Clean up:

```bash
# Remove unused images
docker image prune -a

# Remove specific old tags
docker rmi ghcr.io/wandeon/fiskai-worker:<old-tag>
```

## Local Development

For local development, use the dev override file to build locally:

```bash
docker compose -f docker-compose.workers.yml -f docker-compose.workers.dev.yml up -d --build
```

This builds images locally instead of pulling from GHCR.

## Workflow Inputs

The build workflow supports manual triggers with options:

- **force_no_cache**: Force rebuild without Docker layer cache
- **dry_run**: Build images but don't push to GHCR

Trigger via GitHub UI or CLI:

```bash
gh workflow run build-and-publish-images.yml \
  -f dry_run=true \
  -f force_no_cache=false
```
