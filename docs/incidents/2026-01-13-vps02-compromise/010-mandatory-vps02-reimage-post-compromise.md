# ADR-010: Mandatory VPS-02 Reimage Following Cryptominer Compromise

**Status:** APPROVED (Emergency)
**Date:** 2026-01-13
**Decision Makers:** Platform Owner
**Technical Lead:** Claude AI Agent (forensic analysis)

---

## Context

On 2026-01-13, during routine deployment operations, a cryptocurrency miner (xmrig) was discovered running on VPS-02 (152.53.179.101), a production server hosting FiskAI background workers.

### Incident Timeline

| Time (UTC)        | Event                                              |
| ----------------- | -------------------------------------------------- |
| 2026-01-11 23:26  | Miner first appears in kernel OOM logs             |
| 2026-01-13 ~21:30 | Miner discovered during deployment troubleshooting |
| 2026-01-13 21:35  | Miner process killed (PID 1278657)                 |
| 2026-01-13 22:10  | Forensic inventory completed                       |

### Compromise Details

- **Malware:** xmrig-x86_64-static (Monero miner)
- **Running as:** UID 101 (maps to `sshd` user on host)
- **Duration:** ~46 hours
- **CPU consumed:** 37,578 minutes
- **Mining pool:** 155.133.23.62:5556
- **Wallet:** 46coPowBordCDhh6BD7LbvCm2PcM3Pd9vEYBmCDRdkNvdE6VeUmZb76Yt9W538GxkSaoYGkeQGeuVHJH19awowc3CavE1kL

### Potential Attack Vectors (Not Definitively Determined)

1. **Privileged Docker containers** - Two BuildKit containers running with `--privileged` flag, enabling potential container escape
2. **Publicly exposed Netdata** - Monitoring dashboard on 0.0.0.0:19999 with historical RCE vulnerabilities
3. **Publicly exposed Glances** - System monitor on 0.0.0.0:61208

---

## Decision

**VPS-02 must be completely reimaged from a clean Debian 12 installation.**

This is NOT optional. In-place remediation is explicitly rejected.

---

## Rationale

### Why Reimage Is Mandatory

1. **Intrusion vector unknown**
   - Without knowing how the attacker gained access, we cannot verify they don't have persistent access
   - Rootkits, kernel modifications, or firmware-level persistence cannot be ruled out

2. **UID 101 execution is anomalous**
   - The miner ran as UID 101 (sshd user), which should not execute arbitrary code
   - This suggests either container escape or privilege escalation
   - The attack path may have modified system binaries

3. **Privileged containers were present**
   - `buildx_buildkit_amd64-builder0` and `buildx_buildkit_multiarch0` ran with `privileged: true`
   - Privileged containers can escape to the host with full root access
   - Any code that ran in those containers could have compromised the host

4. **No audit trail**
   - `auditd` was not enabled, so we have no record of what commands the attacker ran
   - We cannot determine what files were modified, what secrets were accessed, or what backdoors were installed

5. **Secrets must be assumed compromised**
   - All .env files, SSH keys, API tokens, and database credentials on VPS-02 are potentially exfiltrated
   - The attacker had ~46 hours of access to read any file on the system

6. **Fintech compliance requirements**
   - A financial services platform cannot operate on infrastructure with unknown compromise status
   - Regulatory and customer trust requirements demand verifiable clean state

### Why In-Place Cleaning Is Rejected

| Approach                     | Risk                                    | Verdict      |
| ---------------------------- | --------------------------------------- | ------------ |
| Kill process + delete binary | Persistence mechanisms may remain       | REJECTED     |
| Antivirus scan               | May miss custom malware/rootkits        | REJECTED     |
| Restore from backup          | Backup may be post-compromise           | REJECTED     |
| Manual file audit            | Cannot verify kernel/firmware integrity | REJECTED     |
| **Fresh OS install**         | **Guarantees clean state**              | **APPROVED** |

---

## Consequences

### Positive

- Guaranteed elimination of any persistent threats
- Opportunity to implement hardened security posture
- All secrets rotated, reducing exposure from any leak
- Documentation of secure baseline configuration
- Audit logging enabled from day one

### Negative

- 2-3 hours of downtime for worker services
- All services must be manually reconstructed
- Database exports must be scanned before restore
- CI/CD pipeline temporarily unavailable

### Risks Mitigated

- No more privileged containers
- Monitoring services bound to Tailscale only
- Process execution now audited
- Firewall rules explicitly defined

