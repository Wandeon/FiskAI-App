# Clean Production Topology Design

> **For Claude:** Reference document for infrastructure decisions. Not an executable plan.

**Goal:** Define a hardened, zero-trust production topology for FiskAI after VPS-02 compromise.

**Design Principles:**

1. Assume breach - minimize blast radius
2. No public exposure except explicit entrypoints
3. All internal traffic over Tailscale
4. No privileged containers
5. Secrets never on disk unencrypted
6. Audit everything

---

## Network Topology

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
    │ VPS-01  │                  │ VPS-02  │                  │ GPU-01  │
    │(Primary)│                  │(Workers)│                  │ (LLM)   │
    └────┬────┘                  └────┬────┘                  └────┬────┘
         │                             │                             │
    ┌────┴────┐                  ┌────┴────┐                  ┌────┴────┐
    │fiskai-db│◄─────────────────│Workers  │─────────────────►│ Ollama  │
    │Postgres │   DATABASE_URL   │(14x)    │   OLLAMA_API     │ :11434  │
    │:5432    │                  │         │                  │         │
    └─────────┘                  │Redis    │                  └─────────┘
                                 │:6379    │
                                 └─────────┘
```

---

## VPS Inventory

### VPS-01: Primary Application Server

**IP:** 152.53.146.3 (Public) / 100.64.123.81 (Tailscale)
**Role:** Application hosting, database, Coolify

| Service     | Port    | Binding      | Access                  |
| ----------- | ------- | ------------ | ----------------------- |
| Caddy       | 80, 443 | 0.0.0.0      | Public (via Cloudflare) |
| Coolify     | 8000    | 0.0.0.0      | Public (via Cloudflare) |
| FiskAI App  | 3000    | 127.0.0.1    | Caddy reverse proxy     |
| PostgreSQL  | 5432    | Tailscale IP | VPS-02 workers only     |
| Redis (app) | 6379    | 127.0.0.1    | Local app only          |

**Containers:**

- fiskai-app (Next.js application)
- fiskai-db (PostgreSQL 16)
- fiskai-redis (application cache)
- coolify (deployment platform)
- traefik (Coolify's proxy)

### VPS-02: Worker Server (REBUILT)

**IP:** 152.53.179.101 (Public) / NEW_TAILSCALE_IP (Tailscale)
**Role:** Background job processing, CI/CD runner

| Service         | Port    | Binding      | Access                    |
| --------------- | ------- | ------------ | ------------------------- |
| SSH             | 22      | 0.0.0.0      | Public (key-only)         |
| Caddy           | 80, 443 | 0.0.0.0      | Public (placeholder only) |
| Redis (workers) | 6379    | Tailscale IP | Workers only              |
| Netdata         | 19999   | Tailscale IP | Internal monitoring       |

**Containers:**

- fiskai-worker-\* (14 BullMQ workers)
- fiskai-worker-ocr (OCR with Tesseract)
- fiskai-redis (job queue)

**NO PRIVILEGED CONTAINERS ALLOWED**

### GPU-01: LLM Inference

**IP:** 100.100.47.43 (Tailscale only)
**Role:** Ollama model hosting

| Service | Port  | Binding      | Access              |
| ------- | ----- | ------------ | ------------------- |
| Ollama  | 11434 | Tailscale IP | VPS-01, VPS-02 only |

---

## Security Boundaries

### Tier 1: Public Internet

**Allowed inbound:**

- TCP 443 (HTTPS) → Cloudflare → Caddy
- TCP 80 (HTTP) → Redirect to HTTPS
- TCP 22 (SSH) → Key authentication only

**Blocked:**

- All other ports
- Direct IP access (Cloudflare proxy mode)

### Tier 2: Tailscale Mesh

**Services exposed on Tailscale:**

- PostgreSQL (VPS-01:5432)
- Redis worker queue (VPS-02:6379)
- Ollama API (GPU-01:11434)
- Netdata (VPS-01:19999, VPS-02:19999)

**Authentication:**

- Tailscale ACLs restrict access
- Service-level passwords required

### Tier 3: Container Networks

**Isolation:**

- Each stack has its own Docker network
- No `--network=host` allowed
- No `--privileged` allowed
- No Docker socket mounts

---

## Secret Management

### Secret Storage

```
┌─────────────────────────────────────────────────┐
│                PASSWORD MANAGER                 │
│  (1Password/Bitwarden - source of truth)        │
└─────────────────────────┬───────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
    ┌─────────┐      ┌─────────┐      ┌─────────┐
    │ Coolify │      │ .env    │      │ GitHub  │
    │ Env Vars│      │ (VPS-02)│      │ Secrets │
    │         │      │         │      │         │
    └─────────┘      └─────────┘      └─────────┘
         │                │                │
         ▼                ▼                ▼
    ┌─────────┐      ┌─────────┐      ┌─────────┐
    │FiskAI   │      │Workers  │      │GitHub   │
    │App      │      │         │      │Actions  │
    └─────────┘      └─────────┘      └─────────┘
