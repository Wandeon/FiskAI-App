# Redis Move: Go/No-Go Checklist

> **Date:** 2026-01-09
> **Updated:** 2026-01-09 (added Phase 1.5 portability checks)
> **Migration:** VPS-01 Redis → VPS Redis

---

## Phase 1.5: Portability Verification (MUST PASS FIRST)

| #   | Check                              | Command                              | Pass Criteria       | Status |
| --- | ---------------------------------- | ------------------------------------ | ------------------- | ------ |
| 1   | No worker uses bind mounts to /src | See command below                    | All "OK", no "FAIL" | ☐      |
| 2   | No module resolution errors        | See command below                    | 0 errors per worker | ☐      |
| 3   | All workers running                | `docker ps \| grep -c fiskai-worker` | 14+ containers      | ☐      |

### 1.5.1 Bind Mount Check Command

```bash
for w in $(docker ps --format '{{.Names}}' | grep fiskai-worker); do
  mounts=$(docker inspect "$w" --format '{{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}')
  if echo "$mounts" | grep -q "/src:"; then
    echo "FAIL: $w has source mount"
  else
    echo "OK: $w"
  fi
done
```

### 1.5.2 Module Error Check Command

```bash
for w in $(docker ps --format '{{.Names}}' | grep fiskai-worker); do
  errors=$(docker logs "$w" 2>&1 | grep -c -E "Cannot find module|ERR_MODULE_NOT_FOUND" || true)
  if [ "$errors" -gt 0 ]; then
    echo "FAIL: $w has $errors module errors"
  else
    echo "OK: $w"
  fi
done
```

**STOP if Phase 1.5 fails.** Fix worker images before proceeding.

---

## Pre-Flight (Before Starting Redis Move)

| #   | Check               | Command                                   | Expected                           | Status |
| --- | ------------------- | ----------------------------------------- | ---------------------------------- | ------ |
| 1   | PR #1384 merged     | `git log --oneline -1 origin/main`        | Contains worker portability commit | ☐      |
| 2   | Workers rebuilt     | `docker images \| grep fiskai-worker`     | Images dated after PR merge        | ☐      |
| 3   | VPS reachable       | `ping 100.120.14.126`                     | Response                           | ☐      |
| 4   | VPS-01 Redis stable | `docker exec fiskai-redis redis-cli ping` | PONG                               | ☐      |
| 5   | Queue depth noted   | `npx tsx scripts/queue-status.ts`         | Record current depths              | ☐      |
| 6   | Phase 1.5 passed    | All checks above                          | ☐ Complete                         | ☐      |

**GO Decision:** All 6 checks pass → Proceed to Redis Move

---

## During Cutover

| #   | Step                  | Verification                                                                                               | Status |
| --- | --------------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| 1   | VPS Redis started     | `docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a $PASS ping` → PONG                          | ☐      |
| 2   | Workers stopped       | `docker ps \| grep fiskai-worker` → no results                                                             | ☐      |
| 3   | REDIS_URL updated     | `.env` has new URL                                                                                         | ☐      |
| 4   | Workers restarted     | `docker ps \| grep fiskai-worker` → 14+ containers                                                         | ☐      |
| 5   | No connection errors  | `docker logs fiskai-worker-orchestrator 2>&1 \| grep -i ECONNREFUSED` → empty                              | ☐      |
| 6   | No module errors      | `docker logs fiskai-worker-orchestrator 2>&1 \| grep -i "Cannot find module"` → empty                      | ☐      |
| 7   | VPS Redis has clients | `docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a $PASS info clients` → connected_clients > 0 | ☐      |

---

## Post-Cutover Validation

| #   | Check                | Command                                                                                                     | Pass Criteria                  | Status |
| --- | -------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------ | ------ |
| 1   | Workers processing   | Check any worker log                                                                                        | Normal job processing messages | ☐      |
| 2   | No ECONNREFUSED      | `docker logs fiskai-worker-extractor 2>&1 \| grep -c ECONNREFUSED`                                          | Returns 0                      | ☐      |
| 3   | No module errors     | See 1.5.2 command above                                                                                     | All workers: 0 errors          | ☐      |
| 4   | Queue depths stable  | `npx tsx scripts/queue-status.ts`                                                                           | Not growing faster than before | ☐      |
| 5   | Memory stable        | `docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a $PASS info memory \| grep used_memory_human` | < 8GB                          | ☐      |
| 6   | No evictions         | `docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a $PASS info stats \| grep evicted_keys`       | evicted_keys:0 or very low     | ☐      |
| 7   | App redeploy success | Coolify shows green status                                                                                  | App responds on fiskai.hr      | ☐      |
| 8   | Cross-producers work | Trigger `/api/regulatory/trigger`                                                                           | Job appears in scheduled queue | ☐      |

---

## Rollback Triggers (Immediate Revert If)

- [ ] Workers fail to connect after 2 restart attempts
- [ ] Mass job failures (> 100 in 5 minutes)
- [ ] VPS Redis unreachable for > 30 seconds
- [ ] Memory usage > 7GB within first 10 minutes (approaching limit)
- [ ] Queue depths growing 10x faster than normal
- [ ] Any worker shows "Cannot find module" or "ERR_MODULE_NOT_FOUND" errors

---

## Final Sign-Off

| Milestone                  | Time          | Confirmed By     |
| -------------------------- | ------------- | ---------------- |
| Phase 1.5 complete         | **\_**:**\_** | ****\_\_\_\_**** |
| Pre-flight complete        | **\_**:**\_** | ****\_\_\_\_**** |
| Workers on VPS Redis       | **\_**:**\_** | ****\_\_\_\_**** |
| App on VPS Redis           | **\_**:**\_** | ****\_\_\_\_**** |
| 30-min stability confirmed | **\_**:**\_** | ****\_\_\_\_**** |

**Migration Complete:** ☐ Yes ☐ No (Rolled Back)

---

## Quick Reference

```bash
# VPS Redis connection (via ephemeral container)
docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a REDIS_PASSWORD_HERE

# Check for queue keys (non-blocking SCAN)
docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a REDIS_PASSWORD_HERE --scan --pattern "*scheduled*" | head

# Fail-fast module error check (all workers)
docker ps --format '{{.Names}}' | grep fiskai-worker | xargs -I{} sh -c \
  'docker logs {} 2>&1 | head -50 | grep -E "Cannot find module|ERR_MODULE_NOT_FOUND" && echo "^^^ FAIL: {}" || true'

# Rollback command
export REDIS_URL="redis://fiskai-redis:6379"
docker compose -f docker-compose.workers.yml down
docker compose -f docker-compose.workers.yml up -d
```
