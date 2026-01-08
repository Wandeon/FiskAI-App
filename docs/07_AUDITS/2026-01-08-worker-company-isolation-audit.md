# Worker & Cron Job Company Isolation Audit

**Date:** 2026-01-08
**Auditor:** Claude (Opus 4.5)
**Scope:** Background workers, cron jobs, and queue processors
**Status:** COMPLETED - CRITICAL ISSUES FOUND

---

## Executive Summary

This audit examined all background workers, cron jobs, and queue processors for company isolation issues. The audit verified whether each job:
1. Carries explicit company context
2. Cannot execute cross-company operations by accident
3. Cannot process stale jobs after company switching

**Critical Finding:** 3 cron endpoints have **broken authentication** (checking for empty Bearer token).

---

## 🔴 CRITICAL ISSUES

### 1. Broken Cron Authentication (SEVERITY: CRITICAL)

Three cron endpoints have malformed authentication checks that accept any request:

| File | Line | Issue |
|------|------|-------|
| `src/app/api/cron/fiscal-processor/route.ts` | 15 | `if (authHeader !== \`Bearer \`)` - Empty token |
| `src/app/api/cron/fiscal-retry/route.ts` | 24 | `if (authHeader !== \`Bearer \`)` - Empty token |
| `src/app/api/cron/checklist-digest/route.ts` | 26 | `if (authHeader !== \`Bearer \`)` - Empty token |

**Impact:** These endpoints can be triggered by anyone with the URL, bypassing CRON_SECRET authentication.

**Root Cause:** Missing `${process.env.CRON_SECRET}` in template literal.

**Fix Required:**
```typescript
// BEFORE (broken):
if (authHeader !== `Bearer `) {

// AFTER (correct):
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
```

---

## 🟡 MEDIUM ISSUES

### 2. Outbox Events Lack Explicit Company Context (SEVERITY: MEDIUM)

**Location:** `src/lib/outbox/outbox-service.ts`, `prisma/schema.prisma:5516`

**Issue:** The `OutboxEvent` model has no `companyId` field. Company context must be embedded in the `payload` JSON, which is error-prone.

```prisma
model OutboxEvent {
  id          String            @id @default(cuid())
  eventType   String
  payload     Json              // <-- Company context buried here
  // ... no companyId field
}
```

**Current Event Types:**
- `article_job.started` - No company context needed (platform-level)
- `article_job.rewrite` - No company context needed (platform-level)
- `webhook.received` - Company context in payload
- `system_status.refresh` - No company context needed (platform-level)

**Risk:** Future event types that require company context may accidentally omit it from the payload, leading to cross-company execution.

**Recommendation:** Add optional `companyId` field to `OutboxEvent`:
```prisma
model OutboxEvent {
  id          String            @id @default(cuid())
  companyId   String?           // Optional company scope
  eventType   String
  payload     Json
  // ...
}
```

### 3. E-Invoice Poller Uses Environment Variable for Company ID (SEVERITY: MEDIUM)

**Location:** `src/lib/e-invoice/workers/eposlovanje-inbound-poller.worker.ts`

**Issue:** Company ID is passed via `COMPANY_ID` environment variable, requiring one worker container per company.

```typescript
const COMPANY_ID = process.env.COMPANY_ID
```

**Risks:**
1. **Scaling:** Cannot process multiple companies in a single worker
2. **Configuration Drift:** If `COMPANY_ID` env var is changed without restart, old company ID persists in memory
3. **Deployment Complexity:** Requires N worker containers for N companies

**Recommendation:** Migrate to queue-based job dispatching where company ID is in job data:
```typescript
interface EInvoicePollJob {
  companyId: string;
  integrationAccountId: string;
}
```

---

## 🟢 WELL-IMPLEMENTED PATTERNS

### Workers with Explicit Company Context

| Worker/Job | Location | Pattern | Assessment |
|------------|----------|---------|------------|
| **Backup Worker** | `src/lib/backup/backup.worker.ts` | `companyId` in job data | ✅ Correct |
| **Bank Sync Cron** | `src/app/api/cron/bank-sync/route.ts` | `companyId` from account record | ✅ Correct |
| **Recurring Expenses** | `src/app/api/cron/recurring-expenses/route.ts` | Iterates by company | ✅ Correct |
| **Deadline Reminders** | `src/app/api/cron/deadline-reminders/route.ts` | Iterates by company | ✅ Correct |
| **Email Sync** | `src/lib/email-sync/sync-service.ts` | `companyId` from connection | ✅ Correct |
| **Certificate Check** | `src/app/api/cron/certificate-check/route.ts` | `companyId` from certificate | ✅ Correct |
| **Checklist Digest** | `src/app/api/cron/checklist-digest/route.ts` | Per user/company pair | ✅ Correct |
| **Fiscal Processor** | `src/app/api/cron/fiscal-processor/route.ts` | Row-level locking, via invoice | ✅ Correct |
| **Fiscal Retry** | `src/app/api/cron/fiscal-retry/route.ts` | `companyId` from request | ✅ Correct |

### Platform-Level Workers (No Company Context Needed)

| Worker | Location | Purpose | Assessment |
|--------|----------|---------|------------|
| **RTL Sentinel** | `src/lib/regulatory-truth/workers/sentinel.worker.ts` | Regulatory discovery | ✅ N/A |
| **RTL Extractor** | `src/lib/regulatory-truth/workers/extractor.worker.ts` | Fact extraction | ✅ N/A |
| **RTL Composer** | `src/lib/regulatory-truth/workers/composer.worker.ts` | Rule composition | ✅ N/A |
| **RTL Reviewer** | `src/lib/regulatory-truth/workers/reviewer.worker.ts` | Quality review | ✅ N/A |
| **RTL Arbiter** | `src/lib/regulatory-truth/workers/arbiter.worker.ts` | Conflict resolution | ✅ N/A |
| **RTL Releaser** | `src/lib/regulatory-truth/workers/releaser.worker.ts` | Rule publication | ✅ N/A |
| **Article Worker** | `src/lib/regulatory-truth/workers/article.worker.ts` | Content generation | ✅ N/A |
| **Embedding Worker** | `src/lib/regulatory-truth/workers/embedding.worker.ts` | Semantic embeddings | ✅ N/A |
| **Weekly Digest** | `src/app/api/cron/weekly-digest/route.ts` | Admin digest (no company) | ✅ N/A |

