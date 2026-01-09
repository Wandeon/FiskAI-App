# VPS-01 Full Inspection Report

> **Date:** 2026-01-09
> **Inspector:** Claude Code (read-only)
> **Purpose:** Discovery inventory for app-only migration planning

---

## 1. Executive Summary (Facts Only)

VPS-01 is a Hetzner ARM64 server (10 cores, 16GB RAM, 512GB disk) running:

- **Coolify** (PaaS platform) managing deployments
- **FiskAI Application** (Next.js) serving 4 domains via Traefik
- **14 RTL Workers** processing regulatory content via BullMQ queues
- **PostgreSQL 16** database (1.1GB data)
- **Redis 7** queue broker (2GB, at maxmemory limit, 3M keys)

**Key Observations:**

- Swap heavily used (6.4GB of 8GB) - memory pressure
- Redis at maxmemory (2GB), using allkeys-lru eviction
- Large queue backlog: 10.3M jobs pending (review: 9.1M, arbiter: 905K, compose: 266K, release: 27K)
- Legacy subdomain routes (staff.fiskai.hr, admin.fiskai.hr) still configured in Traefik despite DNS deletion
- Workers built on VPS-01 (no CI runner present)

---

## 2. System Overview

| Property     | Value                                       |
| ------------ | ------------------------------------------- |
| Hostname     | v2202508269591373147                        |
| OS           | Debian GNU/Linux 12 (bookworm)              |
| Kernel       | 6.1.0-41-arm64                              |
| Architecture | aarch64 (ARM64)                             |
| CPU          | Neoverse-N1, 10 cores                       |
| RAM          | 16GB total, 6.8GB used, 8.8GB available     |
| Swap         | 8GB file, 6.4GB used                        |
| Disk         | 512GB vda, 95GB used (20%), 388GB available |
| Uptime       | 11 days, load avg 3.23/2.37/2.04            |

---

## 3. Network & Access

### Public IPs

| Interface  | IP            | Purpose                      |
| ---------- | ------------- | ---------------------------- |
| eth0       | 152.53.146.3  | Primary public IP            |
| tailscale0 | 100.64.123.81 | Tailscale VPN (node: vps-01) |

### Listening Ports

| Port      | Service                | Binding |
| --------- | ---------------------- | ------- |
| 22        | SSH                    | 0.0.0.0 |
| 80        | Traefik HTTP           | 0.0.0.0 |
| 443       | Traefik HTTPS          | 0.0.0.0 |
| 3001      | Python3 (glances)      | 0.0.0.0 |
| 5434      | PostgreSQL (fiskai-db) | 0.0.0.0 |
| 6001-6002 | Coolify Realtime       | 0.0.0.0 |
| 8000      | Coolify Dashboard      | 0.0.0.0 |
| 8080      | Traefik Dashboard      | 0.0.0.0 |

### Tailscale Peers (Active)

- gpu-01 (100.100.47.43) - Windows
- iphone-14-pro (100.121.238.125) - iOS
- mastercam (100.70.96.49) - Linux
- pi-audio-02 (100.122.210.53) - Linux
- pi-video-01 (100.123.206.6) - Linux
- vps (100.120.14.126) - Linux (VPS-02 reference)

### Firewall

- iptables active with Tailscale and Docker rules
- fail2ban blocking SSH brute force (f2b-sshd chain)
- UFW inactive

---

## 4. Runtime Inventory

### Running Containers (24 total)

#### Coolify Platform (6 containers)

| Container        | Image                                      | Status | Purpose          |
| ---------------- | ------------------------------------------ | ------ | ---------------- |
| coolify          | ghcr.io/coollabsio/coolify:4.0.0-beta.459  | Up 10d | PaaS dashboard   |
| coolify-proxy    | traefik:v3.6                               | Up 10d | Reverse proxy    |
| coolify-db       | postgres:15-alpine                         | Up 10d | Coolify database |
| coolify-redis    | redis:7-alpine                             | Up 10d | Coolify queue    |
| coolify-realtime | ghcr.io/coollabsio/coolify-realtime:1.0.10 | Up 10d | WebSocket        |
| coolify-sentinel | ghcr.io/coollabsio/sentinel:0.0.18         | Up 17h | Health monitor   |

