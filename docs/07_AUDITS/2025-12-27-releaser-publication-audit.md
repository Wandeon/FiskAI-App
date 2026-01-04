# Audit 7: Releaser (Publication) Stage

**Date:** 2025-12-27
**Auditor:** Claude (AI-assisted code audit)
**Scope:** Release publication gates, versioning, audit trails, and rollback safety

---

## Executive Summary

| Category                 | Status   | Notes                                                     |
| ------------------------ | -------- | --------------------------------------------------------- |
| Publish Gate Enforcement | **PASS** | 5 hard gates properly enforced                            |
| Versioning Correctness   | **PASS** | Semver based on risk tier implemented correctly           |
| Content Hash Integrity   | **PASS** | Deterministic SHA-256 with comprehensive tests            |
| Audit Trail Completeness | **PASS** | Dual audit entries (rule + release level)                 |
| Release Metadata         | **PASS** | Complete audit trail JSON stored                          |
| Rollback Safety          | **WARN** | No explicit rollback mechanism; relies on version history |

**Overall Result: PASS with 1 WARNING**

---

## 1. Publish Gate Enforcement

### 1.1 Hard Gates Implemented

The releaser (`src/lib/regulatory-truth/agents/releaser.ts`) enforces **5 hard gates** before publication:

| Gate                     | Location      | Enforcement                                                     |
| ------------------------ | ------------- | --------------------------------------------------------------- |
| Status = APPROVED        | Line 79-101   | `db.regulatoryRule.findMany({ where: { status: "APPROVED" } })` |
| T0/T1 Human Approval     | Lines 116-132 | Checks `approvedBy` field is set for T0/T1 rules                |
| No Unresolved Conflicts  | Lines 134-158 | Queries `conflictsA`/`conflictsB` with status OPEN              |
| Source Pointers Required | Lines 160-175 | `r.sourcePointers.length === 0` check                           |
| Evidence Strength Policy | Lines 177-194 | `checkBatchEvidenceStrength()` utility                          |

### 1.2 Evidence Strength Policy

**Location:** `src/lib/regulatory-truth/utils/evidence-strength.ts`

```
SINGLE_SOURCE + authorityLevel != LAW → BLOCKED
SINGLE_SOURCE + authorityLevel == LAW → ALLOWED
MULTI_SOURCE (2+ sources) → ALLOWED regardless of authority
```

**Verdict:** PASS - No unapproved publications possible. All gates fail-closed.

### 1.3 Critical Invariant Check

The system correctly prevents publication of non-approved rules:

- Rules must be in `APPROVED` status (Lines 79-101)
- T0/T1 rules additionally require `approvedBy` field set (Lines 116-132)
- Status changes to `PUBLISHED` only AFTER all gates pass (Line 343-346)

**Note on Schema:** The `RegulatoryRule` model does NOT have a `publishedAt` field. Publication timing is tracked via:

- `RuleRelease.releasedAt` - When the bundle was published
- `RegulatoryRule.status = 'PUBLISHED'` - Rule state

This is intentional - a rule belongs to release(s) via the `releases` relation, and the release timestamp serves as publication time.

---

## 2. Versioning Correctness

### 2.1 Semver Implementation

**Location:** `src/lib/regulatory-truth/agents/releaser.ts` Lines 35-62

```typescript
function calculateNextVersion(previousVersion, riskTiers):
  - T0 (critical) → major bump (X.0.0 → X+1.0.0)
  - T1 (high)     → minor bump (X.Y.0 → X.Y+1.0)
  - T2/T3 (low)   → patch bump (X.Y.Z → X.Y.Z+1)
```

**Highest Risk Tier Wins:** If a release contains T0, T1, and T2 rules, the version bumps as major (T0 takes precedence).

### 2.2 Version Validation

- LLM output is validated against expected semver (Lines 243-247)
- System uses calculated version if LLM output is invalid (Lines 250-252)
- Warning logged when LLM disagrees with calculated type

### 2.3 Monotonic Increase

The `RuleRelease` model has:

- `@@unique([version])` - Prevents duplicate versions
- `releasedAt DESC` ordering for latest release lookup

**Verdict:** PASS - Semver rules properly implemented with risk-tier precedence.

---

## 3. Content Hash Integrity

### 3.1 Hash Computation

**Location:** `src/lib/regulatory-truth/utils/release-hash.ts`

The `computeReleaseHash()` function:

