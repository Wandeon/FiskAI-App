# PR#5: RTL Model Migration Plan

> **Status:** READY FOR REVIEW
> **Created:** 2026-01-03
> **Prerequisite:** PR#4 (dual-client scaffolding) must be merged first

## Executive Summary

Move RTL models from `prisma/schema.prisma` to `prisma/regulatory.prisma` and switch RTL code to use `dbReg` instead of `db`.

**Strategy:** Start with models that have ZERO core dependencies, then progressively migrate models with soft-ref conversions.

---

## Pre-Migration Checklist

- [x] Guardrail 1: `REGULATORY_DATABASE_URL` required in production
- [x] Guardrail 2: ESLint import boundary blocks `db` in RTL modules
- [ ] Merge PR#4 (dual-client scaffolding)
- [ ] Add `REGULATORY_DATABASE_URL` to Coolify (can be same as `DATABASE_URL` initially)

---

## Model Dependency Analysis

### Batch 1: ZERO Core Dependencies (Safe First)

These models reference only other RTL models. Move these first.

| Model                     | Lines | RTL Dependencies         | Notes                            |
| ------------------------- | ----- | ------------------------ | -------------------------------- |
| `RegulatorySource`        | ~90   | None                     | Root source registry             |
| `Evidence`                | ~60   | RegulatorySource         | Central hub (10+ inverse refs)   |
| `EvidenceArtifact`        | ~30   | Evidence                 | OCR outputs, PDFs                |
| `SourcePointer`           | ~40   | Evidence, RegulatoryRule | Links evidence to rules          |
| `ExtractionRejected`      | ~20   | Evidence                 | Error log for failed extractions |
| `ConflictResolutionAudit` | ~25   | None (uses string IDs)   | Audit trail                      |
| `MonitoringAlert`         | ~30   | RegulatorySource         | System alerts                    |

**Migration order:** RegulatorySource → Evidence → EvidenceArtifact → SourcePointer → ExtractionRejected → ConflictResolutionAudit → MonitoringAlert

### Batch 2: RTL-Only Dependencies (Medium Risk)

| Model                   | Lines | Dependencies                | Notes                 |
| ----------------------- | ----- | --------------------------- | --------------------- |
| `AtomicClaim`           | ~40   | Evidence, RegulatoryRule    | Core fact extraction  |
| `RegulatoryConflict`    | ~25   | RegulatoryRule              | Conflict tracking     |
| `GraphEdge`             | ~20   | RegulatoryRule              | Knowledge graph edges |
| `RuleRelease`           | ~30   | RegulatoryRule              | Publishing batches    |
| `RegulatoryProcess`     | ~50   | Evidence                    | Process extraction    |
| `ReferenceTable`        | ~30   | Evidence                    | Reference data        |
| `RegulatoryAsset`       | ~30   | Evidence, RegulatoryProcess | Asset extraction      |
| `TransitionalProvision` | ~25   | Evidence                    | Transition rules      |
| `CoverageReport`        | ~20   | Evidence                    | Coverage tracking     |
| `ComparisonMatrix`      | ~25   | Evidence                    | Comparison extraction |

### Batch 3: Requires Soft-Ref Conversion (High Risk)

| Model             | Core Deps                                             | Action Required                            |
| ----------------- | ----------------------------------------------------- | ------------------------------------------ |
| `RegulatoryRule`  | `Concept` (optional)                                  | Convert to `conceptId: String?` without FK |
| `RuleVersion`     | Inverse: PayoutLine, JoppdSubmissionLine, TravelOrder | Move to core OR remove inverse relations   |
| `ReviewQueueItem` | `Company`, `User` x3                                  | Convert to soft refs OR keep in core       |

**Critical Decision:** `ReviewQueueItem` has 3 User relations and 1 Company relation. Options:

1. **Keep in core:** It's a workflow model that bridges business and regulatory
2. **Move with soft refs:** Convert `companyId`, `requestedById`, `assignedToId`, `completedById` to strings

**Recommendation:** Keep `ReviewQueueItem` in core for now. It's a workflow orchestration table, not pure RTL data.

---

## Data Migration Strategy

### Current State

- All RTL tables exist in the same database as core
- Data is already in place

### Migration Path (Variant B → A)