#### FiskAI Application (1 container)

| Container                             | Image                                | Status | Memory    | Purpose     |
| ------------------------------------- | ------------------------------------ | ------ | --------- | ----------- |
| bsswgo8ggwgkw8c88wo8wcw8-142422522557 | bsswgo8ggwgkw8c88wo8wcw8:379fea03... | Up 26h | 317MB/8GB | Next.js app |

#### FiskAI Data (2 containers)

| Container    | Image              | Status | Memory | Purpose              |
| ------------ | ------------------ | ------ | ------ | -------------------- |
| fiskai-db    | postgres:16-alpine | Up 11d | 51MB   | Application database |
| fiskai-redis | redis:7-alpine     | Up 18h | 2.1GB  | Queue broker         |

#### FiskAI Workers (14 containers)

| Container                        | Status | Memory      | CPU%  |
| -------------------------------- | ------ | ----------- | ----- |
| fiskai-worker-extractor          | Up 31h | 94MB/1GB    | 7.67% |
| fiskai-worker-continuous-drainer | Up 31h | 123MB/256MB | 4.60% |
| fiskai-worker-evidence-embedding | Up 32h | 42MB/512MB  | 0.23% |
| fiskai-worker-ocr                | Up 47h | 39MB        | 0.21% |
| fiskai-worker-content-sync       | Up 3d  | 50MB/512MB  | 0.26% |
| fiskai-worker-arbiter            | Up 2d  | 47MB        | 0.06% |
| fiskai-worker-scheduler          | Up 3d  | 25MB        | 0.32% |
| fiskai-worker-reviewer           | Up 2d  | 53MB        | 0.15% |
| fiskai-worker-sentinel           | Up 3d  | 44MB        | 0.33% |
| fiskai-worker-embedding          | Up 3d  | 33MB/512MB  | 0.40% |
| fiskai-worker-releaser           | Up 2d  | 58MB        | 0.20% |
| fiskai-worker-article            | Up 3d  | 36MB/1GB    | 0.20% |
| fiskai-worker-composer           | Up 2d  | 52MB        | 0.13% |
| fiskai-worker-orchestrator       | Up 3d  | 38MB        | 0.35% |

#### Stopped Containers (legacy, 4+ months)

- core-postgres-1, core-redis-1, core-minio-1
- automations-n8n-1
- core-nominatim-1, core-tileserver-1, core-uptime-kuma-1

### Non-Docker Services

| Service          | Description                   |
| ---------------- | ----------------------------- |
| tailscaled       | Tailscale VPN agent           |
| glances          | System monitoring (port 3001) |
| cron             | Scheduled tasks               |
| ssh              | OpenSSH server                |
| qemu-guest-agent | VM guest agent                |

---

## 5. Workers & Queues

### Queue Status (BullMQ via Redis)

| Queue              | Waiting Jobs |
| ------------------ | ------------ |
| review             | 9,117,456    |
| arbiter            | 905,105      |
| compose            | 265,652      |
| release            | 27,215       |
| ocr                | 0            |
| extract            | 0            |
| sentinel           | 0            |
| scheduler          | 0            |
| content-sync       | 0            |
| orchestrator       | 0            |
| article            | 0            |
| embedding          | 0            |
| evidence-embedding | 0            |
| continuous-drainer | 0            |

**Total: ~10.3 million pending jobs**

### Redis Status

- Keys: 3,071,415
- Memory: 2.00GB / 2.00GB max (at limit)
- Eviction policy: allkeys-lru
- Expires: 16 keys with TTL

### Cron Jobs (User crontab)

| Time        | Endpoint                      | Purpose             |
| ----------- | ----------------------------- | ------------------- |
| 23:00 daily | /api/cron/news/fetch-classify | News pipeline fetch |
| 23:30 daily | /api/cron/news/review         | News review         |
| 00:00 daily | /api/cron/news/publish        | News publish        |
| 05:00 daily | /api/cron/bank-sync           | Bank sync           |
| 05:00 daily | /api/cron/email-sync          | Email sync          |

