# Device Security Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Identify local security vulnerabilities and risky configuration on this device with read-only checks.

**Architecture:** Collect baseline system info, map exposure (services/ports), review privileged access and SSH settings, assess patch status, scan for risky permissions, then summarize findings and remediation.

**Tech Stack:** bash, coreutils, systemctl/journalctl, ss, ufw/nft/iptables, apt/dnf (as available), optional lynis

---

## Task 1: Baseline system inventory

**Files:** None (read-only commands).

**Step 1: Record OS release**

Run: `cat /etc/os-release`
Expected: ID, VERSION_ID, PRETTY_NAME present.

**Step 2: Record kernel and arch**

Run: `uname -a`
Expected: Linux kernel version string.

**Step 3: Record uptime and time**

Run: `uptime` and `date -Is`
Expected: Uptime, load, ISO timestamp.

---

## Task 2: Accounts and privileges

**Files:** None (read-only commands).

**Step 1: List login-capable users**

Run: `getent passwd | awk -F: '$7 ~ /(bash|zsh|fish|sh)$/ {print $1":"$3":"$7}'`
Expected: Username, UID, shell for login-capable accounts.

**Step 2: Identify admin groups**

Run: `getent group | rg -n '(sudo|wheel|adm)'`
Expected: Group entries for privileged roles.

**Step 3: Check sudo policy**

Run: `sudo -n -l`
Expected: Succeeds with allowed commands, or fails with "a password is required".

---

## Task 3: Network exposure and firewall

**Files:** None (read-only commands).

**Step 1: List listening ports**

Run: `ss -tulpn`
Expected: LISTEN sockets with ports and process names (may require sudo for full details).

**Step 2: Check firewall status (ufw)**

Run: `command -v ufw >/dev/null && sudo -n ufw status verbose || true`
Expected: UFW status and rules if installed.

**Step 3: Check firewall status (nft/iptables)**

Run: `command -v nft >/dev/null && sudo -n nft list ruleset || sudo -n iptables -S`
Expected: Ruleset output or permission error if sudo required.

---

## Task 4: Running services and SSH config

**Files:** None (read-only commands).

**Step 1: List running services**

Run: `systemctl list-units --type=service --state=running`
Expected: Active services list.

**Step 2: Inspect SSHD config**

Run: `rg -n '^(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|ChallengeResponseAuthentication|KbdInteractiveAuthentication)' /etc/ssh/sshd_config`
Expected: SSH auth-related settings.

**Step 3: Effective SSHD settings**

Run: `sshd -T | rg -n 'permitrootlogin|passwordauthentication|pubkeyauthentication'`
Expected: Effective config values (may require sudo depending on system).

---

## Task 5: Patch status and packages

**Files:** None (read-only commands).

**Step 1: Detect package manager**

Run: `command -v apt >/dev/null && echo apt || command -v dnf >/dev/null && echo dnf || command -v yum >/dev/null && echo yum || echo unknown`
Expected: Package manager name.

**Step 2: List upgradable packages (if apt)**

Run: `apt list --upgradable 2>/dev/null | head -50`
Expected: Upgradable packages list (may be stale without `apt update`).

**Step 3: List updates (if dnf/yum)**

Run: `dnf check-update || yum check-update`
Expected: Available updates list (may require network for refresh).

---

## Task 6: Risky file permissions

**Files:** None (read-only commands).

**Step 1: World-writable files in key paths**

Run: `sudo -n find /etc /usr/local /home -xdev -type f -perm -0002 -print`
Expected: Any world-writable files (empty is ideal).

**Step 2: SUID/SGID binaries**

Run: `sudo -n find / -xdev -type f \( -perm -4000 -o -perm -2000 \) -print`
Expected: List of SUID/SGID binaries (review for unexpected entries).

---

## Task 7: Auth and security logs

**Files:** None (read-only commands).

**Step 1: Recent SSH auth failures**

Run: `sudo -n journalctl _SYSTEMD_UNIT=sshd.service --since "7 days ago" | rg -n "Failed|Invalid" | tail -100`
Expected: Recent failed/invalid login attempts.

**Step 2: Auth log (if present)**

Run: `sudo -n tail -200 /var/log/auth.log 2>/dev/null || true`
Expected: Last 200 auth log lines (Debian/Ubuntu).

---

## Task 8: Optional vulnerability scanner

**Files:** None (read-only commands).

**Step 1: Check for lynis**

Run: `command -v lynis >/dev/null && lynis audit system || echo "lynis not installed"`
Expected: Lynis audit output or not installed message.

**Step 2: Decide on installing scanners**

If missing and user approves network access, install and run (lynis or trivy).

---

## Task 9: Findings report

**Files:** Create: `security-audit-report.md`

**Step 1: Summarize findings and severity**

Include: exposure summary, outdated packages, risky configs, recommended fixes.

**Step 2: Provide remediation checklist**

Concrete actions with commands and config changes.