1. Sorts rules by `conceptSlug` (deterministic ordering)
2. Normalizes dates to `YYYY-MM-DD` format
3. Recursively sorts all object keys
4. Computes SHA-256 of JSON string

### 3.2 Test Coverage

**Location:** `src/lib/regulatory-truth/__tests__/release-hash.test.ts`

| Test Case                               | Status |
| --------------------------------------- | ------ |
| Same hash on multiple computes          | PASS   |
| Same hash regardless of input order     | PASS   |
| Same hash with equivalent Date objects  | PASS   |
| Same hash with nested key reordering    | PASS   |
| Different hash when value changes       | PASS   |
| Different hash when date changes        | PASS   |
| Different hash when appliesWhen changes | PASS   |
| Handles empty array                     | PASS   |
| Handles null effectiveUntil             | PASS   |

### 3.3 Verification Endpoint

**Location:** `src/app/api/admin/regulatory-truth/releases/[id]/verify/route.ts`

- Admin-only endpoint (`systemRole === 'ADMIN'`)
- Uses `verifyReleaseHash(releaseId, db)` to recompute and compare

**Verdict:** PASS - Deterministic hash with comprehensive tests and verification API.

---

## 4. Audit Trail Completeness

### 4.1 Dual-Level Logging

The releaser creates audit entries at TWO levels:

**Release Level (Lines 321-330):**

```typescript
logAuditEvent({
  action: "RELEASE_PUBLISHED",
  entityType: "RELEASE",
  entityId: release.id,
  metadata: { version, ruleCount, contentHash },
})
```

**Rule Level (Lines 332-340):**

```typescript
for (const ruleId of approvedRuleIds) {
  logAuditEvent({
    action: "RULE_PUBLISHED",
    entityType: "RULE",
    entityId: ruleId,
    metadata: { releaseId, version },
  })
}
```

### 4.2 Audit Log Utility

**Location:** `src/lib/regulatory-truth/utils/audit-log.ts`

