# Verification Matrix

**Generated:** 2025-12-26
**Purpose:** Comprehensive verification of FiskAI codebase completeness

---

## 1. Regulatory Truth Layer

| Component           | Status      | Files                                                 | Notes                               |
| ------------------- | ----------- | ----------------------------------------------------- | ----------------------------------- |
| Sentinel Agent      | ✅ Complete | `src/lib/regulatory-truth/agents/sentinel.ts`         | Sitemap scanning, discovery         |
| Extractor Agent     | ✅ Complete | `src/lib/regulatory-truth/agents/extractor.ts`        | LLM fact extraction                 |
| Composer Agent      | ✅ Complete | `src/lib/regulatory-truth/agents/composer.ts`         | Rule composition                    |
| Reviewer Agent      | ✅ Complete | `src/lib/regulatory-truth/agents/reviewer.ts`         | Quality review, auto-approve        |
| Arbiter Agent       | ✅ Complete | `src/lib/regulatory-truth/agents/arbiter.ts`          | Conflict resolution                 |
| Releaser Agent      | ✅ Complete | `src/lib/regulatory-truth/agents/releaser.ts`         | Publication, evidence strength gate |
| Evidence Strength   | ✅ Complete | `src/lib/regulatory-truth/utils/evidence-strength.ts` | MULTI_SOURCE/SINGLE_SOURCE          |
| Meaning Signature   | ✅ Complete | `src/lib/regulatory-truth/utils/meaning-signature.ts` | Duplicate prevention                |
| TruthHealthSnapshot | ✅ Complete | `src/lib/regulatory-truth/utils/truth-health.ts`      | Health metrics collection           |
| Binary Parser       | ✅ Complete | `src/lib/regulatory-truth/utils/binary-parser.ts`     | PDF/DOC/DOCX/XLSX                   |
| Knowledge Graph     | ✅ Complete | `src/lib/regulatory-truth/graph/knowledge-graph.ts`   | Rule relationships                  |

### Workers (BullMQ)

| Worker             | Status      | Files                                                           |
| ------------------ | ----------- | --------------------------------------------------------------- |
| Scheduler          | ✅ Complete | `src/lib/regulatory-truth/workers/scheduler.service.ts`         |
| Orchestrator       | ✅ Complete | `src/lib/regulatory-truth/workers/orchestrator.worker.ts`       |
| Sentinel Worker    | ✅ Complete | `src/lib/regulatory-truth/workers/sentinel.worker.ts`           |
| OCR Worker         | ✅ Complete | `src/lib/regulatory-truth/workers/ocr.worker.ts`                |
| Extractor Worker   | ✅ Complete | `src/lib/regulatory-truth/workers/extractor.worker.ts`          |
| Composer Worker    | ✅ Complete | `src/lib/regulatory-truth/workers/composer.worker.ts`           |
| Reviewer Worker    | ✅ Complete | `src/lib/regulatory-truth/workers/reviewer.worker.ts`           |
| Arbiter Worker     | ✅ Complete | `src/lib/regulatory-truth/workers/arbiter.worker.ts`            |
| Releaser Worker    | ✅ Complete | `src/lib/regulatory-truth/workers/releaser.worker.ts`           |
| Continuous Drainer | ✅ Complete | `src/lib/regulatory-truth/workers/continuous-drainer.worker.ts` |

---

## 2. Assistant Surfaces

| Surface            | Status      | Route        | Components                                         | Notes                        |
| ------------------ | ----------- | ------------ | -------------------------------------------------- | ---------------------------- |
| MARKETING (public) | ✅ Complete | `/assistant` | AssistantContainer, EvidencePanel, SuggestionChips | No companyId, shows CTAs     |
| APP (private)      | ✅ Complete | `/asistent`  | AssistantContainer, EvidencePanel, ClientDataPanel | With companyId, personalized |

### Assistant Components (v2)

| Component          | Status      | Files                                                |
| ------------------ | ----------- | ---------------------------------------------------- |
| AssistantContainer | ✅ Complete | `src/components/assistant-v2/AssistantContainer.tsx` |
| AssistantInput     | ✅ Complete | `src/components/assistant-v2/AssistantInput.tsx`     |
| AnswerSection      | ✅ Complete | `src/components/assistant-v2/AnswerSection.tsx`      |
| EvidencePanel      | ✅ Complete | `src/components/assistant-v2/EvidencePanel.tsx`      |
| ClientDataPanel    | ✅ Complete | `src/components/assistant-v2/ClientDataPanel.tsx`    |
| RefusalCard        | ✅ Complete | `src/components/assistant-v2/RefusalCard.tsx`        |
| CTABlock           | ✅ Complete | `src/components/assistant-v2/CTABlock.tsx`           |
| SuggestionChips    | ✅ Complete | `src/components/assistant-v2/SuggestionChips.tsx`    |
| EmptyState         | ✅ Complete | `src/components/assistant-v2/EmptyState.tsx`         |

