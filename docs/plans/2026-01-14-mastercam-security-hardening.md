# Mastercam Security Hardening - Implementation Plan

**Date:** 2026-01-14
**Target System:** mastercam (100.70.96.49)
**Access Model:** LAN (192.168.0.0/24) + Tailnet (100.64.0.0/10) only

---

## Executive Summary

This plan hardens the Mastercam system (Raspberry Pi 5 running Home Assistant, AI Camera, and Camera Wall) against security vulnerabilities while preserving all functionality. The implementation is split into 5 phases with safety gates between each.

---

## Phase 1: Preparation & Backup (Zero Risk)

### Objective

Create backups and prepare environment files before making any changes.

### Tasks

#### 1.1 Create full config backup

```bash
ssh mastercam "mkdir -p /home/admin/backups/2026-01-14-security-hardening"
ssh mastercam "cp -r /opt/ai-camera /home/admin/backups/2026-01-14-security-hardening/"
ssh mastercam "cp -r /opt/camera-wall /home/admin/backups/2026-01-14-security-hardening/"
ssh mastercam "cp -r /home/admin/homeassistant /home/admin/backups/2026-01-14-security-hardening/"
ssh mastercam "cp /etc/ssh/sshd_config /home/admin/backups/2026-01-14-security-hardening/"
```

#### 1.2 Create /opt/ai-camera/.env file

```bash
# Content for /opt/ai-camera/.env
TELEGRAM_BOT_TOKEN=7980522219:AAFe_uiYVZ25kRm7lmh5JjLG6gqhzJP3Eh8
TELEGRAM_CHAT_ID=8242276652
PASSWORD_HASH=c51f400a566aaacd4def9e30c0e326a01448842aae32fc017f0387140590b904
TTS_SERVICE_URL=http://100.89.2.111:5050
```

Permissions: 600, owner admin

#### 1.3 Verify Tailscale connectivity

```bash
# From vps, verify we can reach mastercam via Tailscale IP
tailscale ping mastercam
ssh admin@100.70.96.49 "echo 'Tailscale SSH working'"
```

### Verification Gate

- [ ] Backup directory exists with all files
- [ ] .env file created with correct permissions
- [ ] Tailscale ping succeeds
- [ ] SSH via Tailscale IP works

---

## Phase 2: Code Security Fixes (Low Risk)

### Objective

Remove hardcoded secrets from source code, add authentication to exposed endpoints, fix CORS.

### Tasks

#### 2.1 Update app.py to use environment variables

**Remove these hardcoded values:**

```python
# REMOVE THESE LINES:
TELEGRAM_BOT_TOKEN = "7980522219:AAFe_uiYVZ25kRm7lmh5JjLG6gqhzJP3Eh8"
TELEGRAM_CHAT_ID = "8242276652"
PASSWORD_HASH = "c51f400a566aaacd4def9e30c0e326a01448842aae32fc017f0387140590b904"
```

**Replace with:**

```python
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/opt/ai-camera/.env')

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')
PASSWORD_HASH = os.getenv('PASSWORD_HASH')
TTS_SERVICE_URL = os.getenv('TTS_SERVICE_URL', 'http://100.89.2.111:5050')
```

#### 2.2 Add authentication to exposed endpoints

**Endpoints to protect (add `username: str = Depends(verify_session)`):**

- `/api/stream`
- `/api/detections`
- `/api/snapshot`
- `/api/stats`
- `/api/settings` (GET and POST)
- `/api/push/*` endpoints
- `/api/classes`
- `/api/voice-queue`
- `/api/voice-queue/mark-processed`

**Endpoints to keep public (required for functionality):**

- `/login` (GET and POST)
- `/logout`
- `/healthz`
- `/sw.js`
- `/` (redirects to login if not authenticated)
- `/api/go2rtc/*` (internal proxy, protected by network firewall)
- `/ws` (WebSocket for streaming)

#### 2.3 Fix CORS configuration

