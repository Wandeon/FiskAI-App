# VPS Forensic Recovery Inventory

**Generated:** 2026-01-13 22:10 UTC
**Host:** v2202510269591389839 (152.53.179.101)
**Status:** COMPROMISED - Cryptominer detected and killed

---

## 1. Host Identity & Baseline

| Property     | Value                          |
| ------------ | ------------------------------ |
| OS           | Debian GNU/Linux 12 (bookworm) |
| Kernel       | 6.1.0-40-amd64                 |
| Hostname     | v2202510269591389839           |
| Uptime       | 34 days                        |
| Architecture | x86_64                         |
| Disk         | 1TB vda, 297GB used (31%)      |

**Disk Layout:**

- `/dev/vda4` (1007GB) - Root filesystem (ext4)
- `/dev/vda3` (944MB) - /boot (ext4)
- `/dev/vda2` (241MB) - /boot/efi (vfat)

**Recovery Implication:** Standard Debian 12 server. No custom partitioning. Root filesystem can be reimaged entirely.

---

## 2. Running Processes & Execution Surfaces

### Malicious Process (KILLED)

| PID     | User           | Command                                          | Status     |
| ------- | -------------- | ------------------------------------------------ | ---------- |
| 1278657 | UID 101 (sshd) | `/tmp/xmrig-x86_64-static -o 155.133.23.62:5556` | **KILLED** |

**Mining details:**

- First seen: 2026-01-11 23:26 UTC
- CPU time consumed: 37,578 minutes
- Wallet: `46coPowBordCDhh6BD7LbvCm2PcM3Pd9vEYBmCDRdkNvdE6VeUmZb76Yt9W538GxkSaoYGkeQGeuVHJH19awowc3CavE1kL`

### Process Classification

| Process       | User    | Classification | Notes                                          |
| ------------- | ------- | -------------- | ---------------------------------------------- |
| dockerd       | root    | LEGIT          | Docker daemon                                  |
| containerd    | root    | LEGIT          | Container runtime                              |
| tailscaled    | root    | LEGIT          | VPN                                            |
| netdata       | netdata | LEGIT          | Monitoring (EXPOSED PUBLICLY)                  |
| glances       | root    | LEGIT          | Monitoring (EXPOSED PUBLICLY)                  |
| caddy         | caddy   | LEGIT          | Reverse proxy                                  |
| redis-server  | caddy   | LEGIT          | Cache                                          |
| buildkitd     | root    | UNKNOWN        | Privileged build container                     |
| claude        | admin   | LEGIT          | AI agent sessions                              |
| nginx workers | UID 101 | LEGIT          | Dashboard container (UID maps to sshd on host) |
| postgres      | UID 101 | LEGIT          | Supabase container                             |

### Processes from /tmp

None currently detected after miner removal.

---

## 3. Installed Services & Daemons

### Enabled systemd Services

| Service               | Purpose           | Restore Action             |
| --------------------- | ----------------- | -------------------------- |
| docker.service        | Container runtime | REBUILD                    |
| containerd.service    | Container runtime | REBUILD                    |
| tailscaled.service    | VPN access        | REBUILD                    |
| ssh.service           | Remote access     | REBUILD                    |
| caddy.service         | Reverse proxy     | REBUILD                    |
| netdata.service       | Monitoring        | REBUILD (restrict binding) |
| glances.service       | Monitoring        | REBUILD (restrict binding) |
| fail2ban.service      | Security          | REBUILD                    |
| ufw.service           | Firewall          | REBUILD                    |
| actions.runner.\*     | GitHub Actions    | REBUILD                    |
| metrica.service       | Custom service    | INVESTIGATE                |
| chrome-watchdog.timer | Browser watchdog  | INVESTIGATE                |
| fleet-db-backup.timer | Database backup   | REBUILD                    |

### Cron Jobs

- No user crontabs found
- System crons: e2scrub_all, kernel fstrim only (LEGIT)

---

## 4. Docker Inventory

### Container Status

| Container                          | Purpose            | Data Inside? | Privileged? | Restore Action |
| ---------------------------------- | ------------------ | ------------ | ----------- | -------------- |
| fiskai-worker-\* (14x)             | FiskAI workers     | No           | No          | REBUILD        |
| fiskai-redis                       | Worker queue       | Ephemeral    | No          | REBUILD        |
| fiskai-redis-vps                   | App Redis          | Session data | No          | REBUILD        |
| postgres-supabase                  | Supabase DB        | YES (59MB)   | No          | DATA ONLY      |
| postgres-n8n                       | n8n workflows      | YES (64MB)   | No          | DATA ONLY      |
| postgres-nextcloud                 | Nextcloud          | YES (76MB)   | No          | DATA ONLY      |
| supabase-\* (9x)                   | Supabase stack     | Varies       | No          | REBUILD        |
| monitoring-\* (5x)                 | Grafana/Prometheus | Config only  | No          | REBUILD        |
| n8n                                | Automation         | Workflows    | No          | DATA ONLY      |
| nextcloud                          | File storage       | Files        | No          | DATA ONLY      |
| dashboard                          | nginx static       | No           | No          | DESTROY        |
| **buildx_buildkit_amd64-builder0** | Docker builds      | Cache        | **YES**     | **DESTROY**    |
| **buildx_buildkit_multiarch0**     | Docker builds      | Cache        | **YES**     | **DESTROY**    |

