# VPS-02 Zero-Trust Rebuild Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild VPS-02 (152.53.179.101) from clean state after cryptominer compromise, with hardened security posture.

**Architecture:** Fresh Debian 12 installation with all services reconstructed from trusted sources. Zero data or binaries carried from compromised system. All secrets rotated. Network exposure minimized to SSH + HTTPS + Tailscale only.

**Tech Stack:** Debian 12, Docker, Tailscale, Caddy, Redis, PostgreSQL (Supabase), Netdata, GitHub Actions Runner

**Incident Reference:** Cryptominer (xmrig) detected 2026-01-13, running since 2026-01-11. Forensic inventory at `/home/admin/VPS_FORENSIC_RECOVERY_INVENTORY.md`

---

## Phase 0: Pre-Rebuild Data Export (ON COMPROMISED SYSTEM)

### Task 0.1: Export Database Dumps

**Files:**

- Create: `/tmp/exports/supabase-dump-2026-01-13.sql`
- Create: `/tmp/exports/n8n-dump-2026-01-13.sql`
- Create: `/tmp/exports/nextcloud-dump-2026-01-13.sql`

**Step 1: Create export directory**

```bash
mkdir -p /tmp/exports
chmod 700 /tmp/exports
```

**Step 2: Export Supabase PostgreSQL**

```bash
docker exec postgres-supabase pg_dump -U postgres -d postgres --clean --if-exists > /tmp/exports/supabase-dump-2026-01-13.sql
```

Expected: SQL dump file ~60MB

**Step 3: Export n8n PostgreSQL**

```bash
docker exec postgres-n8n pg_dump -U postgres -d n8n --clean --if-exists > /tmp/exports/n8n-dump-2026-01-13.sql
```

Expected: SQL dump file ~64MB

**Step 4: Export Nextcloud PostgreSQL**

```bash
docker exec postgres-nextcloud pg_dump -U postgres -d nextcloud --clean --if-exists > /tmp/exports/nextcloud-dump-2026-01-13.sql
```

Expected: SQL dump file ~76MB

**Step 5: Verify exports**

```bash
ls -lh /tmp/exports/
head -50 /tmp/exports/supabase-dump-2026-01-13.sql
```

Expected: Files exist, SQL headers visible, no binary garbage

### Task 0.2: Export n8n Workflows (JSON)

**Step 1: Export via n8n CLI**

```bash
docker exec n8n n8n export:workflow --all --output=/tmp/workflows.json 2>/dev/null || echo "Use n8n UI export instead"
```

Alternative: Export via n8n UI at http://localhost:5678 → Settings → Export

**Step 2: Copy to exports**

```bash
docker cp n8n:/tmp/workflows.json /tmp/exports/n8n-workflows-2026-01-13.json 2>/dev/null || echo "Manual export required"
```

### Task 0.3: Transfer Exports Off-System

**Step 1: Copy to safe location via Tailscale**

```bash
# From a TRUSTED machine (not VPS-02):
scp -r admin@100.120.14.126:/tmp/exports/ /secure/backup/vps02-exports-2026-01-13/
```

**Step 2: Scan exports for malware**

```bash
# On trusted machine with ClamAV:
clamscan -r /secure/backup/vps02-exports-2026-01-13/
```

Expected: No infected files found

**Step 3: Verify SQL integrity**

```bash
# Check for suspicious content in dumps
grep -i "xmrig\|mining\|stratum\|base64_decode\|eval(" /secure/backup/vps02-exports-2026-01-13/*.sql
```

Expected: No matches

---

## Phase 1: Fresh OS Installation (HETZNER CONSOLE)

### Task 1.1: Reimage Server

**Step 1: Access Hetzner Cloud Console**

Navigate to: https://console.hetzner.cloud → Select server v2202510269591389839

**Step 2: Stop server**

Click: Power → Power Off (wait for confirmation)

**Step 3: Reinstall OS**

Click: Rescue → Reinstall → Select "Debian 12" → Confirm

**Step 4: Set root password**

Use generated password, save securely in password manager.

**Step 5: Boot and verify**

