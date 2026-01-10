# Build Authority

> **Status**: Active
> **Last Updated**: 2026-01-11

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
│   • Orchestrates build via docker buildx                            │
│   • Uses REMOTE BuildKit on VPS-01 for native ARM64 builds          │
│   • Uses registry cache for layer reuse                             │
│   • Pushes to ghcr.io/wandeon/fiskai-app                           │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ TCP over Tailscale
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BuildKit (VPS-01, ARM64)                         │
│                     100.64.123.81:1234                              │
│                                                                      │
│   • Native ARM64 builds (no QEMU emulation!)                        │
│   • Bound to Tailscale IP only (not public)                        │
│   • Container: moby/buildkit:latest                                 │
│   • Firewall: iptables allows only Tailscale network               │
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

| Rule               | Details                                |
| ------------------ | -------------------------------------- |
| **Build Location** | VPS-01 (ARM64) via remote BuildKit     |
| **Orchestration**  | VPS (x86) via GitHub Actions runner    |
| **Build Trigger**  | Push to `main` branch                  |
| **Image Registry** | ghcr.io/wandeon/fiskai-app             |
| **Deploy Method**  | Coolify pulls from GHCR                |
| **QEMU Usage**     | ❌ NEVER (too slow, 4+ hours)          |

### Why Remote BuildKit?

1. **Native ARM64 builds** - No QEMU emulation overhead
2. **Fast builds** - ~15-25 minutes vs 4-8 hours with QEMU
3. **Network isolation** - BuildKit bound to Tailscale IP only
4. **Separation of concerns** - Build orchestration on VPS, compilation on VPS-01

### Previous Approaches (DO NOT USE)

| Approach | Problem |
| -------- | ------- |
| **QEMU on VPS** | 4-8 hours build time (emulation overhead) |
| **Direct builds on VPS-01** | 16+ minutes, no persistent cache, impacts production |

## Infrastructure

### Self-Hosted Runner (VPS)

**Runner Name**: `fiskai-vps-x86`
**Labels**: `self-hosted`, `linux`, `x64`, `fiskai-build`
**Location**: `/opt/github-runner/fiskai-app`
**Service**: `actions.runner.Wandeon-FiskAI.fiskai-vps-x86.service`

```bash
# Check runner service
sudo systemctl status actions.runner.Wandeon-FiskAI.fiskai-vps-x86.service

# Check runner in GitHub
gh api repos/Wandeon/FiskAI/actions/runners --jq '.runners[] | select(.name == "fiskai-vps-x86") | {status, labels: [.labels[].name]}'
```

### BuildKit (VPS-01)

**Container**: `buildkitd`
**Image**: `moby/buildkit:latest`
**Endpoint**: `tcp://100.64.123.81:1234`
**Binding**: Tailscale IP only (not public interface)

```bash
# Check BuildKit status
ssh admin@100.64.123.81 "docker ps --filter name=buildkitd --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

# Check port binding (should show 100.64.123.81:1234 only)
ssh admin@100.64.123.81 "ss -tlnp | grep 1234"

# Restart BuildKit if needed
ssh admin@100.64.123.81 "docker restart buildkitd"
```

### Firewall Rules (VPS-01)

BuildKit is protected by:
1. **Tailscale network isolation** - Only accessible from Tailscale network
2. **IP binding** - Bound to 100.64.123.81 (Tailscale IP), not 0.0.0.0
3. **iptables rules** - Additional protection for port 1234

```bash
# View iptables rules
ssh admin@100.64.123.81 "sudo iptables -L INPUT -n | grep 1234"
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

## Environment Variable Management

Use the `coolify-copy-envs.sh` script to copy env vars between Coolify apps:

```bash
# Requires COOLIFY_API_TOKEN
export COOLIFY_API_TOKEN='your-token'

# Copy from source to target app
./scripts/coolify-copy-envs.sh <source_app_uuid> <target_app_uuid>
```

The script:
- Validates token exists (fails fast if missing)
- Verifies both apps exist
- Copies all env vars preserving build-time/preview flags
- Reports success/failure for each variable

## Fallback / Rollback

If the GitHub Actions build pipeline fails:

1. **Temporary**: Re-enable Coolify "build from repo" mode
2. **Fix**: Debug and fix the workflow
3. **Restore**: Switch back to image pull mode

If BuildKit on VPS-01 is down:

```bash
# Restart BuildKit
ssh admin@100.64.123.81 "docker restart buildkitd"

# If container is missing, recreate it
ssh admin@100.64.123.81 << 'EOF'
docker rm -f buildkitd 2>/dev/null || true
docker run -d \
  --name buildkitd \
  --restart unless-stopped \
  --privileged \
  -p 100.64.123.81:1234:1234 \
  moby/buildkit:latest \
  --addr tcp://0.0.0.0:1234
EOF
```

## Related Documents

- [RESTORE_COOLIFY_AUTHORITY.md](./RESTORE_COOLIFY_AUTHORITY.md) - Coolify deployment runbook
- [WORKER_BUILD_AUTHORITY.md](./WORKER_BUILD_AUTHORITY.md) - Worker image build process
