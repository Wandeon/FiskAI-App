# Regulatory Truth E2E Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan.

**Goal:** Run an end-to-end audit of the Regulatory Truth Layer on real Croatian sources and produce reproducible artifacts.

**Architecture:** Execute pipeline phases via CLI scripts + DB queries, store outputs under `docs/regulatory-truth/audit-artifacts/2025-12-23/`, and compile metrics + backlog from those artifacts.

**Tech Stack:** Node.js (tsx), PostgreSQL (psql), regulatory-truth CLI scripts, helper TS scripts in `tmp/`.

### Task 1: Pre-flight snapshot (Phase 0)

**Files:**

- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/phase0_counts.txt`
- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/agent_runs_24h.txt`
- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/env_snapshot.txt`

**Step 1: Create artifacts directory**
Run: `mkdir -p docs/regulatory-truth/audit-artifacts/2025-12-23`
Expected: directory exists.

**Step 2: Capture baseline counts**
Run (example):

```bash
DB_URL=$(rg -o "DATABASE_URL=.*" .env.local | sed 's/DATABASE_URL=//' | sed 's/?schema=public//')
psql "$DB_URL" -c "SELECT (SELECT count(*) FROM \"Evidence\") as evidence_count, (SELECT count(*) FROM \"SourcePointer\") as source_pointer_count, (SELECT count(*) FROM \"RegulatoryRule\") as rule_count, (SELECT count(*) FROM \"RegulatoryConflict\") as conflict_count, (SELECT count(*) FROM \"RegulatoryRelease\") as release_count;" > docs/regulatory-truth/audit-artifacts/2025-12-23/phase0_counts.txt
```

Expected: counts recorded.

**Step 3: Capture agent run summary**
Run:

```bash
psql "$DB_URL" -c "SELECT \"agentType\", status, count(*) FROM \"AgentRun\" WHERE \"createdAt\" > now()-interval '24 hours' GROUP BY 1,2 ORDER BY 1,2;" > docs/regulatory-truth/audit-artifacts/2025-12-23/agent_runs_24h.txt
```

Expected: summary of agent runs.

**Step 4: Capture env snapshot**
Run:

```bash
{
  echo "GIT_SHA=$(git rev-parse HEAD)"
  rg -n "OLLAMA|MODEL|SCHEDULER|ENV|APP_ENV" .env.local .env 2>/dev/null || true
} > docs/regulatory-truth/audit-artifacts/2025-12-23/env_snapshot.txt
```

Expected: commit and env/config markers captured.

### Task 2: Sentinel run + idempotency (Phase 1)

**Files:**

- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/sentinel_run_1.log`
- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/sentinel_run_2.log`
- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/evidence_count_before.txt`
- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/evidence_count_after_1.txt`
- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/evidence_count_after_2.txt`
- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/evidence_dupes_after_2.txt`

**Step 1: Record evidence count before**
Run:

```bash
psql "$DB_URL" -c "SELECT count(*) as evidence_total FROM \"Evidence\";" > docs/regulatory-truth/audit-artifacts/2025-12-23/evidence_count_before.txt
```

Expected: baseline count.

**Step 2: Trigger Sentinel (CRITICAL)**
Run: `npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts CRITICAL | tee docs/regulatory-truth/audit-artifacts/2025-12-23/sentinel_run_1.log`
Expected: new items fetched.

**Step 3: Record evidence count after run 1**
Run: `psql "$DB_URL" -c "SELECT count(*) as evidence_total FROM \"Evidence\";" > docs/regulatory-truth/audit-artifacts/2025-12-23/evidence_count_after_1.txt`
Expected: count delta captured.

**Step 4: Re-run Sentinel**
Run: `npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts CRITICAL | tee docs/regulatory-truth/audit-artifacts/2025-12-23/sentinel_run_2.log`
Expected: zero new items for unchanged content.

**Step 5: Record evidence count after run 2 + dupes**
Run:

```bash
psql "$DB_URL" -c "SELECT count(*) as evidence_total FROM \"Evidence\";" > docs/regulatory-truth/audit-artifacts/2025-12-23/evidence_count_after_2.txt
psql "$DB_URL" -c "SELECT url, \"contentHash\", count(*) as dupes FROM \"Evidence\" GROUP BY url, \"contentHash\" HAVING count(*) > 1;" > docs/regulatory-truth/audit-artifacts/2025-12-23/evidence_dupes_after_2.txt
```

Expected: zero dupes.

### Task 3: Evidence immutability sampling (Phase 2)

**Files:**

- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/evidence_hash_sample.json`

**Step 1: Select 10 evidence IDs (>=3 JSON/JSON-LD, >=5 HTML)**
Run:

```bash
psql "$DB_URL" -c "(SELECT id FROM \"Evidence\" WHERE \"contentType\" IN ('json','json-ld') ORDER BY \"fetchedAt\" DESC LIMIT 3)
UNION ALL
(SELECT id FROM \"Evidence\" WHERE \"contentType\"='html' ORDER BY \"fetchedAt\" DESC LIMIT 5)
UNION ALL
(SELECT id FROM \"Evidence\" ORDER BY \"fetchedAt\" DESC LIMIT 2);" > /tmp/evidence_ids.txt
```

Expected: 10 IDs in file.

**Step 2: Recompute hashes**
Run:

