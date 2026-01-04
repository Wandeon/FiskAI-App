# Runtime Usage Evidence for "Unused" Tables

> Generated: 2026-01-02
> Branch: `chore/schema-partition-rtl`

## Critical Correction

**Initial grep scan was flawed.** The scan for `ModelName` missed Prisma's camelCase access pattern (`db.modelName`). Many "unused" tables are actively used in code.

---

## Table-by-Table Evidence

### Tables with ACTIVE Code Usage (17 of 26)

| Table                            | DB Rows | Code Refs | Last Write     | Status              |
| -------------------------------- | ------- | --------- | -------------- | ------------------- |
| **VerificationToken**            | 1       | 12        | Active         | ❌ AUTH-CRITICAL    |
| **WebAuthnCredential**           | 1       | 13        | 2025-12-12     | ❌ AUTH-CRITICAL    |
| **WebhookSubscription**          | 0       | 8         | -              | ⚠️ USED IN CODE     |
| **RegulatoryAuditLog**           | 2557    | 4         | **2026-01-02** | ❌ ACTIVELY WRITTEN |
| **WatchdogAudit**                | 15      | 1         | 2025-12-27     | ⚠️ RTL AUDIT        |
| **SoftFailLog**                  | 9       | 1         | 2025-12-23     | ⚠️ RTL LOGGING      |
| **SystemRegistryStatusPointer**  | 0       | 5         | -              | ⚠️ USED IN CODE     |
| **SystemRegistryStatusSnapshot** | 0       | 3         | -              | ⚠️ USED IN CODE     |
| **SystemRegistryStatusEvent**    | 0       | 2         | -              | ⚠️ USED IN CODE     |
| **SystemRegistryRefreshJob**     | 0       | 5         | -              | ⚠️ USED IN CODE     |
| **SystemRegistryRefreshLock**    | 0       | 4         | -              | ⚠️ USED IN CODE     |
| **HumanReviewQueue**             | 0       | 14        | -              | ⚠️ USED IN CODE     |
| **ClaimVerification**            | 0       | 1         | -              | ⚠️ USED IN CODE     |
| **ReasoningTrace**               | 0       | 1         | -              | ⚠️ USED IN CODE     |
| **EmailSuppression**             | 0       | 4         | -              | ⚠️ EMAIL BOUNCES    |
| **CronJobError**                 | 0       | 6         | -              | ⚠️ CRON DLQ         |
| **PotentialDuplicate**           | 0       | 7         | -              | ⚠️ BANK DEDUP       |

### Tables That Are Truly Unused (8 of 26)

| Table                        | DB Rows | Code Refs | FK Refs               | Safe to Drop?  |
| ---------------------------- | ------- | --------- | --------------------- | -------------- |
| **ExperimentSegment**        | 0       | 0         | None                  | ✅ YES         |
| **MonitoringAlert**          | 0       | 0         | None                  | ✅ YES         |
| **RuleCalculation**          | 0       | 0         | None                  | ✅ YES         |
| **RolePermission**           | 0       | 0         | None                  | ✅ YES         |
| **SegmentFeatureTarget**     | 0       | 0         | None                  | ✅ YES         |
| **SegmentMembershipHistory** | 0       | 0         | None                  | ✅ YES         |
| **SupportTicketAttachment**  | 0       | 0         | None                  | ✅ YES         |
| **TravelOrder**              | 0       | 0         | MileageLog, TravelPdf | ⚠️ HAS FK REFS |

### Schema-Only (Never Migrated)

| Table                    | Status                                     |
| ------------------------ | ------------------------------------------ |
| **JoppdSubmissionEvent** | Model in schema, table doesn't exist in DB |

---

## Detailed Evidence

### VerificationToken ❌ CANNOT DROP

```sql
SELECT * FROM "VerificationToken";
-- identifier: emina.topolnjak@gmail.com
-- token: 75180a5012a6c3c8...
-- expires: 2025-12-19 18:10:28
```

**Code references:**

- `src/lib/actions/auth.ts:50` - deleteMany
- `src/lib/actions/auth.ts:55` - create
- `src/lib/actions/auth.ts:349` - findUnique
- ...and 9 more

**Verdict:** Used for email verification flows. Token exists for active user. CANNOT DROP.

---

### WebAuthnCredential ❌ CANNOT DROP

```sql
SELECT id, "userId", "createdAt" FROM "WebAuthnCredential";
-- id: cmj2qnwu0000401o5r3y39yqf
-- userId: cmj02mtoa000001lmonajvd3f
-- createdAt: 2025-12-12 10:43:12
```

**Code references:**

- `src/app/api/webauthn/passkeys/[id]/route.ts` - delete
- `src/app/api/webauthn/register/finish/route.ts` - create
- `src/app/api/webauthn/login/finish/route.ts` - findFirst, update
- ...and 10 more

**Verdict:** Active passkey registration exists. CANNOT DROP.

---

### RegulatoryAuditLog ❌ CANNOT DROP

```sql
SELECT COUNT(*) FROM "RegulatoryAuditLog";
-- 2557 rows

SELECT MAX("performedAt") FROM "RegulatoryAuditLog";
-- 2026-01-02 05:39:33 (TODAY!)
```

