# Ollama Connectivity and Failure Analysis

> Audit Date: 2026-01-12
> Context: PR-A (AgentRun Outcome Taxonomy) merged, workers deployed with Redis fix
> Status: **Ollama Cloud weekly quota exhausted - all live calls expected to fail**

## Executive Summary

The Ollama-powered agent pipeline is currently failing with `401 Unauthorized` errors. This is **NOT quota exhaustion** as initially suspected, but rather **missing API credentials** in the worker container environment.

**Root Cause:** The `worker-extractor` container has no `OLLAMA_*` environment variables configured, causing it to use default endpoints (`https://ollama.com`) without authentication.

**PR-B Impact:** Safe to proceed. The caching layer should NOT cache failure outcomes. Current failures are infrastructure configuration issues, not LLM quality problems.

---

## 1. Ollama Configuration Inventory

### Environment Variables (from ollama-config.ts)

| Variable                  | Fallback          | Default              | Purpose            |
| ------------------------- | ----------------- | -------------------- | ------------------ |
| `OLLAMA_EXTRACT_ENDPOINT` | `OLLAMA_ENDPOINT` | `https://ollama.com` | Extraction API URL |
| `OLLAMA_EXTRACT_MODEL`    | `OLLAMA_MODEL`    | `llama3.1`           | Extraction model   |
| `OLLAMA_EXTRACT_API_KEY`  | `OLLAMA_API_KEY`  | (none)               | Bearer token auth  |
| `OLLAMA_EMBED_ENDPOINT`   | `OLLAMA_ENDPOINT` | `https://ollama.com` | Embedding API URL  |
| `OLLAMA_EMBED_MODEL`      | `OLLAMA_MODEL`    | `nomic-embed-text`   | Embedding model    |
| `OLLAMA_EMBED_API_KEY`    | `OLLAMA_API_KEY`  | (none)               | Bearer token auth  |

### Authentication Logic (ollama-config.ts:26-33)

```typescript
export function getOllamaExtractHeaders(): HeadersInit {
  const apiKey = process.env.OLLAMA_EXTRACT_API_KEY || process.env.OLLAMA_API_KEY
  const headers: HeadersInit = { "Content-Type": "application/json" }
  if (apiKey && apiKey !== "local") {
    headers["Authorization"] = `Bearer ${apiKey}`
  }
  return headers
}
```

**Note:** If `apiKey` is unset or equals `"local"`, no Authorization header is sent.

### Current Container State

```
$ docker exec fiskai-worker-extractor env | grep -i ollama
(empty - no OLLAMA_* variables configured)
```

**Consequence:** Worker uses defaults:

- Endpoint: `https://ollama.com`
- Model: `llama3.1`
- Auth: None (no Bearer token)

---

## 2. Failure Mode Classification

### Error → Outcome Mapping (runner.ts)

| HTTP/Error             | Outcome               | Status    | Cacheable? |
| ---------------------- | --------------------- | --------- | ---------- |
| Timeout (AbortError)   | `TIMEOUT`             | FAILED    | No         |
| 401/403 Unauthorized   | `RETRY_EXHAUSTED`\*   | FAILED    | No         |
| 429 Rate Limited       | `RETRY_EXHAUSTED`\*   | FAILED    | No         |
| Network failure        | `RETRY_EXHAUSTED`\*   | FAILED    | No         |
| Invalid input          | `PARSE_FAILED`        | FAILED    | No         |
| No JSON in response    | `PARSE_FAILED`        | FAILED    | No         |
| Schema validation fail | `VALIDATION_REJECTED` | COMPLETED | No         |
| Empty extractions      | `EMPTY_OUTPUT`        | COMPLETED | Maybe      |
| Low confidence (<0.5)  | `LOW_CONFIDENCE`      | COMPLETED | No         |
| Success with items     | `SUCCESS_APPLIED`     | COMPLETED | Yes        |
| Success, no items      | `SUCCESS_NO_CHANGE`   | COMPLETED | Yes        |

\*Note: 401/403/429/network errors all result in `RETRY_EXHAUSTED` after 3 attempts.

### Observed Errors (last 2 hours before quota note)

```
error: "Ollama API error: 401 Unauthorized"
outcome: RETRY_EXHAUSTED
count: 17 runs
```

**Analysis:** All failures are auth errors, not quota limits (429). The API key is either missing or invalid.

---

## 3. Retry and Timeout Behavior

### Retry Configuration (runner.ts:217)

| Parameter        | Value                       | Notes                          |
| ---------------- | --------------------------- | ------------------------------ |
| `maxRetries`     | 3                           | Default, configurable per-call |
| Base delay       | 1000ms                      | Exponential backoff            |
| Rate-limit delay | 30000ms                     | For 429 responses              |
| Backoff formula  | `2^(attempt-1) * baseDelay` | 1s, 2s, 4s                     |

### Timeout Configuration (runner.ts:29-46)

