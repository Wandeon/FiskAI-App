# Device Security Audit Report (Privileged)

Date: 2025-12-20
Scope: Local privileged audit of this device (host-level checks).

## Changes made during audit

- Ran `apt-get update`.
- Installed `lynis` (and `menu` dependency). This created `lynis.timer` under systemd.

## Summary (highest risk)

1. SSH allows root login and password authentication while active brute‑force attempts are ongoing.
2. Host firewall policy is ACCEPT for INPUT; UFW inactive. Public services are exposed on multiple ports.
3. Several services are bound to 0.0.0.0/::, including monitoring and dev services.

---

## Critical findings

### C1) SSH permits root login and password auth

- Evidence:
  - `/etc/ssh/sshd_config`: `PermitRootLogin yes`, `PasswordAuthentication yes`
  - Effective config: `permitrootlogin yes`, `passwordauthentication yes`
- Impact: Brute-force password attempts can target root directly.

### C2) Active brute-force attacks against SSH

- Evidence: `journalctl -u ssh --since "7 days ago"` shows frequent failed logins for root/admin and many invalid users.
- Fail2ban confirms scale:
  - Total failed: 197,538
  - Total banned: 22,837
  - Currently banned: 9

### C3) Firewall is effectively permissive

- Evidence:
  - `ufw status verbose` => inactive
  - `nft list ruleset` => INPUT policy accept; only Fail2ban chain for sshd
- Impact: Any service bound to 0.0.0.0 is reachable from the internet unless restricted upstream.

---

## High findings

### H1) Multiple public services exposed

- Evidence from `ss -tulpn`:
  - 22/tcp: sshd
  - 80/tcp, 443/tcp+udp: docker-proxy (container ports)
  - 3000/tcp: next-server (dev server) on all interfaces
  - 3002/tcp: docker-proxy
  - 5434/tcp: docker-proxy (likely PostgreSQL 5432 mapped)
  - 6001/tcp, 6002/tcp: docker-proxy
  - 8000/tcp, 8080/tcp: docker-proxy
  - 61208/tcp: glances (monitoring) bound to 0.0.0.0
  - 5353/udp: avahi-daemon (mDNS) bound to 0.0.0.0
  - 41641/udp: tailscaled
- Impact: Expanded attack surface; dev/monitoring ports should not be public.

### H2) Insecure sudoers.d permissions

- Evidence:
  - `/etc/sudoers.d/admin-systemctl` is `-rw-r--r--` (0644)
- Impact: Should be root-owned and 0440/0640 to prevent unintended edits and to satisfy sudoers checks.

---

## Medium findings

### M1) Docker group grants root-equivalent privileges

- Evidence: `admin` is member of `docker` group.
- Impact: Docker group can mount host filesystem and bypass most security controls.

### M2) Home directory permissions too permissive

- Evidence: `/home/admin` is 0755.
- Impact: Other users can read contents (if multi-user).

### M3) Pending security updates

- Evidence: apt upgrade lists security updates (chromium, libav\*, docker)
- Lynis warning: “Found one or more vulnerable packages.”

---

## Low / informational

- Fail2ban is active and blocking IPs, but does not replace SSH hardening.
- Secure Boot disabled (may be expected on VPS).
- Some Lynis suggestions: GRUB password, sysctl hardening, logging, file integrity tooling.
- `lynis` detected Redis without config file (verify location if Redis is used).

---

## Recommendations (ordered)

### 1) Harden SSH immediately

Edit `/etc/ssh/sshd_config`:

```
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers admin
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
```

Then:

```
systemctl restart ssh
```

### 2) Lock down firewall

- Define explicit allow-list for required ports only (likely 22, 80, 443, and Tailscale 41641/udp).
- Close public access to dev/monitoring ports (3000/3002/61208/6001/6002/5434/8000/8080).

### 3) Move public services behind a reverse proxy

- Expose only 80/443 to the world.
- Bind internal services to 127.0.0.1 or docker internal networks.

### 4) Fix sudoers permissions

```
chmod 440 /etc/sudoers.d/admin-systemctl
chown root:root /etc/sudoers.d/admin-systemctl
```

### 5) Patch and reboot

```
apt-get upgrade
reboot
```

### 6) Tighten home directory permissions (if multi-user)

```
chmod 700 /home/admin
```

---

## Evidence files

- Lynis report: `/var/log/lynis-report.dat`
- Lynis log: `/var/log/lynis.log`

## Next actions you may want me to take

- Apply SSH hardening and firewall ruleset.
- Close public ports by updating Docker or service bindings.
- Implement a baseline sysctl hardening profile.
