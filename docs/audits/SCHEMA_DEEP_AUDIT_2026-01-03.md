# Prisma Schema Deep Audit - 2026-01-03

## Executive Summary

After deep audit of 201 models, **only 3 models are truly safe to remove** as a cluster:

| Model          | DB Rows | Code Refs | Reason                |
| -------------- | ------- | --------- | --------------------- |
| TravelOrder    | 0       | 0         | Unimplemented feature |
| MileageLog     | 0       | 0         | Unimplemented feature |
| PersonSnapshot | 0       | 0         | Unimplemented feature |

These 3 models form the **Travel/Mileage Expenses module** which was never implemented.

## What I Checked

1. **Direct DB access** (`db.modelName` pattern) - Prisma client calls
2. **Relation access** (`include: { modelName }`) - Nested queries
3. **Type references** - Import statements and type usage
4. **DB row counts** - Production data presence
5. **FK dependencies** - Parent/child relationships
6. **Drizzle schema overlap** - Models managed by Drizzle ORM

## False Positives Explained

### Models with 0 `db.X` hits but ACTUALLY USED:

| Model                                          | Actual Usage                              |
| ---------------------------------------------- | ----------------------------------------- |
| SupportTicketAttachment                        | Child of SupportTicket (72 refs)          |
| JoppdSubmissionEvent                           | Child of JoppdSubmission (3 refs)         |
| RuleVersion, RuleCalculation, MonitoringAlert  | RTL system (179 refs to parent)           |
| RolePermission, SegmentMembershipHistory, etc. | Feature flag system (20 refs via service) |
| ExperimentSegment, ExperimentVariant, etc.     | Experiments system (22 refs via service)  |
| pausalni_profile, eu_vendor, etc.              | Drizzle-managed (active via Drizzle ORM)  |
| ChartOfAccounts, TrialBalance, etc.            | Listed in TENANT_MODELS for isolation     |

### Drizzle-Managed Tables (DO NOT REMOVE from Prisma)

These appear "unused" in Prisma but are actively accessed via Drizzle ORM:

- `pausalni_profile` (2 rows)
- `eu_vendor`
- `eu_transaction`
- `payment_obligation`
- `generated_form`
- `notification_preference`
- `user_guidance_preferences` (3 rows)
- `checklist_interactions`
- `newsletter_subscriptions`
- `news_*` tables
- `compliance_deadlines`

## Recommended Action

### PR#2: Remove Travel/Mileage Module (3 models)

```sql
-- Migration: Remove unimplemented Travel/Mileage module
DROP TABLE IF EXISTS "PersonSnapshot" CASCADE;
DROP TABLE IF EXISTS "MileageLog" CASCADE;
DROP TABLE IF EXISTS "TravelOrder" CASCADE;
```

Also remove from `prisma/schema.prisma`:

- `model TravelOrder { ... }`
- `model MileageLog { ... }`
- `model PersonSnapshot { ... }`

And remove relation fields from:

- `User` model (travelOrders, mileageLogs, personSnapshots relations)
- `Company` model (travelOrders, mileageLogs relations)
- `RegulatoryRuleVersion` model (travelOrdersPerDiem relation)
- `Vehicle` model (mileageLogs relation)

### Impact Analysis

- **Token savings**: ~150 lines (~300 tokens)
- **Risk**: LOW - 0 code refs, 0 DB rows
- **Rollback**: Can re-add models if travel module is implemented

## Schema Metrics

| Metric | Before | After PR#2 |
| ------ | ------ | ---------- |
| Models | 201    | 198        |
| Enums  | 140    | 140        |
| Lines  | 5,855  | ~5,700     |

## Next Steps

1. Create PR#2 for Travel/Mileage removal
2. Consider refactoring Drizzle/Prisma overlap (technical debt)
3. Future: Remove remaining 0-row child tables when parent features mature