All cron jobs call localhost:3002 with CRON_SECRET header.

---

## 6. Data & State

### PostgreSQL (fiskai-db)

- Database: fiskai
- Size: 1,089 MB
- Schemas: public, regulatory
- Tables: 100+ (partial list in output)
- Exposed: 0.0.0.0:5434

### Redis (fiskai-redis)

- Volume: fiskai_fiskai_redis_data
- Data: Queue jobs, BullMQ metadata
- Memory: 2GB (at maxmemory)

### Docker Volumes

| Volume                                 | Purpose                  |
| -------------------------------------- | ------------------------ |
| fiskai_fiskai_postgres_data            | PostgreSQL data          |
| fiskai_fiskai_redis_data               | Redis persistence        |
| coolify-db                             | Coolify PostgreSQL       |
| operation-shatter_fiskai_postgres_data | UNKNOWN - possibly stale |

### Persistent Bind Mounts

| Container                  | Host Path                  | Container Path |
| -------------------------- | -------------------------- | -------------- |
| fiskai-worker-extractor    | /home/admin/FiskAI/src     | /app/src       |
| fiskai-worker-content-sync | /home/admin/FiskAI/content | /app/content   |
| coolify                    | /data/coolify/\*           | Various        |
| coolify-sentinel           | /data/coolify/sentinel     | /app/db        |

---

## 7. Build & CI Activity

### Build Location

- **All builds happen on VPS-01** (no GitHub Actions runner)
- Worker images built locally via docker-compose
- App images built by Coolify on deployment

### Recent Image Builds

| Image                            | Built            | Age     |
| -------------------------------- | ---------------- | ------- |
| bsswgo8ggwgkw8c88wo8wcw8 (app)   | 2026-01-09 17:08 | 1 hour  |
| fiskai-worker-ocr                | 2026-01-07 19:16 | 2 days  |
| fiskai-worker-extractor          | 2026-01-07 18:57 | 2 days  |
| fiskai-worker-evidence-embedding | 2026-01-06 14:58 | 3 days  |
| fiskai-worker-content-sync       | 2025-12-29 19:08 | 11 days |
| Other workers                    | 2025-12-24       | 16 days |

### Build Artifacts

- No persistent /artifacts directory found
- Coolify stores compose files temporarily during deploy

---

## 8. Secrets & Config Surface

### Secret Storage Locations

| Location                           | Contents                                    |
| ---------------------------------- | ------------------------------------------- |
| Coolify Dashboard                  | App env vars (DATABASE_URL, API keys, etc.) |
| /home/admin/FiskAI/.env            | Local development env                       |
| /home/admin/FiskAI/.env.local      | Local overrides                             |
| /home/admin/FiskAI/.env.production | Production overrides                        |
| docker-compose.workers.yml         | Worker env vars (references .env)           |

### Env Vars by Service

**App Container (43 vars):**

- DATABASE_URL, REGULATORY_DATABASE_URL
- REDIS_URL
- NEXTAUTH_SECRET, NEXTAUTH_URL
- CRON_SECRET
- RESEND_API_KEY
- OLLAMA\_\* (API keys, endpoints)
- EPOSLOVANJE\_\* (e-invoice API)
- FISCAL_CERT_KEY, EINVOICE_KEY_SECRET

**Workers (13 vars each):**

- DATABASE_URL, REGULATORY_DATABASE_URL
- REDIS_URL
- OLLAMA*EXTRACT*\* (extractor only)
- OLLAMA*VISION*\* (OCR only)

**Local .env (36 vars):**

- All above plus COOLIFY_API_TOKEN
- DEEPSEEK_API_KEY
- SLACK_WEBHOOK_URL
- CLOUDFLARE_DNS_API_TOKEN

### Shared Secrets (App + Workers)

- DATABASE_URL, REGULATORY_DATABASE_URL
- REDIS_URL

---

## 9. Failure Impact Table

