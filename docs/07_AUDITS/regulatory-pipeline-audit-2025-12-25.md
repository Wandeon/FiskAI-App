# Regulatory Truth Pipeline - Comprehensive Audit Report

**Date:** 2025-12-25
**Auditor:** Claude Opus 4.5
**Scope:** Full system review of the Regulatory Truth Layer pipeline

---

## Executive Summary

The FiskAI Regulatory Truth Layer is a **well-architected, production-grade system** for extracting, validating, and publishing Croatian regulatory compliance rules from authoritative sources. The two-layer architecture (Layer A: Daily Discovery, Layer B: Continuous Processing) provides robust handling of regulatory content with strong audit trail guarantees.

### Overall Rating: **B+ (Good with Minor Issues)**

| Category | Rating | Notes |
|----------|--------|-------|
| Architecture | A | Excellent separation of concerns, proper staged pipeline |
| Data Integrity | A | Immutable evidence, SHA-256 hashing, audit logs |
| Error Handling | A- | Comprehensive fail-safe mechanisms, dead-letter queues |
| Security | B+ | Good practices, minor improvements needed |
| Code Quality | B+ | Clean, well-documented, some inconsistencies |
| Operational Readiness | B | Missing some observability features |
| Documentation | B | Good inline docs, could use more runbooks |

---

## 1. Architecture Review

### Strengths

1. **Two-Layer Model** - Clean separation between discovery (Layer A) and processing (Layer B)
2. **Stage-Based Pipeline** - 7 distinct stages with clear responsibilities:
   - Sentinel → OCR → Extractor → Composer → Reviewer → Arbiter → Releaser
3. **Immutability Guarantee** - `Evidence.rawContent` is never modified (legal defensibility)
4. **Continuous Drainer** - 24/7 processing with intelligent backoff (1s-60s)
5. **Rate Limiting** - Per-domain delays respect source server bandwidth

### Concerns

1. **Knowledge Graph Building** - Synchronous in releaser (`releaser.worker.ts`), could block on large releases
2. **Redis Single Point of Failure** - No Redis Sentinel/Cluster configuration for HA
3. **Database Password in Docker Compose** - `docker-compose.workers.yml:251` has hardcoded credentials:
   ```yaml
   DATABASE_URL=postgresql://fiskai:fiskai_secret_2025@fiskai-db:5432/fiskai
   ```

---

## 2. Data Integrity Analysis

### Strengths

1. **Content Hashing** - SHA-256 for Evidence, EvidenceArtifact, and RuleRelease
2. **Audit Log System** - Every state change tracked in `RegulatoryAuditLog`
3. **No-Inference Validation** - `validateValueInQuote()` prevents LLM hallucination
4. **Source Pointer Chain** - Every published rule traces back to evidence

### Verified Invariants

| Invariant | Status | Verification |
|-----------|--------|--------------|
| Published rules have ≥1 source pointer | ✅ Enforced | `health-gates.ts:228-259` |
| T0/T1 rules require human approval | ✅ Enforced | `health-gates.ts:189-222` |
| Evidence.rawContent immutable | ✅ Design | No UPDATE operations exist |
| Quotes must appear in source | ✅ Validated | `deterministic-validators.ts:287-363` |

### Potential Data Issues

1. **AppliesWhen DSL Silent Fallback** - Invalid DSL replaced with `{op: "true"}` without blocking:
   ```typescript
   // composer.ts:161-168
   appliesWhenObj = { op: "true" }
   draftRule.composer_notes = `${...}\n[AUTO-FIX] Original appliesWhen was invalid`
   ```
   **Risk:** Rules may apply more broadly than intended

2. **LLM Hallucinated Source Pointer IDs** - Composer explicitly guards against this (good!):
   ```typescript
   // composer.ts:180-182
   // IMPORTANT: Use the actual input source pointer IDs, not the LLM output
   const validSourcePointerIds = sourcePointerIds
   ```

---

## 3. Security Analysis

### Positive Findings

1. **ReDoS Protection** - `applies-when.ts:5-31` limits regex length and times execution
2. **No SQL Injection** - Prisma ORM with parameterized queries throughout
3. **Rate Limiting** - BullMQ queue limiters prevent resource exhaustion
4. **LLM Bottleneck** - `rate-limiter.ts` uses Bottleneck for 5 concurrent LLM calls max