**Code references:**

- `src/lib/regulatory-truth/utils/audit-log.ts:32` - create
- `src/lib/regulatory-truth/utils/audit-log.ts:61` - findMany
- `src/lib/regulatory-truth/agents/releaser.ts:1024` - findMany
- `src/lib/regulatory-truth/utils/truth-health.ts:140` - count

**Verdict:** Active RTL audit log with 2557 entries. Being written to TODAY. CANNOT DROP.

---

### SystemRegistry\* Tables ⚠️ USED IN CODE

All 5 SystemRegistry tables are used in `src/lib/system-status/store.ts`:

```typescript
// SystemRegistryStatusPointer (5 refs)
db.systemRegistryStatusPointer.findFirst()
db.systemRegistryStatusPointer.update()
db.systemRegistryStatusPointer.create()

// SystemRegistryStatusSnapshot (3 refs)
db.systemRegistryStatusSnapshot.findUnique()
db.systemRegistryStatusSnapshot.create()

// SystemRegistryStatusEvent (2 refs)
db.systemRegistryStatusEvent.createMany()
db.systemRegistryStatusEvent.findMany()

// SystemRegistryRefreshJob (5 refs)
db.systemRegistryRefreshJob.create()
db.systemRegistryRefreshJob.update()
db.systemRegistryRefreshJob.findUnique()
db.systemRegistryRefreshJob.findFirst()

// SystemRegistryRefreshLock (4 refs)
db.systemRegistryRefreshLock.deleteMany()
db.systemRegistryRefreshLock.create()
db.systemRegistryRefreshLock.delete()
db.systemRegistryRefreshLock.findFirst()
```

**Verdict:** 0 rows in DB but actively used in code. Would break system status feature. CANNOT DROP without code removal.

---

### TravelOrder ⚠️ HAS FK CONSTRAINTS

```sql
-- FK references
MileageLog.travelOrderId -> TravelOrder.id
TravelPdf.travelOrderId -> TravelOrder.id
```

**Verdict:** 0 rows, 0 code refs, but FK constraints exist. Must drop FKs first or remove referencing tables.

---

## PR Split Decision

### PR#1A: Safe Drops (6 tables)

Tables with:

- 0 rows
- 0 code references
- No FK constraints

```
ExperimentSegment
MonitoringAlert
RuleCalculation
RolePermission
SegmentFeatureTarget
SegmentMembershipHistory
```

**Risk:** Very low. Pure cleanup.

### PR#1B: Probationary (2 tables)

Tables requiring additional verification:

```
SupportTicketAttachment  -- 0 rows, 0 refs, but related to SupportTicket
TravelOrder              -- 0 rows, 0 refs, but has FK constraints
```

**Risk:** Low, but requires FK handling.

### PR#1C: Schema-Only Cleanup (1 model)

```
JoppdSubmissionEvent     -- Model in schema, table never created
```

**Risk:** None. No migration needed, just schema file edit.

### NOT IN PR#1: Active Tables (17 tables)

Tables removed from PR#1 entirely because they are actively used:

```
VerificationToken        -- AUTH: email verification
WebAuthnCredential       -- AUTH: passkey login
WebhookSubscription      -- Webhook processing
RegulatoryAuditLog       -- RTL audit (2557 rows, written today!)
WatchdogAudit            -- RTL watchdog
SoftFailLog              -- RTL soft failures
SystemRegistryStatusPointer    -- System status
SystemRegistryStatusSnapshot   -- System status
SystemRegistryStatusEvent      -- System status
SystemRegistryRefreshJob       -- System status
SystemRegistryRefreshLock      -- System status
HumanReviewQueue         -- Human review service
ClaimVerification        -- Article agent
ReasoningTrace           -- Assistant reasoning
EmailSuppression         -- Email bounce handling
CronJobError             -- Cron DLQ
PotentialDuplicate       -- Bank dedup
```

---

## Staging Smoke Test Plan

After PR#1A deployment, verify:

| Flow    | Test                              | Expected                   |
| ------- | --------------------------------- | -------------------------- |
| Auth    | Login/logout                      | Works                      |
| Auth    | Password reset request            | Email sent                 |
| Auth    | Email verification                | Token created/consumed     |
| Auth    | Passkey login (if feature exists) | Works                      |
| RTL     | Sentinel discovery run            | Evidence created           |
| RTL     | Watchdog audit check              | WatchdogAudit row created  |
| Webhook | Regulatory webhook trigger        | WebhookEvent created       |
| Email   | Send email with bounce history    | EmailSuppression checked   |
| Cron    | Trigger failing cron              | CronJobError logged        |
| Banking | Import duplicate transaction      | PotentialDuplicate created |

---

## Conclusion

**Original assessment was wrong.** Of 26 "unused" tables:

- **17 are actively used** (code references found)
- **6 are truly safe to drop** (PR#1A)
- **2 need FK handling** (PR#1B)
- **1 is schema-only** (PR#1C)

The grep scan for PascalCase model names missed Prisma's camelCase access pattern. Runtime DB evidence combined with correct grep patterns revealed the true usage.