Click: Power → Power On
Wait 2-3 minutes for boot.

**Step 6: First SSH connection**

```bash
ssh root@152.53.179.101
# Accept new host key (old key is now invalid)
```

Expected: Fresh Debian 12 login prompt

### Task 1.2: Initial System Hardening

**Step 1: Update system**

```bash
apt update && apt upgrade -y
```

**Step 2: Create admin user**

```bash
adduser admin
usermod -aG sudo admin
```

**Step 3: Configure SSH**

```bash
mkdir -p /home/admin/.ssh
chmod 700 /home/admin/.ssh

# Add your public key (from trusted source, NOT from compromised system)
cat > /home/admin/.ssh/authorized_keys << 'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJdw3DaaJIToOKZTl4pAgRF3ZfnDGYMcxB3xNrVPuvTg user@ArtemiPC
EOF

chmod 600 /home/admin/.ssh/authorized_keys
chown -R admin:admin /home/admin/.ssh
```

**Step 4: Harden SSH config**

```bash
cat >> /etc/ssh/sshd_config << 'EOF'

# Security hardening
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

systemctl restart sshd
```

**Step 5: Test SSH as admin (NEW TERMINAL)**

```bash
ssh admin@152.53.179.101
sudo whoami
```

Expected: "root" (sudo works)

**Step 6: Disable root login test**

```bash
ssh root@152.53.179.101
```

Expected: Permission denied

### Task 1.3: Install UFW Firewall

**Step 1: Install and configure**

```bash
sudo apt install -y ufw

# Default deny
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow only essentials
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Enable
sudo ufw enable
sudo ufw status verbose
```

Expected: Status active, only 22, 80, 443 allowed

### Task 1.4: Install Tailscale

**Step 1: Install from official repo**

```bash
curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg > /dev/null
curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list > /dev/null
sudo apt update
sudo apt install -y tailscale
```

**Step 2: Authenticate**

```bash
sudo tailscale up
```

Follow the URL to authenticate with Tailscale account.

**Step 3: Verify**

```bash
tailscale status
tailscale ip -4
```

Expected: Connected, IP assigned (likely new IP, not 100.120.14.126)

**Step 4: Allow Tailscale in UFW**

```bash
sudo ufw allow in on tailscale0 comment 'Allow Tailscale network'
sudo ufw status
```

### Task 1.5: Enable Audit Logging

**Step 1: Install auditd**

```bash
sudo apt install -y auditd audispd-plugins
```

**Step 2: Configure process execution auditing**

```bash
sudo cat >> /etc/audit/rules.d/exec.rules << 'EOF'
# Log all process executions
-a always,exit -F arch=b64 -S execve -k exec
-a always,exit -F arch=b32 -S execve -k exec

# Log executions from /tmp (suspicious)
-w /tmp -p x -k tmp_exec
-w /var/tmp -p x -k tmp_exec
-w /dev/shm -p x -k tmp_exec
EOF

sudo systemctl restart auditd
sudo auditctl -l
```

Expected: Rules loaded

---

## Phase 2: Docker Installation (CLEAN)

### Task 2.1: Install Docker from Official Repo

**Step 1: Install prerequisites**

```bash
sudo apt install -y ca-certificates curl gnupg lsb-release
```

**Step 2: Add Docker GPG key**

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

**Step 3: Add Docker repository**

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

**Step 4: Install Docker**

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

**Step 5: Add admin to docker group**

```bash
sudo usermod -aG docker admin
# Log out and back in for group to take effect
exit
ssh admin@152.53.179.101
```

**Step 6: Verify installation**

```bash
docker run hello-world
docker version
```

Expected: Hello World runs, Docker version displayed

### Task 2.2: Configure Docker Daemon Security

**Step 1: Create daemon config**

```bash
sudo mkdir -p /etc/docker
sudo cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "no-new-privileges": true,
  "live-restore": true,
  "userland-proxy": false
}
EOF
```

**Step 2: Restart Docker**

```bash
sudo systemctl restart docker
sudo systemctl status docker
```

Expected: Active (running)

### Task 2.3: Authenticate to GHCR

