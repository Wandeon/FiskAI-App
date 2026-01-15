# Production Infrastructure Safety Contract

> **Incident Reference:** 2026-01-13 VPS-02 Compromise (xmrig cryptominer via exposed Glances)
>
> This contract exists because unchecked agent autonomy on production infrastructure caused a security incident. These rules are **binding and non-negotiable**.

---

## Core Principles

- I may inspect freely.
- I may propose changes.
- I may execute only after declaring security impact.
- I must never expose services publicly without explicit approval.
- I must never assume public access is acceptable.
- When in doubt, I stop.

---

## Deterministic Stop Triggers (PLAN+WAIT Required)

If any planned action matches a trigger below, I **MUST** enter Phase 1 (PLAN) and wait for explicit approval before executing.

### Exposure Changes

- Binding to `0.0.0.0` or `::` (IPv6 wildcard)
- Adding/changing published ports in Docker/Compose
- Changing Caddy/Nginx reverse_proxy targets or upstreams

### Firewall/Routing Changes

- `ufw` / `iptables` / `nft` / `fail2ban` config
- Security group or network ACL modifications

### Container Privilege Changes

- `privileged: true`
- `cap_add` or `security_opt` modifications
- `network_mode: host`
- Mounting `/var/run/docker.sock`

### Secrets/Identity Changes

- API keys, OAuth apps, SSH keys
- JWT secrets, encryption keys
- Certificate or TLS configuration

### System-Level Changes

- systemd unit creation/modification
- `/etc` file changes
- Kernel parameters (`sysctl`)

---

## Pre-Approved Safe Actions (No Waiting)

The following are allowed **without PLAN+WAIT** as long as they do not change exposure:

### Read-Only Inspection

```
ps, top, htop, ss, netstat, lsof
journalctl, dmesg, systemctl status
docker ps, docker logs, docker inspect
cat, grep, jq, head, tail, less
df, free, uptime, who, w
curl/wget to localhost only
```

### File Operations

- Creating new files in repo directories or `~/work`
- Editing application code (not infra config)

### Service Restarts

- Restarting a single service/container **ONLY IF**:
  - Published ports remain identical (must prove via `docker inspect`)
  - Bindings remain identical
  - No privilege escalation

---

## Mandatory Exposure Diff (Before/After)

For **any Phase 2 EXECUTE** work that touches infrastructure, I must capture and paste:

### Before Execution

```bash
ss -tulpn | grep -E "0.0.0.0|::|LISTEN"
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -v "^NAMES"
```

### After Execution

```bash
ss -tulpn | grep -E "0.0.0.0|::|LISTEN"
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -v "^NAMES"
# Highlight any diffs from before
```

If new `0.0.0.0` or `::` bindings appear that weren't approved, **immediately revert**.

---

## Break-Glass Procedure

If and only if the operator replies with:

```
BREAK_GLASS: approved
```

I may execute Stop Trigger actions, but I **must still**:

1. Provide the full PLAN
2. Capture the Mandatory Exposure Diff
3. Document the exception in the session

This token is for emergencies only. It does not disable logging or diff requirements.

---

## Absolute Prohibitions

These are **FORBIDDEN** even with BREAK_GLASS unless operator provides explicit written justification:

| Action                                         | Risk                 |
| ---------------------------------------------- | -------------------- |
| Disable firewall entirely                      | Total exposure       |
| Set firewall default to ACCEPT                 | Defense removal      |
| Run container as `--privileged` + `--net=host` | Full host compromise |
| Mount Docker socket in privileged container    | Container escape     |
| Install compilers/build tools on production    | Attack surface       |

---

## Conflict Resolution

If these rules conflict with a task:

**The rules win.**

Speed is secondary. Security is primary. Silence is not consent.

---

## VPS Inventory

| Host   | Role              | Public IP      | Tailscale IP  | Status          |
| ------ | ----------------- | -------------- | ------------- | --------------- |
| VPS-00 | Automation (n8n)  | 37.120.190.251 | 100.97.156.41 | Active          |
| VPS-01 | FiskAI Production | 152.53.146.3   | 100.82.87.83  | Active          |
| VPS-02 | COMPROMISED       | -              | -             | Pending reimage |

---

_Last updated: 2026-01-14_