- Actions tracked: `RULE_PUBLISHED`, `RELEASE_PUBLISHED`, `RULE_APPROVED`, etc.
- Default performer: "SYSTEM" (can be overridden with user ID)
- Error handling: Fails silently (doesn't block main operation)

### 4.3 Release Metadata

The `RuleRelease.auditTrail` JSON stores:

```json
{
  "sourceEvidenceCount": <number>,
  "sourcePointerCount": <number>,
  "reviewCount": <number>,
  "humanApprovals": <number>
}
```

**Verdict:** PASS - Comprehensive audit logging at both release and rule levels.

---

## 5. Release Metadata Quality

### 5.1 Schema Definition

**Location:** `src/lib/regulatory-truth/schemas/releaser.ts`

```typescript
ReleaserOutputSchema = {
  release: {
    version: string (semver),
    release_type: "major" | "minor" | "patch",
    released_at: ISO timestamp,
    effective_from: ISO date,
    rules_included: RuleInclusion[],
    content_hash: string (64 chars, SHA-256),
    changelog_hr: string,
    changelog_en: string,
    approved_by: string[],
    audit_trail: AuditTrail
  }
}
```

### 5.2 Changelog Generation

- Bilingual changelogs (Croatian + English)
- Generated by LLM based on included rules
- Stored in `RuleRelease.changelogHr` and `changelogEn`

**Verdict:** PASS - Complete metadata captured per schema.

---

## 6. Rollback Safety

### 6.1 Current Implementation

The system preserves version history but lacks explicit rollback:

**What IS supported:**

- Previous rule versions preserved via `supersedesId` chain
- All releases preserved (never deleted)
- Historical rules queryable through `releases` relation
- Version numbers unique and immutable

**What is NOT implemented:**

- No `rollbackRelease(version)` function
- No UI for triggering rollback
- No automatic rollback on error

### 6.2 Workaround Available

Manual rollback would require:

1. Find rules from target release: `SELECT * FROM "RegulatoryRule" r JOIN "_ReleaseRules" rr ON r.id = rr."A" WHERE rr."B" = '<release_id>'`
2. Set status back to APPROVED
3. Re-publish with corrected rules

### 6.3 Supersession Chain

Rules track supersession via:

- `RegulatoryRule.supersedesId` - Direct parent
- `GraphEdge` with relation `AMENDS` - Full history graph

**Verdict:** WARN - No explicit rollback mechanism. Historical data preserved but recovery is manual.

---

## 7. Database Schema Review

### 7.1 RuleRelease Model

```prisma
model RuleRelease {
  id              String   @id @default(cuid())
  version         String   // semver: "1.0.0"
  releaseType     String   // major, minor, patch
  releasedAt      DateTime @default(now())
  effectiveFrom   DateTime
  contentHash     String   // SHA-256 of rule content
  changelogHr     String?  @db.Text
  changelogEn     String?  @db.Text
  approvedBy      String[] // List of approver user IDs
  auditTrail      Json?

  rules           RegulatoryRule[] @relation("ReleaseRules")

  @@unique([version])
  @@index([releasedAt])
  @@index([effectiveFrom])
}
```

### 7.2 Key Indexes

- `@@unique([version])` - Prevents duplicate version numbers
- `@@index([releasedAt])` - Efficient latest release lookup
- `@@index([effectiveFrom])` - Query by effective date

---

## 8. Recommendations

### 8.1 Critical (None)

No critical issues found.

### 8.2 High Priority

1. **Add Rollback Mechanism**
   - Implement `rollbackToVersion(targetVersion)` function
   - Add admin UI for triggering rollback
   - Consider automatic rollback on deployment failure

### 8.3 Medium Priority

2. **Add publishedAt to RegulatoryRule**
   - Would simplify queries like "when was this rule published?"
   - Currently requires join through RuleRelease

3. **Add Release Health Check**
   - Periodic verification of all release hashes
   - Alert if any hash verification fails

### 8.4 Low Priority

4. **Add Release Notes Template**
   - Structured changelog format
   - Consistent formatting across releases

---

## 9. Files Reviewed

| File                                                      | Purpose                     |
| --------------------------------------------------------- | --------------------------- |
| `src/lib/regulatory-truth/agents/releaser.ts`             | Main releaser agent         |
| `src/lib/regulatory-truth/schemas/releaser.ts`            | Input/output schemas        |
| `src/lib/regulatory-truth/utils/audit-log.ts`             | Audit logging utility       |
| `src/lib/regulatory-truth/utils/evidence-strength.ts`     | Evidence policy enforcement |
| `src/lib/regulatory-truth/utils/release-hash.ts`          | Content hash computation    |
| `src/lib/regulatory-truth/quality/coverage-gate.ts`       | Coverage quality gate       |
| `src/lib/regulatory-truth/workers/releaser.worker.ts`     | BullMQ worker               |
| `src/lib/regulatory-truth/scripts/run-releaser.ts`        | CLI script                  |
| `src/lib/regulatory-truth/__tests__/release-hash.test.ts` | Hash determinism tests      |
| `prisma/schema.prisma`                                    | Database schema             |

---

## 10. Database Queries (For Production Verification)

### Check for unapproved publications (should return 0):

```sql
SELECT id, "conceptSlug", status
FROM "RegulatoryRule"
WHERE status = 'PUBLISHED'
AND id NOT IN (
  SELECT "A" FROM "_ReleaseRules"
);
```

### Check for single-source non-LAW published rules (should return 0):

```sql
SELECT rr.id, rr."conceptSlug", rr."authorityLevel", COUNT(sp.id) as sources
FROM "RegulatoryRule" rr
LEFT JOIN "SourcePointer" sp ON sp."ruleId" = rr.id
WHERE rr.status = 'PUBLISHED'
AND rr."authorityLevel" != 'LAW'
GROUP BY rr.id
HAVING COUNT(sp.id) = 1;
```

### Verify version monotonicity:

```sql
SELECT version, "releasedAt", "releaseType", "contentHash"
FROM "RuleRelease"
ORDER BY "releasedAt" DESC
LIMIT 10;
```

### Audit log summary (last 7 days):

```sql
SELECT action, "entityType", COUNT(*)
FROM "RegulatoryAuditLog"
WHERE "performedAt" > NOW() - INTERVAL '7 days'
GROUP BY action, "entityType";
```

---

## Conclusion

The Releaser publication stage implements robust gates that prevent publication of unapproved or insufficiently validated rules. The versioning follows semver correctly based on risk tier, and content hashes are deterministically computed with comprehensive test coverage.

The main gap is the lack of an explicit rollback mechanism - while historical data is preserved, there's no automated way to revert to a previous release state. This should be addressed for production safety.

**Final Verdict: PASS with 1 WARNING (rollback mechanism)**