### Security Concerns

| Issue | Severity | Location | Recommendation |
|-------|----------|----------|----------------|
| Hardcoded DB password | Medium | `docker-compose.workers.yml:251` | Use environment variable |
| No TLS for Redis | Low | Internal network | Add TLS if multi-node |
| Audit log failures silently swallowed | Low | `audit-log.ts:42-45` | Add monitoring/alerting |
| No input sanitization on URLs | Low | `sentinel.ts` | Validate URL format |

### Hardcoded Credentials Issue

```yaml
# docker-compose.workers.yml:251 - Should use ${DATABASE_URL} like other workers
- DATABASE_URL=postgresql://fiskai:fiskai_secret_2025@fiskai-db:5432/fiskai
```

**Fix:** Replace with `- DATABASE_URL=${DATABASE_URL}` to match other worker services.

---

## 4. Code Quality & Consistency

### Positive Patterns

1. **Consistent Worker Structure** - All workers use `createWorker()` base with unified error handling
2. **Type Safety** - Zod schemas for all agent inputs/outputs
3. **Soft-Fail Pattern** - `withSoftFail()` prevents single failures from blocking batches
4. **Clean Imports** - Barrel exports via `index.ts` files

### Inconsistencies Found

| Issue | Files | Impact |
|-------|-------|--------|
| Mixed agentType in DB vs schema | `AgentRun.agentType` uses `RELEASER`, schema has `releaser` | Low |
| STATUS enum in schema vs string in code | Some places use enum, others string literals | Low |
| Error message format varies | Some use `[worker]`, some don't prefix | Low |

### Missing Error Handling

1. **Arbiter Worker** - No queuing of approved rules after conflict resolution:
   ```typescript
   // arbiter.worker.ts:26-29 - Returns result but doesn't queue review/release
   return {
     success: result.success,
     duration,
     data: { resolution: result.resolution },
   }
   ```

2. **Continuous Drainer** - Stage errors logged but no alerting:
   ```typescript
   // continuous-drainer.worker.ts:293
   console.error("[drainer] Stage 1 error:", error)
   // Should trigger monitoring alert
   ```

---

## 5. Queue System Review

### Configuration Analysis

| Queue | Rate Limit | Concurrency | Assessment |
|-------|-----------|-------------|------------|
| sentinel | 5/min | 1 | Appropriate for HTTP |
| extract | 10/min | 2 | Good - LLM bound |
| ocr | 2/min | 1 | CPU intensive, correct |
| compose | 5/min | 1 | LLM bound |
| review | 5/min | 1 | Appropriate |
| arbiter | 3/min | 1 | Complex reasoning |
| release | 2/min | 1 | Conservative, good |

### Queue Health Checks

**Good:** `queue-status.ts` script provides visibility into:
- Queue depths (waiting, active, completed, failed, delayed)
- Database entity counts by status
- Backlog vs published rules

**Missing:**
- No automated alerting on queue depth thresholds
- No dead-letter queue cleanup mechanism
- No metric export to Prometheus/Grafana

---

## 6. Health Gates Analysis

The `health-gates.ts` system provides 8 automated checks:

| Gate | Threshold | Purpose |
|------|-----------|---------|
| extractor_parse_failure_rate | 10% critical | LLM output quality |
| validator_rejection_rate | 35% critical | Data quality |
| quote_validation_rate | 5% critical | Hallucination detection |
| t0_t1_approval_compliance | 0 tolerance | Human oversight |
| source_pointer_coverage_published | 0 tolerance | Audit trail |
| source_pointer_coverage_draft | 5% critical | Pipeline quality |
| conflict_resolution_rate | 50% critical | Conflict backlog |
| release_blocked_attempts | Informational | Gate verification |

**Assessment:** Comprehensive and well-designed. Thresholds are reasonable.

---

## 7. Test Coverage Analysis

### Test Files Found

