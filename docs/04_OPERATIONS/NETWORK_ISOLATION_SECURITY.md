# Network Isolation Security Guide

## Overview

This document describes the security requirements for `AUTH_TRUST_HOST=true` and provides verification procedures to ensure proper network isolation. When `AUTH_TRUST_HOST` is enabled, NextAuth.js trusts the `Host` header from incoming requests, which is safe **only** when the application container is not directly accessible from untrusted networks.

## Security Risk

If `AUTH_TRUST_HOST=true` is set and the application container is directly accessible (e.g., exposed port, misconfigured firewall), attackers can:

1. **Forge Host headers** to spoof callback URLs
2. **Poison authentication cookies** with malicious domains
3. **Perform open redirect attacks** via manipulated OAuth flows
4. **Achieve account takeover** through session hijacking

**Severity:** HIGH

## Required Architecture

The safe architecture requires that **only trusted reverse proxies** (Traefik, Nginx, Cloudflare) can reach the application container:

```
Internet --> Cloudflare --> Traefik --> fiskai-app (internal network only)
                                            |
                                      fiskai_internal network
                                            |
                                        fiskai-db
```

### Key Requirements

1. **No port mapping** on the app container (no `ports:` directive exposing to host)
2. **Internal-only network** for app-to-database communication
3. **Traefik/proxy network** for reverse proxy access only
4. **Host header validation** at the proxy level (Traefik routing rules)

## Production Configuration

The production setup in `docker-compose.prod.yml` implements these requirements:

```yaml
fiskai-app:
  networks:
    - fiskai_internal  # Database access (internal only)
    - coolify          # Traefik access (external network)
  # NO ports: directive - container not directly accessible
  labels:
    - "traefik.http.routers.fiskai.rule=Host(`${APP_DOMAIN:-erp.metrica.hr}`)"
```

### Why This Is Safe

1. **No host port binding:** The container has no `ports:` mapping, so it cannot be reached via `http://server-ip:3000`
2. **Network isolation:** `fiskai_internal` is a bridge network only accessible to other containers in that network
3. **Traefik routing:** Traefik validates the `Host` header via its routing rules before forwarding requests
4. **Cloudflare proxy:** Additional layer validates requests before they reach Traefik

## Verification Procedures

### 1. Verify No Direct Container Access

From outside the Docker network, attempt to reach the container directly:

```bash
# Should FAIL (connection refused or timeout)
curl -v -H "Host: evil.com" http://server-ip:3000

# Should also FAIL
curl -v http://server-ip:3000
```

**Expected result:** Connection refused or no route to host.

### 2. Verify Container Network Configuration

```bash
# Check container has no published ports
docker inspect fiskai-app --format '{{json .NetworkSettings.Ports}}'
# Expected: {} or ports with no HostPort bindings

# Check container networks
docker inspect fiskai-app --format '{{json .NetworkSettings.Networks}}'
# Expected: fiskai_internal and coolify (or proxy network)
```

### 3. Verify Traefik Validates Host Header

```bash
# Should succeed with correct Host
curl -v -H "Host: erp.metrica.hr" https://erp.metrica.hr

# Should FAIL at Traefik level (404 or connection reset)
curl -v -H "Host: evil.com" https://erp.metrica.hr
```

**Expected result:** Traefik returns 404 for unrecognized hosts.

### 4. Verify Firewall Rules

```bash
# List iptables rules for Docker
sudo iptables -L DOCKER-USER -n -v

# Verify no rules allow external access to port 3000
sudo ss -tlnp | grep 3000
# Expected: No listening on 0.0.0.0:3000 or :::3000
```

## Development Environment

In development (`docker-compose.dev.yml`), port exposure is acceptable because:

1. Development runs on localhost only
2. No sensitive data or real authentication
3. Developer needs direct access for debugging

However, **never deploy the dev compose file to production**.

## Alternative: Remove AUTH_TRUST_HOST

If network isolation cannot be guaranteed, consider removing `AUTH_TRUST_HOST` entirely and using explicit URL configuration:

```yaml
environment:
  - NEXTAUTH_URL=https://erp.metrica.hr
  # Remove AUTH_TRUST_HOST - NextAuth will use NEXTAUTH_URL exclusively
```

This is safer but requires redeployment when the domain changes.

## Monitoring

Add monitoring for network isolation violations:

1. **Log analysis:** Alert on requests with unexpected `Host` headers reaching the application
2. **Network monitoring:** Alert on any direct traffic to container ports
3. **Periodic audits:** Run verification script in CI/CD pipelines

## References

- [NextAuth.js Security Documentation](https://next-auth.js.org/configuration/options#nextauth_url)
- [Docker Network Security](https://docs.docker.com/network/network-tutorial-standalone/)
- [Traefik Security Headers](https://doc.traefik.io/traefik/middlewares/http/headers/)
- GitHub Issue: #847