```bash
IDS=$(awk 'NR>2 {print $1}' /tmp/evidence_ids.txt | tr '\n' ' ')
DATABASE_URL=$(rg -o "DATABASE_URL=.*" .env.local | sed 's/DATABASE_URL=//') npx tsx /home/admin/FiskAI/tmp/evidence-hash-check-ids.ts $IDS > docs/regulatory-truth/audit-artifacts/2025-12-23/evidence_hash_sample.json
```

Expected: JSON array with match boolean per evidence ID.

### Task 4: Extractor run (Phase 3)

**Files:**

- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/extractor_run.log`
- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/extraction_value_quote_check.json`

**Step 1: Run extractor on unprocessed evidence**
Run: `npx tsx src/lib/regulatory-truth/scripts/run-extractor.ts | tee docs/regulatory-truth/audit-artifacts/2025-12-23/extractor_run.log`
Expected: summary of success/fail.

**Step 2: Validate 10 pointer value/quote matches**
Run: `DATABASE_URL=... npx tsx /home/admin/FiskAI/tmp/quote-value-check.ts > docs/regulatory-truth/audit-artifacts/2025-12-23/extraction_value_quote_check.json`
Expected: 10 samples with match flags.

### Task 5: Composer run (Phase 4)

**Files:**

- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/composer_run.log`
- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/rule_pointer_counts_sample.txt`
- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/applieswhen_check.json`

**Step 1: Run composer batch**
Run: `npx tsx src/lib/regulatory-truth/scripts/run-composer.ts --batch | tee docs/regulatory-truth/audit-artifacts/2025-12-23/composer_run.log`
Expected: rules created summary.

**Step 2: Sample pointer linkage**
Run:

```bash
psql "$DB_URL" -c "SELECT r.id, r.\"conceptSlug\", r.status, count(sp.id) as pointer_count FROM \"RegulatoryRule\" r LEFT JOIN \"_RuleSourcePointers\" rsp ON r.id = rsp.\"B\" LEFT JOIN \"SourcePointer\" sp ON rsp.\"A\" = sp.id GROUP BY r.id ORDER BY r.\"createdAt\" DESC LIMIT 10;" > docs/regulatory-truth/audit-artifacts/2025-12-23/rule_pointer_counts_sample.txt
```

Expected: 10 rows with pointer counts.

**Step 3: Validate appliesWhen**
Run: `DATABASE_URL=... npx tsx /home/admin/FiskAI/tmp/check-applies-when.ts > docs/regulatory-truth/audit-artifacts/2025-12-23/applieswhen_check.json`
Expected: invalid count visible.

### Task 6: Reviewer + gates (Phase 5)

**Files:**

- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/reviewer_run.log`
- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/approval_policy_check.txt`

**Step 1: Run reviewer**
Run: `npx tsx src/lib/regulatory-truth/scripts/run-reviewer.ts | tee docs/regulatory-truth/audit-artifacts/2025-12-23/reviewer_run.log`
Expected: approvals/rejections logged.

**Step 2: Check T0/T1 approvals**
Run:

```bash
psql "$DB_URL" -c "SELECT id, \"conceptSlug\", status, \"riskTier\", \"approvedBy\" FROM \"RegulatoryRule\" WHERE \"riskTier\" IN ('T0','T1') AND status IN ('APPROVED','PUBLISHED') AND \"approvedBy\" IS NULL;" > docs/regulatory-truth/audit-artifacts/2025-12-23/approval_policy_check.txt
```

Expected: 0 rows.

### Task 7: Conflicts + arbiter (Phase 6)

**Files:**

- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/conflicts_before.txt`
- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/arbiter_run.log`

**Step 1: Check conflicts**
Run: `psql "$DB_URL" -c "SELECT count(*) FROM \"RegulatoryConflict\";" > docs/regulatory-truth/audit-artifacts/2025-12-23/conflicts_before.txt`
Expected: count recorded.

**Step 2: Run arbiter**
Run: `npx tsx src/lib/regulatory-truth/scripts/run-arbiter.ts | tee docs/regulatory-truth/audit-artifacts/2025-12-23/arbiter_run.log`
Expected: conflict resolution or no conflicts.

### Task 8: Releaser (Phase 7)

**Files:**

- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/releaser_run.log`
- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/release_hash_check.json`

**Step 1: Run releaser**
Run: `npx tsx src/lib/regulatory-truth/scripts/run-releaser.ts | tee docs/regulatory-truth/audit-artifacts/2025-12-23/releaser_run.log`
Expected: release created if approved rules exist.

**Step 2: Recompute release hash twice**
Run: `DATABASE_URL=... npx tsx /home/admin/FiskAI/tmp/release-hash-prisma.ts > docs/regulatory-truth/audit-artifacts/2025-12-23/release_hash_check.json`
Expected: stored == computed for latest release.

### Task 9: Assistant trust test (Phase 8)

**Files:**

- Create: `docs/regulatory-truth/audit-artifacts/2025-12-23/assistant_test_suite.json`

**Step 1: Run test suite**
Run: `npx tsx /home/admin/FiskAI/tmp/assistant-test-suite.ts --url http://127.0.0.1:3000 > docs/regulatory-truth/audit-artifacts/2025-12-23/assistant_test_suite.json`
Expected: JSON results with citation compliance.