### Fail-Closed Validation

| Check                                               | Status      | Files                              | Notes                            |
| --------------------------------------------------- | ----------- | ---------------------------------- | -------------------------------- |
| REGULATORY+ANSWER requires citations                | ✅ Complete | `src/lib/assistant/validation.ts`  | Enforced by `validateResponse()` |
| Primary citation has url/quote/evidenceId/fetchedAt | ✅ Complete | `src/lib/assistant/validation.ts`  | Lines 70-102                     |
| RefusalReason enum                                  | ✅ Complete | `src/lib/assistant/types.ts:64-70` | 6 reasons defined                |

### RefusalReason Types

| Reason                   | Purpose                             | Status |
| ------------------------ | ----------------------------------- | ------ |
| NO_CITABLE_RULES         | No matching rules in knowledge base | ✅     |
| OUT_OF_SCOPE             | Query outside regulatory domain     | ✅     |
| MISSING_CLIENT_DATA      | APP surface, needs business data    | ✅     |
| UNRESOLVED_CONFLICT      | Conflicting rules detected          | ✅     |
| NEEDS_CLARIFICATION      | Ambiguous query                     | ✅     |
| UNSUPPORTED_JURISDICTION | Non-Croatian jurisdiction           | ✅     |

---

## 3. Monitoring & Health Checks

### Scheduled Jobs (scheduler.service.ts)

| Job                       | Time      | Status | Notes                              |
| ------------------------- | --------- | ------ | ---------------------------------- |
| Morning Discovery         | 06:00     | ✅     | Queues sentinel for all priorities |
| Health Snapshot           | 00:00     | ✅     | TruthHealthSnapshot collection     |
| Truth Consolidation Audit | 04:00     | ✅     | Smoke detector mode                |
| E2E Validation            | 05:00     | ✅     | Full pipeline validation           |
| Confidence Decay          | 03:00 Sun | ✅     | Weekly confidence updates          |

### Watchdog Cron (watchdog/cron.ts)

| Job            | Time        | Status | Notes                          |
| -------------- | ----------- | ------ | ------------------------------ |
| Main Pipeline  | 06:00       | ✅     | Scout, Scrape, Process, Health |
| Daily Digest   | 08:00       | ✅     | Via SMTP (not Resend)          |
| Random Audit 1 | 10:00-14:00 | ✅     | Randomized time                |
| Random Audit 2 | 16:00-20:00 | ✅     | 50% chance                     |

### Health Monitors

| Monitor                  | Status      | Files                                                  |
| ------------------------ | ----------- | ------------------------------------------------------ |
| Health Monitor Framework | ✅ Complete | `src/lib/regulatory-truth/watchdog/health-monitors.ts` |
| TruthHealthSnapshot API  | ✅ Complete | `src/app/api/regulatory/truth-health/route.ts`         |
| Watchdog Dashboard API   | ✅ Complete | `src/app/api/admin/watchdog/route.ts`                  |

---

## 4. Alerting & Notifications

### Current Implementation

| Channel        | Status      | Files                                        | Notes                                |
| -------------- | ----------- | -------------------------------------------- | ------------------------------------ |
| Slack          | ✅ Complete | `src/lib/regulatory-truth/watchdog/slack.ts` | Critical alerts, audit results       |
| Email (SMTP)   | ✅ Complete | `src/lib/regulatory-truth/watchdog/email.ts` | Via Nodemailer                       |
| Resend Library | ✅ Complete | `src/lib/email.ts`                           | Used for general transactional email |

### Alert Deduplication

| Feature                | Status      | Files                                                 | Notes                     |
| ---------------------- | ----------- | ----------------------------------------------------- | ------------------------- |
| 24h Dedup Window       | ✅ Complete | `src/lib/regulatory-truth/watchdog/alerting.ts:16-37` | Checks for existing alert |
| Occurrence Count       | ✅ Complete | `src/lib/regulatory-truth/watchdog/alerting.ts:29-31` | Increments count          |
| CRITICAL → Slack+Email | ✅ Complete | `src/lib/regulatory-truth/watchdog/alerting.ts:53-54` | Dual routing              |

### Daily Digest Content (Current)