### CRITICAL: Privileged Containers

```
/buildx_buildkit_amd64-builder0 Privileged=true
/buildx_buildkit_multiarch0 Privileged=true
```

**These are potential intrusion vectors. DESTROY and rebuild without privileged mode.**

### Docker Networks

- coolify, fiskai_default, automation-stack_automation-net: REBUILD
- monitoring_default, redis_default: REBUILD

### Docker Volumes

| Volume                                   | Purpose         | Restore Action        |
| ---------------------------------------- | --------------- | --------------------- |
| automation-stack_supabase_db_data        | Supabase DB     | EXPORT, SCAN, RESTORE |
| automation-stack_postgres_n8n_data       | n8n DB          | EXPORT, SCAN, RESTORE |
| automation-stack_postgres_nextcloud_data | Nextcloud DB    | EXPORT, SCAN, RESTORE |
| automation-stack_n8n_data                | n8n files       | NEEDS SCAN            |
| automation-stack*nextcloud*\*            | Nextcloud files | NEEDS SCAN            |
| monitoring\_\*                           | Metrics/logs    | DESTROY               |
| buildx*buildkit*\*\_state                | Build cache     | **DESTROY**           |
| fiskai\_\*\_redis_data                   | Redis data      | DESTROY               |

---

## 5. Persistent Data (Databases & Volumes)

### Databases

| Database           | Container          | Size | Export Method | Restore Safety |
| ------------------ | ------------------ | ---- | ------------- | -------------- |
| Supabase Postgres  | postgres-supabase  | 59MB | pg_dump       | NEEDS SCAN     |
| n8n Postgres       | postgres-n8n       | 64MB | pg_dump       | NEEDS SCAN     |
| Nextcloud Postgres | postgres-nextcloud | 76MB | pg_dump       | NEEDS SCAN     |

### Volume Data Sizes

- Supabase DB: 59.3MB
- n8n DB: 63.9MB
- Nextcloud DB: 75.8MB

**Note:** No FiskAI production database on this VPS. FiskAI DB is on VPS-01 (152.53.146.3).

---

## 6. File System Data Classification

### /home/admin Directory (18GB total)

| Directory           | Size    | Classification             | Restore Action |
| ------------------- | ------- | -------------------------- | -------------- |
| FiskAI/             | 5.9GB   | Source code + node_modules | CLONE FROM GIT |
| artemi-xmas-\*      | 5.4GB   | Source code                | CLONE FROM GIT |
| fiskai-repo/        | 2.0GB   | Source code                | CLONE FROM GIT |
| fiskai-marketing/   | 1.2GB   | Source code                | CLONE FROM GIT |
| meta-chat-platform/ | 963MB   | Source code                | CLONE FROM GIT |
| fix-\*-workspace/   | Various | Temporary worktrees        | DESTROY        |
| FiskAI-\* temp dirs | Various | Temporary fixes            | DESTROY        |
| monitoring/         | 1.8MB   | Config files               | REBUILD        |
| .cache/             | Large   | Playwright/Puppeteer       | DESTROY        |

### Executables Outside /usr/bin

- `/home/admin/*/scripts/*.sh` - Project scripts (SAFE)
- `/home/admin/*/.husky/*` - Git hooks (SAFE)
- `/opt/github-runner/` - CI runner (REBUILD)
- `/tmp/*.sh` - Temporary scripts (DESTROY)

---

## 7. Secrets & Credentials Exposure

**ASSUME ALL SECRETS COMPROMISED**

| Path                            | Type                  | Rotation Required |
| ------------------------------- | --------------------- | ----------------- |
| /home/admin/FiskAI/.env         | App secrets           | **YES**           |
| /home/admin/FiskAI/.env.local   | Local overrides       | **YES**           |
| /home/admin/fiskai-repo/.env    | App secrets           | **YES**           |
| /home/admin/.docker/config.json | Registry auth         | **YES**           |
| /home/admin/.ssh/id_ed25519     | SSH private key       | **YES**           |
| /home/admin/monitoring/secrets  | Monitoring tokens     | **YES**           |
| Supabase env vars               | API keys, JWT secrets | **YES**           |
| n8n credentials                 | Workflow secrets      | **YES**           |

### Secrets to Rotate (NOT printed)

1. COOLIFY_API_TOKEN
2. GHCR tokens
3. OLLAMA_API_KEY
4. REDIS passwords
5. Database passwords
6. NEXTAUTH_SECRET
7. All Supabase keys (anon, service_role, JWT)
8. n8n encryption key
9. SSH keys (regenerate)

---

## 8. Network Exposure & Listening Services

### Public Exposure (0.0.0.0)

