# RuleVersion Migration Status

> Last updated: 2026-01-04

## Current Production State

| Setting               | Value             |
| --------------------- | ----------------- |
| `RULE_VERSION_SOURCE` | `regulatory`      |
| Dual mode             | Disabled          |
| Source of truth       | Regulatory schema |

## Completed

- [x] RuleVersion data copied to regulatory schema
- [x] Dual-mode instrumentation deployed
- [x] Parity validation (420 reads, zero mismatches)
- [x] Production cutover to regulatory mode
- [x] Core reads confirmed at zero

## Intentionally Deferred

- [ ] Core RuleVersion table removal (PR#1306)
- [ ] Compatibility store removal

## Merge Condition for PR#1306

PR#1306 may be merged when:

- Stability window elapsed (48h recommended), OR
- Explicit platform owner approval

No regressions must be observed before merge.

## Rollback Procedure

If issues arise:

```bash
# Immediate rollback - no data changes needed
RULE_VERSION_SOURCE=core
```

Redeploy. Core data remains intact.

## Guardrails Active

- ESLint rule blocks direct `db.ruleVersion` access
- CI grep check prevents forbidden patterns
- Compatibility store preserved for rollback