| Agent Type | Timeout | Rationale            |
| ---------- | ------- | -------------------- |
| SENTINEL   | 30s     | Fast HTTP fetches    |
| OCR        | 10min   | Large PDF processing |
| EXTRACTOR  | 2min    | LLM extraction       |
| COMPOSER   | 3min    | Complex reasoning    |
| REVIEWER   | 1min    | Fast validation      |
| ARBITER    | 2min    | Conflict resolution  |
| RELEASER   | 1min    | Publication          |
| Default    | 5min    | Fallback             |

Timeout can be overridden via:

- `{AGENT_TYPE}_TIMEOUT_MS` env var (e.g., `EXTRACTOR_TIMEOUT_MS=180000`)
- `AGENT_TIMEOUT_MS` global env var

---

## 4. AgentRun Data Quality Assessment

### Correlation Field Population (post-PR-A merge)

| Metric             | Value     | Notes                      |
| ------------------ | --------- | -------------------------- |
| Runs in last 30min | 15        | After worker redeploy      |
| Has outcome        | 15 (100%) | All runs have outcome set  |
| Has runId          | 15 (100%) | BullMQ correlation working |
| Has queueName      | 15 (100%) | Queue tracking working     |
| Has sourceSlug     | 15 (100%) | Evidence source tracked    |

**Verdict:** PR-A taxonomy is functioning correctly. All new runs have full correlation fields populated.

### Historical Data Issues

| Issue                    | Count    | Impact                                   |
| ------------------------ | -------- | ---------------------------------------- |
| Stuck RUNNING jobs       | ~20      | Created before PR-A, no timeout recovery |
| Null outcomes (pre-PR-A) | ~604,000 | Expected, not backfilled                 |

**Note:** Stuck RUNNING jobs are from before the outcome taxonomy was added. These lack `runId` and will need manual cleanup or timeout-based recovery in a future PR.

---

## 5. PR-B Readiness Assessment

### PR-B Scope (Cache Layer)

PR-B implements `InputContentCache` to skip LLM calls when identical input has been processed before. Key behaviors:

1. **Cache key:** `inputContentHash` (SHA-256 of JSON-serialized input)
2. **Cache hit criteria:** Same hash + outcome in `[SUCCESS_APPLIED, SUCCESS_NO_CHANGE]`
3. **Cache miss:** All failure outcomes are NOT cached

### Risk Analysis

| Risk                    | Severity | Mitigation                                  |
| ----------------------- | -------- | ------------------------------------------- |
| Caching failures        | N/A      | Design excludes failure outcomes from cache |
| Stale cache             | Low      | Cache TTL + manual invalidation             |
| Hash collisions         | Very Low | SHA-256 collision-resistant                 |
| Config errors persisted | N/A      | Only success outcomes cached                |

**Current State Impact:** Since all runs are `RETRY_EXHAUSTED`, PR-B cache will:

- NOT cache any current failures
- NOT affect retry behavior
- NOT mask the underlying auth issue

### Pre-PR-B Requirements Checklist

- [x] PR-A merged (AgentRun outcome taxonomy)
- [x] Workers deployed with PR-A code
- [x] Redis connection working (PR #1416 merged)
- [x] Correlation fields populating correctly
- [ ] **BLOCKER:** Ollama API credentials configured in worker container
- [ ] At least one `SUCCESS_APPLIED` run to validate cache

---

## 6. Recommendations

### Immediate Actions (P0)

1. **Configure Ollama credentials in worker container:**

   ```bash
   # In Coolify environment variables for worker-extractor:
   OLLAMA_EXTRACT_ENDPOINT=https://api.ollama.com  # or self-hosted
   OLLAMA_EXTRACT_API_KEY=<valid-api-key>
   ```

2. **Verify credentials work:**

   ```bash
   curl -H "Authorization: Bearer $OLLAMA_EXTRACT_API_KEY" \
        https://api.ollama.com/api/tags
   ```

3. **Redeploy worker with credentials:**
   ```bash
   docker compose -f docker-compose.workers.yml up -d worker-extractor
   ```

### Post-Credentials Verification

1. Wait for one successful extraction run
2. Verify outcome is `SUCCESS_APPLIED`
3. Check `itemsProduced > 0`
4. Then proceed with PR-B merge

### Deferred Actions (P2)

1. Clean up stuck RUNNING jobs (manual or automated recovery)
2. Consider adding auth health check at worker startup
3. Add Grafana alert for `RETRY_EXHAUSTED` spike

---

## Appendix: Key File References

| File                                               | Purpose                                       |
| -------------------------------------------------- | --------------------------------------------- |
| `src/lib/regulatory-truth/agents/ollama-config.ts` | Ollama endpoint/model/auth config             |
| `src/lib/regulatory-truth/agents/runner.ts`        | Agent runner with retry/timeout/outcome logic |
| `src/lib/regulatory-truth/workers/redis.ts`        | Redis connection (fixed in PR #1416)          |
| `.env.example`                                     | Environment variable documentation            |