---

## Security Requirements (Post-Rebuild)

### MUST Have

1. Fresh Debian 12 from official ISO (not upgrade)
2. SSH key-only authentication, no root login
3. UFW firewall allowing only 22, 80, 443 + Tailscale
4. `auditd` enabled for process execution logging
5. All internal services bound to Tailscale IP only
6. No privileged Docker containers
7. All secrets rotated and stored in password manager
8. External port scan verification

### MUST NOT Have

1. Any data or binaries from compromised system (except scanned DB dumps)
2. Docker images from local cache (pull fresh from registry)
3. Monitoring services on 0.0.0.0
4. Containers with `--privileged`, `--network=host`, or Docker socket mounts
5. Secrets from compromised system without rotation

### SHOULD Have

1. Alerting for processes executed from /tmp
2. Weekly automated security scans
3. Container image vulnerability scanning
4. Centralized log aggregation
5. Incident response runbook

---

## Implementation Checklist

See: `docs/plans/2026-01-13-vps-02-zero-trust-rebuild.md`

### Phase 0: Data Export (Compromised System)

- [ ] Export PostgreSQL dumps (Supabase, n8n, Nextcloud)
- [ ] Transfer to secure location
- [ ] Scan for malware
- [ ] Verify SQL integrity

### Phase 1: Fresh OS

- [ ] Reimage via Hetzner console
- [ ] Create admin user with SSH key
- [ ] Harden SSH configuration
- [ ] Configure UFW firewall
- [ ] Install and authenticate Tailscale
- [ ] Enable auditd

### Phase 2: Docker

- [ ] Install from official repository
- [ ] Configure daemon security options
- [ ] Authenticate to GHCR with NEW token

### Phase 3: Services

- [ ] Deploy Caddy
- [ ] Deploy Netdata (Tailscale-bound)
- [ ] Deploy Redis (Tailscale-bound)
- [ ] Deploy FiskAI workers
- [ ] Install GitHub Actions runner

### Phase 4: Secrets

- [ ] Rotate all listed secrets
- [ ] Update Coolify environment
- [ ] Update VPS-01 database password
- [ ] Verify worker database connectivity

### Phase 5: Validation

- [ ] External port scan (only 22, 80, 443 visible)
- [ ] Internal service verification
- [ ] Worker health check
- [ ] Audit log verification

---

## Secrets Requiring Rotation

| Secret                | Rotation Method                      | Owner  |
| --------------------- | ------------------------------------ | ------ |
| GHCR_TOKEN            | GitHub PAT regeneration              | DevOps |
| COOLIFY_API_TOKEN     | Coolify dashboard                    | DevOps |
| REDIS_PASSWORD        | Generate new, update all consumers   | DevOps |
| DATABASE_URL password | PostgreSQL ALTER USER                | DBA    |
| OLLAMA_API_KEY        | Ollama dashboard                     | DevOps |
| NEXTAUTH_SECRET       | Generate new 32-byte                 | DevOps |
| SSH keys (admin)      | ssh-keygen new keypair               | DevOps |
| Supabase JWT_SECRET   | Supabase config                      | DevOps |
| n8n ENCRYPTION_KEY    | Generate new, re-encrypt credentials | DevOps |

---

## Post-Incident Actions

### Immediate (This Week)

1. Complete VPS-02 rebuild
2. Rotate all secrets
3. Verify production functionality
4. Document incident in security log

### Short-Term (This Month)

1. Implement alerting for /tmp executions
2. Review all other VPS configurations
3. Remove privileged containers from VPS-01 if present
4. Security awareness briefing

### Long-Term (This Quarter)

1. External penetration test
2. Evaluate SOC 2 compliance path
3. Implement secrets management solution (Vault/Doppler)
4. Container image signing and verification

---

## References

- Forensic Inventory: `/home/admin/VPS_FORENSIC_RECOVERY_INVENTORY.md`
- Rebuild Plan: `docs/plans/2026-01-13-vps-02-zero-trust-rebuild.md`
- Topology Design: `docs/plans/2026-01-13-clean-production-topology.md`
- [NIST SP 800-61: Computer Security Incident Handling Guide](https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final)
- [CIS Debian Linux Benchmark](https://www.cisecurity.org/benchmark/debian_linux)

---

## Approval

This ADR is approved under emergency authority due to active security incident.

**Decision:** APPROVED - Mandatory reimage required
**Effective:** Immediately
**Review Date:** 2026-01-20 (post-rebuild verification)