| Component                            | If Stopped                    | Affects                            | Criticality |
| ------------------------------------ | ----------------------------- | ---------------------------------- | ----------- |
| **coolify-proxy (Traefik)**          | All HTTP/HTTPS traffic fails  | App, Admin, Staff, CI dashboard    | CRITICAL    |
| **bsswgo8ggwgkw8c88wo8wcw8 (App)**   | fiskai.hr, app.fiskai.hr down | All user functionality             | CRITICAL    |
| **fiskai-db**                        | App crashes, workers fail     | Everything                         | CRITICAL    |
| **fiskai-redis**                     | Queues fail, workers stall    | Background processing, queue state | CRITICAL    |
| **coolify**                          | No deploys, no dashboard      | CI/CD, infrastructure management   | IMPORTANT   |
| **coolify-db**                       | Coolify fails                 | CI/CD                              | IMPORTANT   |
| **fiskai-worker-extractor**          | Extraction stalls             | RTL pipeline                       | IMPORTANT   |
| **fiskai-worker-continuous-drainer** | Queue draining stops          | RTL pipeline                       | IMPORTANT   |
| **fiskai-worker-reviewer**           | Review backlog grows          | RTL pipeline                       | IMPORTANT   |
| **fiskai-worker-arbiter**            | Conflict resolution stops     | RTL pipeline                       | IMPORTANT   |
| **fiskai-worker-composer**           | Rule composition stops        | RTL pipeline                       | IMPORTANT   |
| **fiskai-worker-releaser**           | Publishing stops              | RTL pipeline                       | IMPORTANT   |
| **fiskai-worker-sentinel**           | Discovery stops               | RTL pipeline (new content)         | IMPORTANT   |
| **fiskai-worker-ocr**                | PDF OCR stops                 | RTL pipeline (scanned PDFs)        | MODERATE    |
| **Other workers**                    | Specific functions stop       | RTL pipeline                       | MODERATE    |
| **Cron jobs**                        | News/sync stops               | Automated syncs                    | MODERATE    |
| **glances**                          | No monitoring                 | Visibility only                    | OPTIONAL    |
| **Stopped containers**               | No impact                     | None (already stopped)             | N/A         |

---

## 10. Unknowns & Open Questions

### Could Not Inspect

1. **Coolify dashboard env vars** - Would require Coolify API call or UI access
2. **/data/coolify/** - Permission denied, contains Coolify state
3. **Exact queue job contents** - Would need to inspect Redis job data
4. **Network traffic patterns** - Would need tcpdump or similar

### Surprises Found

1. **Legacy subdomain routes still in Traefik** - Labels show routes for staff.fiskai.hr and admin.fiskai.hr despite DNS being deleted (per MARKETING_SEPARATION.md)
2. **Redis at maxmemory** - 2GB limit, evicting keys with allkeys-lru
3. **10.3M pending queue jobs** - Large backlog in review/arbiter/compose/release queues
4. **Swap pressure** - 6.4GB of 8GB swap used despite 8GB+ available RAM
5. **Scheduler Redis connection error** - Logs show ECONNREFUSED to old Redis IP (10.0.1.3)
6. **operation-shatter_fiskai_postgres_data volume** - Stale volume from unknown operation
7. **Zombie process** - One defunct node process (PID 738658)

### Observations (Not Advice)

1. **OBSERVATION:** App and workers share same PostgreSQL and Redis instances - coupled at data layer
2. **OBSERVATION:** Workers bind-mount /home/admin/FiskAI/src - code changes require worker restart
3. **OBSERVATION:** All builds happen on VPS-01 - no external CI runner
4. **OBSERVATION:** fiskai-db exposed on 0.0.0.0:5434 - accessible from public internet
5. **OBSERVATION:** Coolify manages only the app container, workers managed via docker-compose.workers.yml
6. **OBSERVATION:** Cron jobs calling localhost:3002 ARE working (via Docker networking) - returns JSON responses
7. **OBSERVATION:** News classification failing consistently - "Ollama API error: 404 Not Found" - model may be missing on gpu-01

---

## End of Report

**Report generated:** 2026-01-09 18:30 UTC
**Data collection method:** Read-only shell commands
**No mutations performed**