**Phase 1 (PR#5):** Same database, same tables

- Both `DATABASE_URL` and `REGULATORY_DATABASE_URL` point to same DB
- Models move from core schema to regulatory schema
- No data migration needed
- Generate regulatory client to see the moved models

**Phase 2 (Future):** Separate database

- Create new regulatory database
- Copy RTL data using pg_dump/restore
- Update `REGULATORY_DATABASE_URL` to point to new DB
- This is configuration-only (no code changes)

---

## Code Migration

### Files to Update (91+ files)

All files in `src/lib/regulatory-truth/**` that import `db` from `@/lib/db` must:

1. Change import to `dbReg` from `@/lib/db/regulatory`
2. Update all `db.` calls to `dbReg.`

**Script approach:**

```bash
# Find all files
grep -rl 'from "@/lib/db"' src/lib/regulatory-truth/

# Automated replacement (after model move)
sed -i 's/from "@\/lib\/db"/from "@\/lib\/db\/regulatory"/g' file.ts
sed -i 's/{ db }/{ dbReg }/g' file.ts
sed -i 's/db\./dbReg./g' file.ts
```

### Files that import `runWithRegulatoryContext`

These 4 files also import regulatory utilities:

- `quarantine-legacy-provenance.ts`
- `reviewer.ts`
- `releaser.ts`
- `trusted-source-stage.ts`
- `rule-status-service.ts`

These should continue importing from `@/lib/db` for the regulatory context utilities, but use `dbReg` for database access.

---

## Enum Strategy

### RTL-Specific Enums (Move to regulatory.prisma)

- `EvidenceStatus`
- `ContentClassification`
- `RuleStatus`
- `ExtractionShape`
- `ReviewDecision`
- `AlertType`
- etc.

### Shared Enums (Keep in core, duplicate in regulatory if needed)

- None identified - RTL enums are self-contained

---

## PR#5 Scope (First Batch Only)

### What to move in PR#5

1. `RegulatorySource` model + enum
2. `Evidence` model + `EvidenceStatus` enum
3. `EvidenceArtifact` model
4. `SourcePointer` model
5. `ExtractionRejected` model
6. `ConflictResolutionAudit` model
7. `MonitoringAlert` model + `AlertType` enum

### What NOT to move in PR#5

- `RegulatoryRule` (has Concept FK)
- `RuleVersion` (has core inverse relations)
- `ReviewQueueItem` (stays in core)
- Any model with core dependencies

### PR#5 Deliverables

1. Move 7 models from `schema.prisma` to `regulatory.prisma`
2. Move associated enums
3. Update ~20-30 RTL files to use `dbReg`
4. Add integration test that queries both clients
5. Verify `prisma:generate` produces both clients
6. Update CI to run migrations for both schemas

---

## Testing Requirements

1. **Unit tests:** Verify `dbReg.evidence.findMany()` works
2. **Integration test:** Query core table + RTL table in same request
3. **CI:** Generate both clients, run migrations, typecheck

---

## Rollback Plan

If issues arise:

1. Revert PR to restore models to core schema
2. `REGULATORY_DATABASE_URL` fallback ensures same-DB behavior
3. No data loss (tables unchanged, only schema definition moves)

---

## Appendix: Model Line Numbers (for reference)

| Model                   | Line in schema.prisma |
| ----------------------- | --------------------- |
| ReviewQueueItem         | 329                   |
| RegulatorySource        | ~3853                 |
| Evidence                | 3944                  |
| EvidenceArtifact        | 4003                  |
| SourcePointer           | 4019                  |
| RegulatoryRule          | 4099                  |
| RuleVersion             | 4172                  |
| RuleCalculation         | 4207                  |
| AtomicClaim             | 4227                  |
| RegulatoryProcess       | 4321                  |
| ReferenceTable          | 4379                  |
| RegulatoryAsset         | 4426                  |
| TransitionalProvision   | 4468                  |
| GraphEdge               | 4547                  |
| RuleRelease             | 4565                  |
| RegulatoryConflict      | 4610                  |
| MonitoringAlert         | 4634                  |
| ConflictResolutionAudit | 4679                  |
| ExtractionRejected      | 4936                  |
| CoverageReport          | 5025                  |
| ComparisonMatrix        | 5069                  |