**Change from:**

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    ...
)
```

**Change to:**

```python
ALLOWED_ORIGINS = [
    "http://192.168.0.55:5000",
    "http://mastercam:5000",
    "http://mastercam.local:5000",
    "http://100.70.96.49:5000",
    "http://mastercam.taildb94e1.ts.net:5000",
    "http://localhost:5000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
```

#### 2.4 Install python-dotenv if not present

```bash
ssh mastercam "pip3 install python-dotenv --break-system-packages"
```

#### 2.5 Update systemd service to load .env

```bash
# Add to /etc/systemd/system/ai-camera.service under [Service]:
EnvironmentFile=/opt/ai-camera/.env
```

#### 2.6 Restart and verify ai-camera service

```bash
ssh mastercam "sudo systemctl daemon-reload && sudo systemctl restart ai-camera"
ssh mastercam "sleep 5 && systemctl status ai-camera"
ssh mastercam "curl -s http://localhost:5000/healthz"
```

### Verification Gate

- [ ] ai-camera service running
- [ ] /healthz returns OK
- [ ] /api/stream returns 401 without auth
- [ ] Login page works
- [ ] Can authenticate and view stream

---

## Phase 3: Firewall Configuration (Medium Risk)

### Objective

Install and configure ufw firewall with safety mechanisms.

### Tasks

#### 3.1 Install ufw

```bash
ssh mastercam "sudo apt update && sudo apt install -y ufw"
```

#### 3.2 Configure firewall rules (before enabling)

```bash
# Default policies
ssh mastercam "sudo ufw default deny incoming"
ssh mastercam "sudo ufw default allow outgoing"

# SSH - Tailscale and LAN
ssh mastercam "sudo ufw allow in on tailscale0 to any port 22 proto tcp"
ssh mastercam "sudo ufw allow from 192.168.0.0/24 to any port 22 proto tcp"

# AI Camera (5000) - Tailscale and LAN
ssh mastercam "sudo ufw allow in on tailscale0 to any port 5000 proto tcp"
ssh mastercam "sudo ufw allow from 192.168.0.0/24 to any port 5000 proto tcp"

# Home Assistant (8123) - Tailscale and LAN
ssh mastercam "sudo ufw allow in on tailscale0 to any port 8123 proto tcp"
ssh mastercam "sudo ufw allow from 192.168.0.0/24 to any port 8123 proto tcp"

# MQTT (1883) - Tailscale and LAN
ssh mastercam "sudo ufw allow in on tailscale0 to any port 1883 proto tcp"
ssh mastercam "sudo ufw allow from 192.168.0.0/24 to any port 1883 proto tcp"

# RTSP/Media ports - Tailscale and LAN
ssh mastercam "sudo ufw allow in on tailscale0 to any port 8554 proto tcp"  # MediaMTX RTSP
ssh mastercam "sudo ufw allow from 192.168.0.0/24 to any port 8554 proto tcp"
ssh mastercam "sudo ufw allow in on tailscale0 to any port 1935 proto tcp"  # RTMP
ssh mastercam "sudo ufw allow from 192.168.0.0/24 to any port 1935 proto tcp"
ssh mastercam "sudo ufw allow in on tailscale0 to any port 8888 proto tcp"  # HLS
ssh mastercam "sudo ufw allow from 192.168.0.0/24 to any port 8888 proto tcp"
ssh mastercam "sudo ufw allow in on tailscale0 to any port 8889 proto tcp"  # WebRTC HTTP
ssh mastercam "sudo ufw allow from 192.168.0.0/24 to any port 8889 proto tcp"
ssh mastercam "sudo ufw allow in on tailscale0 to any port 8555 proto tcp"  # go2rtc WebRTC
ssh mastercam "sudo ufw allow from 192.168.0.0/24 to any port 8555 proto tcp"
ssh mastercam "sudo ufw allow in on tailscale0 to any port 1984 proto tcp"  # go2rtc API
ssh mastercam "sudo ufw allow from 192.168.0.0/24 to any port 1984 proto tcp"

# Tailscale UDP (must allow for Tailscale to work)
ssh mastercam "sudo ufw allow 41641/udp"

# Docker internal network
ssh mastercam "sudo ufw allow in on br-cd4ebe4c4fed"
ssh mastercam "sudo ufw allow in on docker0"

# mDNS (local discovery)
ssh mastercam "sudo ufw allow from 192.168.0.0/24 to any port 5353 proto udp"

# Loopback (always allow)
ssh mastercam "sudo ufw allow in on lo"
```

#### 3.3 Create safety disable script

```bash
# Create /home/admin/disable-firewall.sh
ssh mastercam "cat > /home/admin/disable-firewall.sh << 'EOF'
#!/bin/bash
sudo ufw disable
echo 'Firewall disabled by safety script at $(date)' >> /home/admin/firewall-safety.log
EOF"
ssh mastercam "chmod +x /home/admin/disable-firewall.sh"
```

#### 3.4 Create safety cron job (auto-disable in 5 minutes)

```bash
ssh mastercam "echo '*/5 * * * * /home/admin/disable-firewall.sh' | sudo tee /etc/cron.d/firewall-safety"
```

#### 3.5 Enable firewall

```bash
ssh mastercam "sudo ufw --force enable"
ssh mastercam "sudo ufw status verbose"
```

#### 3.6 Test access immediately (within 5 minutes)

```bash
# Test from current session
ssh mastercam "echo 'SSH via Tailscale working'"

# Test services
ssh mastercam "curl -s http://localhost:5000/healthz"
ssh mastercam "curl -s http://localhost:8123" | head -5
```

#### 3.7 Remove safety cron once verified

```bash
ssh mastercam "sudo rm /etc/cron.d/firewall-safety"
```

### Verification Gate

- [ ] ufw status shows rules active
- [ ] SSH via Tailscale works
- [ ] AI Camera accessible via Tailscale
- [ ] Home Assistant accessible via Tailscale
- [ ] Safety cron removed

---

## Phase 4: SSH Hardening (Low Risk - After Firewall Verified)

### Objective

Harden SSH configuration now that firewall is protecting us.

### Tasks

#### 4.1 Create hardened sshd_config

```bash
ssh mastercam "sudo tee /etc/ssh/sshd_config.d/hardening.conf << 'EOF'
# Security hardening
PermitRootLogin no
PasswordAuthentication no
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
PrintMotd no
AcceptEnv LANG LC_*
Subsystem sftp /usr/lib/openssh/sftp-server
EOF"
```

#### 4.2 Test SSH config before applying

```bash
ssh mastercam "sudo sshd -t"
```

#### 4.3 Restart SSH service

```bash
ssh mastercam "sudo systemctl restart ssh"
```

#### 4.4 Verify SSH still works (from same session)

```bash
# Open NEW terminal and test before closing this one
ssh admin@100.70.96.49 "echo 'SSH hardening successful'"
```

### Verification Gate

- [ ] sshd -t shows no errors
- [ ] New SSH connection works with key
- [ ] Password auth rejected

---

## Phase 5: System Updates & Cleanup (Low Risk)

### Objective

Apply security updates, clean up backup files, fix process credential exposure.

### Tasks

#### 5.1 Apply system updates

```bash
ssh mastercam "sudo apt update && sudo apt upgrade -y"
```

#### 5.2 Fix camera-wall credential exposure in process list

The camera-wall script sources credentials from config.env which then appear in the process list when ffmpeg runs.

**Solution:** Use a wrapper script that reads credentials and passes them via file descriptor.

Create `/opt/camera-wall/start-secure.sh`:

```bash
#!/bin/bash
# Secure camera wall starter - hides credentials from process list

source /opt/camera-wall/config.env

# Create temporary credential file (in memory)
CRED_FILE=$(mktemp)
chmod 600 "$CRED_FILE"
echo "${NVR_USER}:${NVR_PASS}" > "$CRED_FILE"

# Build RTSP URLs using ffmpeg's credential file option
export RTSP_BASE="rtsp://@${NVR_HOST}:${NVR_PORT}/Streaming/Channels"

# Use -auth option or rewrite to use .netrc
# Alternative: Use named pipe or file for credentials

cleanup() {
    rm -f "$CRED_FILE"
}
trap cleanup EXIT

# For now, the simplest fix is to ensure only admin can see processes
# Full fix requires ffmpeg credential file support or proxy

exec /opt/camera-wall/start.sh
```

**Note:** FFmpeg doesn't have great credential hiding support. Best mitigation is firewall + restricted process visibility.

#### 5.3 Restrict process visibility (hidepid)

```bash
ssh mastercam "echo 'proc /proc proc defaults,hidepid=2 0 0' | sudo tee -a /etc/fstab"
ssh mastercam "sudo mount -o remount,hidepid=2 /proc"
```

This makes processes only visible to their owner (admin can only see admin's processes).

#### 5.4 Clean up old backup files

```bash
ssh mastercam "rm -f /opt/ai-camera/app.py.backup-*"
```

#### 5.5 Update Home Assistant secrets.yaml

```bash
ssh mastercam "sed -i 's/some_password: welcome/# some_password: REMOVED - use HA secrets properly/' /home/admin/homeassistant/secrets.yaml"
```

#### 5.6 Configure Docker log rotation

```bash
ssh mastercam "sudo tee /etc/docker/daemon.json << 'EOF'
{
  \"log-driver\": \"json-file\",
  \"log-opts\": {
    \"max-size\": \"10m\",
    \"max-file\": \"3\"
  }
}
EOF"
ssh mastercam "sudo systemctl restart docker"
```

#### 5.7 Reboot and final verification

```bash
ssh mastercam "sudo reboot"
# Wait 60 seconds
sleep 60
ssh mastercam "echo 'System rebooted successfully'"
ssh mastercam "systemctl status ai-camera camera-wall homeassistant"
```

### Verification Gate

- [ ] System updated
- [ ] Process list no longer shows credentials (hidepid)
- [ ] Old backups removed
- [ ] Docker log rotation configured
- [ ] All services running after reboot

---

## Rollback Procedures

### If locked out via SSH:

1. Physical access to Pi (keyboard/monitor on seat0/tty1)
2. Login as admin
3. `sudo ufw disable`
4. `sudo systemctl restart ssh`

### If ai-camera broken:

```bash
ssh mastercam "sudo systemctl stop ai-camera"
ssh mastercam "cp /home/admin/backups/2026-01-14-security-hardening/ai-camera/app.py /opt/ai-camera/app.py"
ssh mastercam "sudo systemctl start ai-camera"
```

### If firewall blocking everything:

```bash
# From local console
sudo ufw disable
sudo ufw reset
```

---

## Post-Implementation Checklist

- [ ] All services running (ai-camera, camera-wall, homeassistant, mediamtx, go2rtc)
- [ ] Firewall active with correct rules
- [ ] SSH only accepts key authentication
- [ ] No credentials visible in process list
- [ ] API endpoints require authentication
- [ ] System packages updated
- [ ] Backup created and verified