```

### Secret Categories

| Category            | Storage        | Rotation Frequency |
| ------------------- | -------------- | ------------------ |
| Database passwords  | Coolify + .env | 90 days            |
| API keys (external) | Coolify + .env | On compromise      |
| JWT secrets         | Coolify        | 90 days            |
| SSH keys            | ~/.ssh         | On compromise      |
| GHCR tokens         | GitHub PAT     | 90 days            |
| Encryption keys     | Coolify        | Never (versioned)  |

### Never Allowed

- Secrets in git repositories
- Secrets in Docker images
- Secrets in build logs
- Secrets in error messages
- Plaintext secrets in backups

---

## Container Security Policy

### Allowed

```yaml
services:
  example:
    image: trusted-registry/image:pinned-tag
    user: "1000:1000" # Non-root
    read_only: true # Read-only root filesystem
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE # Only if needed
    tmpfs:
      - /tmp:size=100M,mode=1777
```

### Forbidden

```yaml
# NEVER USE THESE:
services:
  bad_example:
    privileged: true # FORBIDDEN
    network_mode: host # FORBIDDEN
    pid: host # FORBIDDEN
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock # FORBIDDEN
      - /:/host # FORBIDDEN
    cap_add:
      - SYS_ADMIN # FORBIDDEN
```

### BuildKit Policy

**Old (vulnerable):**

```yaml
# This was the attack vector
buildx_buildkit_amd64-builder0:
  privileged: true # Container escape possible
```

**New (hardened):**

```bash
# Use remote BuildKit over Tailscale instead
docker buildx create --name remote-builder \
  --driver remote \
  --driver-opt endpoint=tcp://100.64.123.81:1234
```

---

## Monitoring Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    GRAFANA CLOUD                        │
│            (or self-hosted on Tailscale)                │
└─────────────────────────┬───────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
    ┌─────────┐      ┌─────────┐      ┌─────────┐
    │ VPS-01  │      │ VPS-02  │      │ GPU-01  │
    │ Netdata │      │ Netdata │      │ Netdata │
    │ :19999  │      │ :19999  │      │ :19999  │
    │(TS only)│      │(TS only)│      │(TS only)│
    └─────────┘      └─────────┘      └─────────┘
```

### Alerting Rules

1. **Process in /tmp** → CRITICAL (potential malware)
2. **CPU > 90% sustained** → WARNING
3. **Disk > 80%** → WARNING
4. **Container restart loop** → CRITICAL
5. **Failed SSH attempts > 10/min** → WARNING
6. **New listening port** → CRITICAL

---

## Backup Strategy

### Daily Backups

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  VPS-01     │     │   S3/R2     │     │  Offsite    │
│  fiskai-db  │────►│  Encrypted  │────►│  Cold       │
│  pg_dump    │     │  Bucket     │     │  Storage    │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Backup Contents

- PostgreSQL logical dumps (daily)
- Redis RDB snapshots (hourly)
- Configuration files (on change)
- Caddy certificates (on renewal)

### NOT Backed Up

- Docker images (rebuild from registry)
- node_modules (rebuild from package.json)
- Build caches (ephemeral)
- Logs older than 7 days

---

## Incident Response Checklist

### On Suspected Compromise

1. **Isolate** - Remove from Tailscale, block at firewall
2. **Preserve** - Snapshot disk for forensics
3. **Investigate** - Use forensic inventory template
4. **Rotate** - All secrets that touched the system
5. **Rebuild** - From clean OS image
6. **Verify** - External security scan
7. **Document** - ADR for lessons learned

### Never Do

- "Clean" a compromised system in place
- Restore from backups without scanning
- Reuse secrets from compromised system
- Skip forensic investigation
- Assume single-point compromise

---

## Compliance Notes

### For Fintech Operations

- All data encrypted at rest (PostgreSQL, Redis)
- All data encrypted in transit (TLS 1.3)
- Audit logs retained 90 days minimum
- Access logs retained 1 year
- No PII in logs
- GDPR data residency (EU servers)

### Certifications Path

- SOC 2 Type II (future)
- ISO 27001 (future)
- PCI DSS (if card processing)

---

## Implementation Priority

### P0: Security Critical (Week 1)

1. Rebuild VPS-02 from clean image
2. Rotate all secrets
3. Bind monitoring to Tailscale
4. Enable audit logging
5. Remove privileged containers

### P1: Operational (Week 2)

1. Restore worker functionality
2. Verify CI/CD pipeline
3. Test backup/restore procedures
4. Document runbooks

### P2: Hardening (Week 3-4)

1. Implement alerting rules
2. External penetration test
3. Security ADR approval
4. Team security training
