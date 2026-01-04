# PR#1A Migration SQL

> Branch: `chore/schema-partition-rtl`
> Scope: 6 unused tables with 0 rows, 0 code refs, 0 FK dependencies

## Pre-Migration Verification

```sql
-- Verify all tables are empty
SELECT 'ExperimentSegment' as tbl, COUNT(*) as rows FROM "ExperimentSegment"
UNION ALL SELECT 'MonitoringAlert', COUNT(*) FROM "MonitoringAlert"
UNION ALL SELECT 'RuleCalculation', COUNT(*) FROM "RuleCalculation"
UNION ALL SELECT 'RolePermission', COUNT(*) FROM "RolePermission"
UNION ALL SELECT 'SegmentFeatureTarget', COUNT(*) FROM "SegmentFeatureTarget"
UNION ALL SELECT 'SegmentMembershipHistory', COUNT(*) FROM "SegmentMembershipHistory";
-- Expected: all 0

-- Verify no FK references to these tables
SELECT
    tc.table_name as referencing_table,
    ccu.table_name as referenced_table
FROM information_schema.table_constraints AS tc
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND ccu.table_name IN (
  'ExperimentSegment', 'MonitoringAlert', 'RuleCalculation',
  'RolePermission', 'SegmentFeatureTarget', 'SegmentMembershipHistory'
);
-- Expected: 0 rows
```

## Migration SQL

```sql
-- Migration: remove_unused_tables_pr1a
-- Generated: 2026-01-02
-- Tables: 6
-- Risk: Very low (0 rows, 0 code refs, 0 FK dependencies)

-- Drop ExperimentSegment
DROP TABLE IF EXISTS "ExperimentSegment" CASCADE;

-- Drop MonitoringAlert
DROP TABLE IF EXISTS "MonitoringAlert" CASCADE;

-- Drop RuleCalculation
DROP TABLE IF EXISTS "RuleCalculation" CASCADE;

-- Drop RolePermission
DROP TABLE IF EXISTS "RolePermission" CASCADE;

-- Drop SegmentFeatureTarget
DROP TABLE IF EXISTS "SegmentFeatureTarget" CASCADE;

-- Drop SegmentMembershipHistory
DROP TABLE IF EXISTS "SegmentMembershipHistory" CASCADE;

-- Drop associated enums (if not used elsewhere)
-- Note: Check if these enums are used by other tables before dropping
-- DROP TYPE IF EXISTS "AlertSeverity" CASCADE;  -- Used by MonitoringAlert only
-- DROP TYPE IF EXISTS "AlertType" CASCADE;      -- Used by MonitoringAlert only
```

## Rollback SQL