| Port      | Service         | Should Exist        | Risk           |
| --------- | --------------- | ------------------- | -------------- |
| 22        | SSH             | YES                 | LOW (key-only) |
| 80        | Caddy HTTP      | YES                 | LOW            |
| 443       | Caddy HTTPS     | YES                 | LOW            |
| **19999** | **Netdata**     | **MUST BE PRIVATE** | **HIGH**       |
| 8081      | Dashboard nginx | QUESTIONABLE        | MEDIUM         |
| **61208** | **Glances**     | **MUST BE PRIVATE** | **HIGH**       |

### Tailscale-Only Exposure (100.120.14.126)

| Port  | Service            | Status |
| ----- | ------------------ | ------ |
| 6379  | Redis              | OK     |
| 5433  | Supabase Postgres  | OK     |
| 37199 | Tailscale internal | OK     |

### Localhost-Only (127.0.0.1)

- 9090: Prometheus
- 9093: Alertmanager
- 3000: Supabase Studio
- 3001: Grafana
- 3100: Loki
- 5432: Local Postgres
- 5678: n8n
- 8000: Kong
- 8080: Nextcloud

### Firewall (UFW)

- Default: deny incoming, allow outgoing
- Allowed: 22, 80, 443, tailscale0 interface
- **Missing:** Explicit blocks for 19999, 61208, 8081

---

## 9. Build & CI Artifacts

| Artifact                    | Location                         | Size    | Action      |
| --------------------------- | -------------------------------- | ------- | ----------- |
| GitHub Actions runner       | /opt/github-runner/              | 792MB   | **DESTROY** |
| Buildkit cache (privileged) | Docker volumes                   | Unknown | **DESTROY** |
| node_modules                | /home/admin/\*/node_modules      | ~10GB   | **DESTROY** |
| .next build cache           | /home/admin/\*/.next             | Various | **DESTROY** |
| Playwright cache            | /home/admin/.cache/ms-playwright | Large   | **DESTROY** |
| Puppeteer cache             | /home/admin/.cache/puppeteer     | Large   | **DESTROY** |
| Docker build cache          | /var/lib/docker                  | Large   | **DESTROY** |

**All CI/build artifacts must be destroyed and rebuilt from source.**

---

## 10. Restore Plan Summary

### A. SAFE TO RESTORE (Data Export/Import)

| Data                    | Method        | Destination       |
| ----------------------- | ------------- | ----------------- |
| Supabase Postgres dump  | pg_dump       | New VPS Supabase  |
| n8n Postgres dump       | pg_dump       | New VPS n8n       |
| Nextcloud Postgres dump | pg_dump       | New VPS Nextcloud |
| n8n workflow exports    | n8n UI export | New n8n instance  |

**All dumps must be scanned for anomalies before restore.**

### B. REBUILD FROM SCRATCH

1. **Operating System** - Fresh Debian 12 install
2. **Docker + containerd** - From official repos
3. **Tailscale** - Reinstall, re-authenticate
4. **Caddy** - Reinstall, restore Caddyfile from git
5. **Netdata** - Reinstall, bind to Tailscale IP only
6. **Glances** - Reinstall, bind to Tailscale IP only
7. **Supabase stack** - Fresh docker-compose up
8. **Monitoring stack** - Fresh docker-compose up
9. **n8n** - Fresh install, import workflows
10. **Nextcloud** - Fresh install, restore DB
11. **GitHub Actions runner** - Fresh registration
12. **FiskAI workers** - Pull from GHCR, configure env

### C. DESTROY AND NEVER REUSE

| Item                                   | Reason                       |
| -------------------------------------- | ---------------------------- |
| All Docker images on disk              | Potentially poisoned         |
| All Docker volumes (except DB exports) | Potentially poisoned         |
| Buildkit containers and state          | Privileged, potential vector |
| GitHub runner \_work directory         | Build artifacts untrusted    |
| /tmp contents                          | Execution surface            |
| ~/.cache (Playwright, Puppeteer)       | Large binary caches          |
| All node_modules directories           | Should be rebuilt            |
| SSH host keys                          | Must regenerate              |
| All .env files                         | Secrets compromised          |

---

## Risk Assessment

**Can this system be trusted?** **NO**

**Reasons:**

1. Active cryptominer was running for 2+ days with full system access
2. Intrusion vector not definitively identified (privileged buildkit containers suspected)
3. Two privileged Docker containers present potential container escape path
4. Publicly exposed monitoring services (Netdata, Glances) may have been exploitation vectors
5. All secrets must be assumed compromised
6. No audit logging was enabled to trace attacker actions

**Mandatory Actions:**

1. **Reimage this VPS from clean Debian 12 ISO**
2. Rotate ALL secrets across entire infrastructure
3. Export and scan databases before restore
4. Rebuild all containers from trusted registries
5. Never run privileged containers without explicit justification
6. Bind all monitoring services to Tailscale interface only
7. Enable auditd for process execution logging
8. Implement alerting for processes in /tmp

**This system CANNOT be cleaned in place. Full reimage required.**