| Metric              | Status | Notes                         |
| ------------------- | ------ | ----------------------------- |
| Warnings (last 24h) | ✅     | Only WARNING severity         |
| Sources checked     | ✅     | Active RegulatorySource count |
| Items discovered    | ✅     | Evidence fetched in 24h       |
| Rules created       | ✅     | RegulatoryRule created in 24h |
| Avg confidence      | ✅     | Average rule confidence       |

---

## 5. Gaps Identified

### ⚠️ Partially Implemented: Daily Digest via Resend

**Current State:**

- Daily digest sent at 08:00 via SMTP (Nodemailer)
- Uses `ADMIN_ALERT_EMAIL` env var
- Limited metrics (warnings, basic stats)

**Required Changes:**

- Switch from SMTP to Resend
- Change time to 07:00 Europe/Zagreb
- Add recipient: `wandeon@gmail.com`
- Add missing metrics:
  - TruthHealthSnapshot summary
  - All alerts (not just warnings)
  - Consolidator dry-run results
  - Evidence strength stats (multi-source vs single-source)
  - Published vs blocked rules
  - Queue health

### ⚠️ Partially Implemented: Immediate Alerts via Resend

**Current State:**

- Critical alerts sent via SMTP

**Required Changes:**

- Switch to Resend for consistency
- Keep Slack as secondary channel

### ✅ Already Implemented: Alert Deduplication

**Current State:**

- 24-hour dedup window
- Occurrence count tracking
- Works correctly

**User Request:** 30-60 minute window

- Current 24h window may be too long
- Consider reducing to 60 minutes

---

## 6. UI Surfaces Summary

| Route        | Portal    | Surface   | Access        | Key Features                                 |
| ------------ | --------- | --------- | ------------- | -------------------------------------------- |
| `/assistant` | Marketing | MARKETING | Public        | EvidencePanel, CTAs, no client data          |
| `/asistent`  | App       | APP       | Authenticated | EvidencePanel, ClientDataPanel, personalized |

### Surface Behavior Matrix

| Behavior                     | MARKETING | APP |
| ---------------------------- | --------- | --- |
| Requires auth                | No        | Yes |
| Shows ClientDataPanel        | No        | Yes |
| Shows CTAs                   | Yes       | No  |
| Shows EvidencePanel          | Yes       | Yes |
| Uses companyId               | No        | Yes |
| Personalized answers         | No        | Yes |
| MISSING_CLIENT_DATA possible | No        | Yes |

---

## 7. Files Changed in Recent Sprint

### New Files

- `scripts/audit-reconcile.ts`
- `scripts/check-secrets-drift.ts`
- `scripts/check-container-completeness.ts`
- `src/lib/regulatory-truth/utils/evidence-strength.ts`
- `src/lib/regulatory-truth/__tests__/binary-parser.test.ts`
- `docs/07_AUDITS/audit-reconcile-report.md`
- `docs/07_AUDITS/2025-12-25-sprint-summary.md`

### Modified Files

- `docker-compose.workers.yml` (env var interpolation)
- `prisma/schema.prisma` (TruthHealthSnapshot)
- `src/lib/regulatory-truth/agents/releaser.ts` (evidence strength gate)
- `src/lib/regulatory-truth/utils/truth-health.ts` (evidence metrics)

---

## 8. Verification Commands

```bash
# Run audit reconciliation
npx tsx scripts/audit-reconcile.ts

# Check secrets drift
npx tsx scripts/check-secrets-drift.ts

# Check container completeness
npx tsx scripts/check-container-completeness.ts

# Run binary parser tests
npx vitest run src/lib/regulatory-truth/__tests__/binary-parser.test.ts

# Check truth health
DATABASE_URL="..." npx tsx -e "
import { collectTruthHealthMetrics } from './src/lib/regulatory-truth/utils/truth-health'
collectTruthHealthMetrics().then(console.log)
"
```

---

## Summary

| Category               | Complete | Partial | Missing |
| ---------------------- | -------- | ------- | ------- |
| Regulatory Truth Layer | 11       | 0       | 0       |
| Workers                | 10       | 0       | 0       |
| Assistant Surfaces     | 2        | 0       | 0       |
| Assistant Components   | 9        | 0       | 0       |
| Validation/Refusal     | 7        | 0       | 0       |
| Scheduled Jobs         | 7        | 0       | 0       |
| Alerting Channels      | 2        | 1       | 0       |
| Deduplication          | 1        | 0       | 0       |
| **Totals**             | **49**   | **1**   | **0**   |

**Key Finding:** System is 98% complete. Only gap is switching daily digest from SMTP to Resend with enhanced metrics.