**Step 1: Create GHCR token (GitHub UI)**

Navigate to: GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
Create token with `read:packages` scope only.

**Step 2: Login to GHCR**

```bash
echo "YOUR_NEW_GHCR_TOKEN" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

Expected: Login Succeeded

**Step 3: Verify**

```bash
docker pull ghcr.io/wandeon/fiskai-worker:latest
```

Expected: Image pulls successfully

---

## Phase 3: Service Reconstruction

### Task 3.1: Install Caddy

**Step 1: Install from official repo**

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

**Step 2: Configure Caddyfile**

```bash
sudo cat > /etc/caddy/Caddyfile << 'EOF'
{
    email admin@fiskai.hr
}

# Default - return 404 for unknown hosts
:80, :443 {
    respond "Not Found" 404
}
EOF
```

**Step 3: Enable and start**

```bash
sudo systemctl enable caddy
sudo systemctl start caddy
sudo systemctl status caddy
```

### Task 3.2: Install Netdata (Tailscale-Only)

**Step 1: Install Netdata**

```bash
wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh
sh /tmp/netdata-kickstart.sh --stable-channel --disable-telemetry
```

**Step 2: Configure to bind to Tailscale only**

```bash
TAILSCALE_IP=$(tailscale ip -4)
sudo cat > /etc/netdata/netdata.conf << EOF
[global]
    hostname = vps-02-rebuilt

[web]
    bind to = ${TAILSCALE_IP}
    allow connections from = localhost 100.*
EOF
```

**Step 3: Restart Netdata**

```bash
sudo systemctl restart netdata
```

**Step 4: Verify binding**

```bash
ss -tlnp | grep 19999
```

Expected: Only listening on Tailscale IP, NOT 0.0.0.0

### Task 3.3: Deploy Redis (Tailscale-Only)

**Step 1: Create docker-compose for Redis**

```bash
mkdir -p ~/services/redis
cat > ~/services/redis/docker-compose.yml << 'EOF'
services:
  redis:
    image: redis:7-alpine
    container_name: fiskai-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "${TAILSCALE_IP}:6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  redis_data:
EOF
```

**Step 2: Create .env with NEW password**

```bash
# Generate new password
REDIS_PASS=$(openssl rand -hex 32)
TAILSCALE_IP=$(tailscale ip -4)

cat > ~/services/redis/.env << EOF
REDIS_PASSWORD=${REDIS_PASS}
TAILSCALE_IP=${TAILSCALE_IP}
EOF

echo "New Redis password: ${REDIS_PASS}"
echo "SAVE THIS PASSWORD SECURELY"
```

**Step 3: Start Redis**

```bash
cd ~/services/redis
docker compose up -d
docker compose ps
```

Expected: redis healthy

**Step 4: Verify Tailscale-only binding**

```bash
ss -tlnp | grep 6379
```

Expected: Only Tailscale IP, NOT 0.0.0.0

### Task 3.4: Deploy FiskAI Workers

**Step 1: Clone FiskAI repo**

```bash
cd ~
git clone https://github.com/Wandeon/FiskAI.git
cd FiskAI
```

**Step 2: Create production .env**

```bash
cat > .env << 'EOF'
# Database (VPS-01 via Tailscale)
DATABASE_URL=postgresql://fiskai:NEW_PASSWORD@VPS01_TAILSCALE_IP:5432/fiskai?schema=public
REGULATORY_DATABASE_URL=postgresql://fiskai:NEW_PASSWORD@VPS01_TAILSCALE_IP:5432/fiskai?schema=regulatory

# Redis (local via Tailscale IP)
REDIS_URL=redis://:NEW_REDIS_PASSWORD@TAILSCALE_IP:6379

# Ollama
OLLAMA_ENDPOINT=https://ollama.com
OLLAMA_API_KEY=NEW_OLLAMA_KEY
OLLAMA_MODEL=gemini-3-flash-preview
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_EMBED_DIMS=768

# Coolify
COOLIFY_API_TOKEN=NEW_COOLIFY_TOKEN
EOF

