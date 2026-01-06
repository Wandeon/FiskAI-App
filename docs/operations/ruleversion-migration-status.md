# RuleVersion Migration Status

> Last updated: 2026-01-06
> Status: **COMPLETE**

## Final State

| Setting               | Value              |
| --------------------- | ------------------ |
| `RULE_VERSION_SOURCE` | REMOVED (no longer needed) |
| Dual mode             | REMOVED            |
| Source of truth       | Regulatory schema  |
| Core RuleVersion      | REMOVED from schema |

## Migration Track Complete

All phases of the RuleVersion migration track have been completed:

- [x] RuleVersion data copied to regulatory schema (PR#10)
- [x] Dual-mode instrumentation deployed (PR#10)
- [x] Parity validation (420 reads, zero mismatches)
- [x] Production cutover to regulatory mode (2026-01-04)
- [x] Core reads confirmed at zero
- [x] 48h stability window elapsed
- [x] PR#1306 merged with evidence
- [x] Core RuleVersion bundle removed from schema (PR#1306 cleanup)
- [x] Dual-mode code removed (ruleversion-store simplified)
- [x] TravelOrder FK relations converted to soft refs

## Guardrails Remain Active

The following guardrails prevent regression:

- `scripts/check-no-direct-core-ruleversion.ts` - CI guardrail blocks `db.ruleVersion` usage
- `scripts/check-no-ruleversion-relations.ts` - Prevents FK relations to RuleVersion
- `scripts/check-legacy-secrets.ts` - Ensures no legacy secret access

## Architecture Now

```
RuleVersion data flow:
  - Reads:  src/lib/fiscal-rules/ruleversion-store.ts (dbReg only)
  - Writes: src/lib/fiscal-rules/service.ts (dbReg only)
  - Schema: prisma/regulatory.prisma (RuleTable, RuleVersion, RuleSnapshot, RuleCalculation)
```

## Archive Note

This migration track is closed. The following docs can be archived:

- docs/operations/ruleversion-cutover-exit-criteria.md
- docs/operations/runbook-ruleversion-migration.md
- docs/operations/ruleversion-migration-runbook.md
- docs/plans/2026-01-03-pr9-ruleversion-relation-removal.md