| Test | Purpose | Coverage |
|------|---------|----------|
| `arbiter.test.ts` | Unit tests | Basic |
| `arbiter-e2e.test.ts` | Integration | Good |
| `conflict-detector.test.ts` | Unit | Comprehensive |
| `deterministic-validators.test.ts` | Unit | Comprehensive |
| `health-gates-invariants.test.ts` | Integration | Good |
| `sentinel.test.ts` | Unit | Basic |

**Missing Coverage:**
- No tests for `continuous-drainer.worker.ts`
- No tests for `composer.ts` edge cases (conflict creation path)
- No load/performance tests

---

## 8. Operational Readiness

### Deployment

**Good:**
- Docker Compose with health checks
- Redis persistence enabled (`--appendonly yes`)
- Graceful shutdown handlers in all workers

**Concerns:**
- No Kubernetes manifests for scaling
- No backup/restore procedures documented
- No runbook for common operational issues

### Monitoring

**Present:**
- Prometheus metrics in `metrics.ts`
- Console logging throughout
- Queue status script

**Missing:**
- Grafana dashboards
- PagerDuty/Slack alerting integration
- Distributed tracing (OpenTelemetry)

---

## 9. Identified Inconsistencies

### 1. Worker Startup Order

The `worker-scheduler` (`scheduler.service.ts`) doesn't depend on `worker-sentinel`, but triggers sentinel jobs. If scheduler starts first and queues jobs, sentinel may not be ready.

### 2. AgentType Enum Mismatch

```prisma
// schema.prisma:1578-1585
enum AgentType {
  SENTINEL
  EXTRACTOR
  COMPOSER
  REVIEWER
  RELEASER  // uppercase
  ARBITER
}
```

But in code sometimes lowercase is used in error messages and logs.

### 3. Conflict Type Handling

`SOURCE_CONFLICT` has `itemAId` and `itemBId` as null (correct - they reference Rules, not SourcePointers), but this isn't clearly documented in the schema.

### 4. Evidence Content Class

Schema has:
```prisma
contentClass String @default("HTML") // HTML, PDF_TEXT, PDF_SCANNED, DOC, XLSX, JSON
```

But code only handles: HTML, PDF_TEXT, PDF_SCANNED, JSON. DOC and XLSX are not implemented.

---

## 10. Recommendations

### Critical (Fix Immediately)

1. **Remove hardcoded password** in `docker-compose.workers.yml:251`
2. **Add alerting** for health gate failures beyond logging

### High Priority

3. **Make knowledge graph building async** in releaser to prevent blocking
4. **Add tests** for continuous-drainer and composer conflict paths
5. **Document** the SOURCE_CONFLICT FK behavior in schema comments

### Medium Priority

6. **Implement** DOC/XLSX content class handlers or remove from schema
7. **Add** dead-letter queue cleanup mechanism (archive after 30 days)
8. **Create** Grafana dashboards for pipeline monitoring
9. **Add** distributed tracing for cross-worker request correlation

### Low Priority

10. **Standardize** error message formats across workers
11. **Add** Kubernetes deployment manifests
12. **Create** operational runbooks for common issues

---

## 11. Summary Scorecard

| Aspect | Score | Justification |
|--------|-------|---------------|
| **Correctness** | 9/10 | Solid invariant enforcement, minor edge cases |
| **Reliability** | 8/10 | Good error handling, needs alerting |
| **Security** | 8/10 | Good practices, hardcoded creds issue |
| **Maintainability** | 8/10 | Clean code, good structure |
| **Observability** | 7/10 | Logging good, metrics need dashboards |
| **Scalability** | 7/10 | Horizontal scaling ready, Redis SPOF |
| **Documentation** | 7/10 | Inline docs good, runbooks needed |

**Overall: 7.7/10 (B+)**

---

## 12. Conclusion

The Regulatory Truth Pipeline is a **well-designed, production-ready system** that demonstrates strong software engineering practices. The two-layer architecture, immutability guarantees, and comprehensive health gates provide a solid foundation for regulatory compliance processing.

The main areas for improvement are:
1. **Operational tooling** (alerting, dashboards)
2. **Security hygiene** (remove hardcoded credentials)
3. **Test coverage** (continuous drainer, edge cases)

The system is suitable for production use with the recommended critical fixes applied.

---

*This audit was conducted through static code analysis. Runtime behavior and performance characteristics were not directly tested.*