```sql
-- Rollback: recreate_unused_tables_pr1a
-- Run this to restore the tables if needed

CREATE TABLE "ExperimentSegment" (
  "id" TEXT NOT NULL,
  "experimentId" TEXT NOT NULL,
  "segmentId" TEXT NOT NULL,
  "isControl" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ExperimentSegment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExperimentSegment_experimentId_segmentId_key" ON "ExperimentSegment"("experimentId", "segmentId");
CREATE INDEX "ExperimentSegment_experimentId_idx" ON "ExperimentSegment"("experimentId");
CREATE INDEX "ExperimentSegment_segmentId_idx" ON "ExperimentSegment"("segmentId");
ALTER TABLE "ExperimentSegment" ADD CONSTRAINT "ExperimentSegment_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentSegment" ADD CONSTRAINT "ExperimentSegment_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "UserSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MonitoringAlert" (
  "id" TEXT NOT NULL,
  "severity" "AlertSeverity" NOT NULL,
  "type" "AlertType" NOT NULL,
  "affectedRuleIds" TEXT[],
  "sourceId" TEXT,
  "description" TEXT NOT NULL,
  "autoAction" JSONB,
  "humanActionRequired" BOOLEAN NOT NULL DEFAULT false,
  "acknowledgedBy" TEXT,
  "acknowledgedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonitoringAlert_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MonitoringAlert_severity_idx" ON "MonitoringAlert"("severity");
CREATE INDEX "MonitoringAlert_type_idx" ON "MonitoringAlert"("type");
CREATE INDEX "MonitoringAlert_sourceId_idx" ON "MonitoringAlert"("sourceId");
CREATE INDEX "MonitoringAlert_createdAt_idx" ON "MonitoringAlert"("createdAt");
CREATE INDEX "MonitoringAlert_resolvedAt_idx" ON "MonitoringAlert"("resolvedAt");
ALTER TABLE "MonitoringAlert" ADD CONSTRAINT "MonitoringAlert_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RegulatorySource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RuleCalculation" (
  "id" TEXT NOT NULL,
  "ruleVersionId" TEXT NOT NULL,
  "tableKey" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "result" JSONB NOT NULL,
  "referenceDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RuleCalculation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RuleCalculation_tableKey_idx" ON "RuleCalculation"("tableKey");
CREATE INDEX "RuleCalculation_ruleVersionId_idx" ON "RuleCalculation"("ruleVersionId");
CREATE INDEX "RuleCalculation_referenceDate_idx" ON "RuleCalculation"("referenceDate");
ALTER TABLE "RuleCalculation" ADD CONSTRAINT "RuleCalculation_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "RuleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RolePermission" (
  "id" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "permissionId" TEXT NOT NULL,
  "grantedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RolePermission_role_permissionId_key" ON "RolePermission"("role", "permissionId");
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SegmentFeatureTarget" (
  "id" TEXT NOT NULL,
  "segmentId" TEXT NOT NULL,
  "flagId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SegmentFeatureTarget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SegmentFeatureTarget_segmentId_flagId_key" ON "SegmentFeatureTarget"("segmentId", "flagId");
CREATE INDEX "SegmentFeatureTarget_segmentId_idx" ON "SegmentFeatureTarget"("segmentId");
CREATE INDEX "SegmentFeatureTarget_flagId_idx" ON "SegmentFeatureTarget"("flagId");
ALTER TABLE "SegmentFeatureTarget" ADD CONSTRAINT "SegmentFeatureTarget_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "UserSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SegmentFeatureTarget" ADD CONSTRAINT "SegmentFeatureTarget_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SegmentMembershipHistory" (
  "id" TEXT NOT NULL,
  "segmentId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "joined" BOOLEAN NOT NULL,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attributeSnapshot" JSONB,
  CONSTRAINT "SegmentMembershipHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SegmentMembershipHistory_segmentId_idx" ON "SegmentMembershipHistory"("segmentId");
CREATE INDEX "SegmentMembershipHistory_companyId_idx" ON "SegmentMembershipHistory"("companyId");
CREATE INDEX "SegmentMembershipHistory_evaluatedAt_idx" ON "SegmentMembershipHistory"("evaluatedAt");
ALTER TABLE "SegmentMembershipHistory" ADD CONSTRAINT "SegmentMembershipHistory_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "UserSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

## Prisma Schema Changes

Remove from `prisma/schema.prisma`:

```prisma
// DELETE: model ExperimentSegment (lines ~5454-5467)
// DELETE: model MonitoringAlert (lines ~4605-4626)
// DELETE: model RuleCalculation (lines ~4178-4192)
// DELETE: model RolePermission (lines ~5246-5257)
// DELETE: model SegmentFeatureTarget (lines ~5399-5420)
// DELETE: model SegmentMembershipHistory (lines ~5380-5396)
```

Also remove relations from parent models:

```prisma
// In model Experiment:
// DELETE: segments ExperimentSegment[]

// In model UserSegment:
// DELETE: experiments ExperimentSegment[]
// DELETE: targets SegmentFeatureTarget[]
// DELETE: membershipHistory SegmentMembershipHistory[]

// In model FeatureFlag:
// DELETE: segmentTargets SegmentFeatureTarget[]

// In model RuleVersion:
// DELETE: calculations RuleCalculation[]

// In model Permission:
// DELETE: rolePermissions RolePermission[]

// In model RegulatorySource:
// DELETE: monitoringAlerts MonitoringAlert[]
```

## Post-Migration Verification

```sql
-- Verify tables are gone
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'ExperimentSegment', 'MonitoringAlert', 'RuleCalculation',
  'RolePermission', 'SegmentFeatureTarget', 'SegmentMembershipHistory'
);
-- Expected: 0 rows
```

## Staging Smoke Test Checklist

| Flow    | Action                       | Expected Result                       | Status |
| ------- | ---------------------------- | ------------------------------------- | ------ |
| Auth    | Login with email/password    | Success                               | [ ]    |
| Auth    | Logout                       | Success                               | [ ]    |
| Auth    | Password reset request       | Email sent, VerificationToken created | [ ]    |
| Auth    | Passkey login                | Success (WebAuthnCredential used)     | [ ]    |
| RTL     | Run sentinel discovery       | Evidence created                      | [ ]    |
| RTL     | Trigger watchdog check       | WatchdogAudit row created             | [ ]    |
| Webhook | Process regulatory webhook   | WebhookEvent created                  | [ ]    |
| Email   | Send to previously bounced   | EmailSuppression checked              | [ ]    |
| Cron    | Trigger failing cron job     | CronJobError logged                   | [ ]    |
| Banking | Import duplicate transaction | PotentialDuplicate created            | [ ]    |
| Build   | `npm run build`              | Success, no errors                    | [ ]    |
| Tests   | `npm test`                   | All pass                              | [ ]    |
| Prisma  | `npx prisma generate`        | Success                               | [ ]    |