echo "EDIT THIS FILE WITH ACTUAL NEW VALUES"
```

**Step 3: Pull worker images**

```bash
docker pull ghcr.io/wandeon/fiskai-worker:latest
docker pull ghcr.io/wandeon/fiskai-worker-ocr:latest
```

**Step 4: Deploy workers**

```bash
docker compose -f docker-compose.workers.yml up -d
docker compose -f docker-compose.workers.yml ps
```

Expected: All workers running (not restarting)

### Task 3.5: Install GitHub Actions Runner

**Step 1: Create runner directory**

```bash
sudo mkdir -p /opt/github-runner/fiskai-app
sudo chown admin:admin /opt/github-runner/fiskai-app
cd /opt/github-runner/fiskai-app
```

**Step 2: Download runner**

```bash
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-x64-2.321.0.tar.gz
tar xzf actions-runner-linux-x64.tar.gz
rm actions-runner-linux-x64.tar.gz
```

**Step 3: Configure runner (GitHub UI)**

Go to: GitHub → Wandeon/FiskAI → Settings → Actions → Runners → New self-hosted runner
Copy the token provided.

```bash
./config.sh --url https://github.com/Wandeon/FiskAI --token YOUR_NEW_TOKEN --name fiskai-vps-02-rebuilt --labels self-hosted,linux,x64,fiskai-build
```

**Step 4: Install as service**

```bash
sudo ./svc.sh install admin
sudo ./svc.sh start
sudo ./svc.sh status
```

Expected: Active (running)

---

## Phase 4: Secret Rotation Checklist

### Task 4.1: Secrets to Rotate

| Secret                | Location          | New Value Required       |
| --------------------- | ----------------- | ------------------------ |
| GHCR Token            | GitHub PAT        | YES - read:packages only |
| COOLIFY_API_TOKEN     | Coolify dashboard | YES                      |
| REDIS_PASSWORD        | .env files        | YES (generated above)    |
| DATABASE_URL password | VPS-01 + Coolify  | YES                      |
| OLLAMA_API_KEY        | Ollama dashboard  | YES                      |
| NEXTAUTH_SECRET       | Coolify env       | YES                      |
| SSH Keys              | /home/admin/.ssh  | Already regenerated      |
| Supabase JWT_SECRET   | Supabase config   | YES                      |
| n8n ENCRYPTION_KEY    | n8n config        | YES                      |

**Step 1: Generate new secrets**

```bash
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

**Step 2: Update all services with new secrets**

Document each rotation in password manager.

---

## Phase 5: Validation

### Task 5.1: Security Verification

**Step 1: Verify no public exposure**

```bash
# From external machine:
nmap -p 19999,61208,8081 152.53.179.101
```

Expected: All ports filtered/closed

**Step 2: Verify Tailscale-only services**

```bash
ss -tlnp | grep -E "0.0.0.0.*(19999|6379|5432)"
```

Expected: No matches (nothing on 0.0.0.0 except 22, 80, 443)

**Step 3: Verify audit logging**

```bash
sudo ausearch -k exec --start recent | head -20
```

Expected: Process execution logs visible

### Task 5.2: Service Health Check

**Step 1: Check all services**

```bash
systemctl status docker tailscaled caddy netdata
docker compose -f ~/FiskAI/docker-compose.workers.yml ps
```

Expected: All services active, all workers running

**Step 2: Verify worker database connectivity**

```bash
docker logs fiskai-worker-sentinel --tail 20
```

Expected: No database connection errors, worker processing

---

## Completion Criteria

- [ ] Fresh Debian 12 installed (not upgraded)
- [ ] SSH hardened (key-only, no root)
- [ ] UFW active (22, 80, 443 only + Tailscale)
- [ ] Tailscale connected
- [ ] Auditd logging process executions
- [ ] Docker installed from official repo
- [ ] No privileged containers
- [ ] Netdata bound to Tailscale IP only
- [ ] Redis bound to Tailscale IP only
- [ ] All workers running and healthy
- [ ] All secrets rotated
- [ ] External port scan shows only 22, 80, 443

**Total estimated time:** 2-3 hours (excluding database restore validation)
