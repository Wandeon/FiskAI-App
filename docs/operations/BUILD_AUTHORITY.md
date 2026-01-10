# Build Authority

> **Status**: Active
> **Last Updated**: 2026-01-10

## Overview

This document defines where and how Docker images are built for the FiskAI platform.

## Build Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GitHub Repository                           │
│                     (Wandeon/FiskAI on main)                        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   GitHub Actions Self-Hosted Runner                  │
│                        VPS (x86, 100.120.14.126)                    │
│                                                                      │
│   • Builds app image using docker buildx                            │
│   • Uses registry cache for layer reuse                             │
│   • Pushes to ghcr.io/wandeon/fiskai-app                           │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GitHub Container Registry (GHCR)                  │
│                                                                      │
│   • ghcr.io/wandeon/fiskai-app:latest                               │
│   • ghcr.io/wandeon/fiskai-app:<git-sha>                            │
│   • ghcr.io/wandeon/fiskai-app:buildcache (layer cache)             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           Coolify (VPS-01)                           │
│                                                                      │
│   • Pulls image from GHCR                                           │
│   • Does NOT build from source                                      │
│   • Manages container lifecycle                                     │
│   • Handles routing via Traefik                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Rules

### App Image (fiskai-app)

| Rule               | Details                             |
| ------------------ | ----------------------------------- |
| **Build Location** | VPS (x86) via GitHub Actions runner |
| **Build Trigger**  | Push to `main` branch               |
| **Image Registry** | ghcr.io/wandeon/fiskai-app          |
| **Deploy Method**  | Coolify pulls from GHCR             |
| **VPS-01 Builds**  | ❌ NEVER (too slow on ARM64)        |

### Why Not Build on VPS-01?

1. **ARM64 is slow for Node.js builds** - Next.js build takes 12+ minutes
2. **No persistent cache** - Coolify doesn't preserve buildx cache between deployments
3. **Shared resources** - Building competes with running app for CPU/RAM

### Why Build on VPS (x86)?

1. **Faster CPU** - AMD EPYC vs ARM64
2. **More RAM** - 24GB vs 16GB
3. **Persistent cache** - GitHub Actions uses registry cache
4. **Separation of concerns** - Build doesn't impact production

## Runner Configuration

**Runner Name**: `fiskai-vps-x86`
**Labels**: `self-hosted`, `linux`, `x64`, `fiskai-build`
**Location**: `/opt/github-runner/fiskai-app`
**Service**: `actions.runner.Wandeon-FiskAI.fiskai-vps-x86.service`

### Verify Runner Status

```bash
# Check runner service
sudo systemctl status actions.runner.Wandeon-FiskAI.fiskai-vps-x86.service

# Check runner in GitHub
gh api repos/Wandeon/FiskAI/actions/runners --jq '.runners[] | select(.name == "fiskai-vps-x86") | {status, labels: [.labels[].name]}'
```

## Coolify Configuration

Coolify should be configured to deploy from Docker image:

- **Source**: Docker Image
- **Image**: `ghcr.io/wandeon/fiskai-app:latest`
- **Registry**: GitHub Container Registry (public)
- **Build**: Disabled (no local builds)

### Manual Setup Required

The Coolify API doesn't support changing `build_pack` from "dockerfile" to "dockerimage".
This must be done **manually in the Coolify UI**:

1. Go to Coolify Dashboard → Applications → fiskai-app
2. Click "Settings" or "Configuration"
3. Change "Build Pack" from "Dockerfile" to "Docker Image"
4. Set "Docker Image" to `ghcr.io/wandeon/fiskai-app:latest`
5. Save and trigger a deployment

**Current Status (2026-01-10):**

- GitHub Actions builds and pushes to GHCR ✅
- GHCR has `latest` tag ready ✅
- Coolify still configured to build from source ⚠️ (needs UI change)

## Fallback / Rollback

If the GitHub Actions build pipeline fails:

1. **Temporary**: Re-enable Coolify "build from repo" mode
2. **Fix**: Debug and fix the workflow
3. **Restore**: Switch back to image pull mode

This is NOT preferred as VPS-01 builds take 16+ minutes.

## Related Documents

- [RESTORE_COOLIFY_AUTHORITY.md](./RESTORE_COOLIFY_AUTHORITY.md) - Coolify deployment runbook
- [WORKER_BUILD_AUTHORITY.md](./WORKER_BUILD_AUTHORITY.md) - Worker image build process