---

## Stale Job Processing Assessment

### Low Risk Scenarios

| Component | Stale Job Risk | Mitigation |
|-----------|---------------|------------|
| **Backup Worker** | Low | Uses repeatable jobs with company-specific naming; old schedules removed before new |
| **Fiscal Processor** | Low | Uses row-level locking with `lockedAt` timestamp; stale locks recovered after 5 min |
| **Email Sync** | Low | Per-connection Redis locking with 10-minute TTL |
| **Outbox Worker** | Low | Events processed by ID; stuck events reset after 30 min |

### Medium Risk Scenarios

| Component | Stale Job Risk | Issue |
|-----------|---------------|-------|
| **E-Invoice Poller** | Medium | Environment-based company ID could persist if process doesn't restart cleanly |
| **BullMQ Jobs** | Low-Medium | Jobs in queue may have outdated company state if company settings changed |

---

## Recommendations

### Immediate (Before Next Deploy)

1. **Fix broken cron auth in 3 files:**
   - `src/app/api/cron/fiscal-processor/route.ts:15`
   - `src/app/api/cron/fiscal-retry/route.ts:24`
   - `src/app/api/cron/checklist-digest/route.ts:26`

### Short-term (This Sprint)

2. **Add `companyId` field to OutboxEvent model** for explicit company scoping
3. **Add CI check** to verify all cron endpoints use proper CRON_SECRET authentication

### Medium-term (Next Sprint)

4. **Refactor E-Invoice Poller** to use queue-based dispatching instead of env-based company ID
5. **Add version/timestamp validation** to queue jobs to detect stale processing

---

## Audit Methodology

1. **Discovery Phase:**
   - Searched for all files with "worker" in name/path
   - Located Docker compose worker definitions
   - Found all cron API routes in `src/app/api/cron/`
   - Identified queue infrastructure (BullMQ + Redis)

2. **Analysis Phase:**
   - Read each worker/cron file
   - Traced company context propagation
   - Checked authentication patterns
   - Verified job data structure

3. **Validation Phase:**
   - Grepped for auth patterns across all cron files
   - Verified 17 files have correct auth, 3 have broken auth
   - Cross-referenced with Prisma schema for data models

---

## File Inventory

### Background Workers (15 total)
- `src/lib/regulatory-truth/workers/orchestrator.worker.ts`
- `src/lib/regulatory-truth/workers/sentinel.worker.ts`
- `src/lib/regulatory-truth/workers/extractor.worker.ts`
- `src/lib/regulatory-truth/workers/ocr.worker.ts`
- `src/lib/regulatory-truth/workers/composer.worker.ts`
- `src/lib/regulatory-truth/workers/reviewer.worker.ts`
- `src/lib/regulatory-truth/workers/arbiter.worker.ts`
- `src/lib/regulatory-truth/workers/releaser.worker.ts`
- `src/lib/regulatory-truth/workers/content-sync.worker.ts`
- `src/lib/regulatory-truth/workers/article.worker.ts`
- `src/lib/regulatory-truth/workers/embedding.worker.ts`
- `src/lib/regulatory-truth/workers/evidence-embedding.worker.ts`
- `src/lib/regulatory-truth/workers/continuous-drainer.worker.ts`
- `src/lib/backup/backup.worker.ts`
- `src/lib/e-invoice/workers/eposlovanje-inbound-poller.worker.ts`

### Cron Jobs (20 total)
- `src/app/api/cron/bank-sync/route.ts` ✅
- `src/app/api/cron/recurring-expenses/route.ts` ✅
- `src/app/api/cron/deadline-reminders/route.ts` ✅
- `src/app/api/cron/email-sync/route.ts` ✅
- `src/app/api/cron/certificate-check/route.ts` ✅
- `src/app/api/cron/cleanup-uploads/route.ts` ✅
- `src/app/api/cron/weekly-digest/route.ts` ✅
- `src/app/api/cron/newsletter-send/route.ts` ✅
- `src/app/api/cron/system-status-cleanup/route.ts` ✅
- `src/app/api/cron/support-escalation/route.ts` ✅
- `src/app/api/cron/rtl-staleness/route.ts` ✅
- `src/app/api/cron/ai-quality-digest/route.ts` ✅
- `src/app/api/cron/news/fetch-classify/route.ts` ✅
- `src/app/api/cron/news/publish/route.ts` ✅
- `src/app/api/cron/news/review/route.ts` ✅
- `src/app/api/cron/news/stale-check/route.ts` ✅
- `src/app/api/cron/fiscal-processor/route.ts` 🔴 BROKEN AUTH
- `src/app/api/cron/fiscal-retry/route.ts` 🔴 BROKEN AUTH
- `src/app/api/cron/checklist-digest/route.ts` 🔴 BROKEN AUTH

### Queue/Outbox Systems
- `src/lib/outbox/outbox-worker.ts`
- `src/lib/outbox/outbox-service.ts`
- `src/lib/regulatory-truth/workers/queues.ts`

---

## Sign-off

This audit identifies critical authentication vulnerabilities that must be fixed before the next deployment. The company isolation patterns are generally well-implemented, with the exceptions noted above.
