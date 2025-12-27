# AUDIT 6: Arbiter (Conflict Resolution)

**Audit Date:** 2025-12-27
**Auditor:** Claude Code (Opus 4.5)
**Overall Status:** ⚠️ WARN

---

## Executive Summary

The Arbiter conflict resolution system is well-designed with proper authority hierarchy implementation and comprehensive escalation logic. However, several issues were identified that could affect conflict resolution quality.

**Database queries could not be executed** - Docker is unavailable in this environment. Manual verification of conflict statistics is required.

---

## Files Reviewed

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/regulatory-truth/agents/arbiter.ts` | Main arbiter implementation | ✅ Reviewed |
| `src/lib/regulatory-truth/schemas/arbiter.ts` | Input/output validation | ✅ Reviewed |
| `src/lib/regulatory-truth/utils/conflict-detector.ts` | Structural conflict detection | ✅ Reviewed |
| `src/lib/regulatory-truth/taxonomy/precedence-builder.ts` | Graph edge management | ✅ Reviewed |
| `src/lib/regulatory-truth/prompts/index.ts` | ARBITER_PROMPT | ✅ Reviewed |
| `src/lib/regulatory-truth/taxonomy/graph-edges.ts` | Not found (referenced in audit) | ❌ Missing |

---

## Check 1: Authority Hierarchy Implementation

### Status: ✅ PASS

The authority hierarchy is correctly implemented in `arbiter.ts:32-45`:

```typescript
export function getAuthorityScore(level: AuthorityLevel): number {
  switch (level) {
    case "LAW":       return 1  // Highest
    case "GUIDANCE":  return 2
    case "PROCEDURE": return 3
    case "PRACTICE":  return 4  // Lowest
    default:          return 999
  }
}
```

**Verification:** Lower score = higher authority, correctly matching LAW (1) > GUIDANCE (2) > PROCEDURE (3) > PRACTICE (4).

### ARBITER_PROMPT Legal Hierarchy

The prompt (`prompts/index.ts:350-357`) defines a comprehensive Croatian legal hierarchy:

```
1. Ustav RH (Constitution)
2. Zakon (Parliamentary law - Narodne novine)
3. Podzakonski akt (Government regulations)
4. Pravilnik (Ministry rules)
5. Uputa (Tax authority guidance - Porezna uprava)
6. Mišljenje (Official interpretations)
7. Praksa (Established practice)
```

### Issue Found

**⚠️ WARN:** Authority rank mismatch between files:

- `conflict-detector.ts:258-265` includes `REGULATION: 2` in ranks
- `arbiter.ts` does not handle `REGULATION` authority level
- Prisma schema `AuthorityLevel` enum should be verified

---

## Check 2: Escalation Logic

### Status: ✅ PASS

Comprehensive escalation criteria in `arbiter.ts:394-440`:

| Condition | Threshold | Result |
|-----------|-----------|--------|
| Low confidence in resolution | < 0.8 | Escalate |
| Both rules are T0 (critical) | T0 vs T0 | Escalate |
| Equal authority levels + hierarchy strategy | score_A == score_B | Escalate |
| Same effective dates + temporal strategy | date_A == date_B | Escalate |
| Either rule has low confidence | < 0.85 | Escalate |

**Unit Tests:** Escalation logic is well-tested in `__tests__/arbiter.test.ts`:
- Lines 95-127: Low confidence escalation test
- Lines 129-161: T0 conflict escalation test
- Lines 70-76: Equal authority level detection

---

## Check 3: Resolution Strategies

### Status: ✅ PASS

Four resolution strategies implemented (`schemas/arbiter.ts:27-33`):

1. **hierarchy** - Higher authority source wins
2. **temporal** - Later effective date wins (lex posterior)
3. **specificity** - More specific rule wins (lex specialis)
4. **conservative** - When uncertain, choose stricter interpretation

### Resolution Flow

1. LLM determines winning rule and strategy
2. Business rules checked via `checkEscalationCriteria()`
3. Conflict updated with resolution or escalated
4. Losing rule marked `DEPRECATED` with `supersededBy` reference (`arbiter.ts:354-379`)

---

## Check 4: Graph Edge Consistency

### Status: ⚠️ WARN

### OVERRIDES Edge Implementation

`precedence-builder.ts` correctly manages OVERRIDES edges:

```typescript
// Finding rules that override a given rule
export async function findOverridingRules(ruleId: string): Promise<string[]>

// Finding rules that a given rule overrides
export async function findOverriddenRules(ruleId: string): Promise<string[]>

// Transitive override check with cycle prevention
export async function doesOverride(ruleAId: string, ruleBId: string): Promise<boolean>
```

### GraphEdge Schema

From `prisma/schema.prisma:1634-1642`:

```prisma
enum GraphEdgeType {
  AMENDS
  INTERPRETS
  REQUIRES
  EXEMPTS
  DEPENDS_ON
  SUPERSEDES
  OVERRIDES      // Lex specialis - specific overrides general
}
```

### Issues Found

1. **⚠️ WARN: Missing acyclicity validation**

   When creating OVERRIDES/SUPERSEDES edges, there's no explicit check to prevent cycles. The `doesOverride()` function uses a `visited` Set to prevent infinite loops during traversal, but cycles can still be created in the graph.

   **Risk:** Circular supersession could cause infinite loops or incorrect precedence resolution.

   **Recommendation:** Add cycle detection before creating new edges:
   ```typescript
   // Before creating: A overrides B
   if (await doesOverride(ruleBId, ruleAId)) {
     throw new Error("Cannot create OVERRIDES edge: would create cycle")
   }
   ```

2. **⚠️ WARN: Missing graph-edges.ts file**

   The audit prompt references `src/lib/regulatory-truth/taxonomy/graph-edges.ts` but this file does not exist. Graph edge logic is in `precedence-builder.ts` instead.

---

## Check 5: SOURCE_CONFLICT Handling

### Status: ✅ PASS

SOURCE_CONFLICT types are handled specially (`arbiter.ts:95-194`):

1. Conflicts with `conflictType === "SOURCE_CONFLICT"` auto-escalate to human review
2. Source pointer metadata is preserved in resolution
3. Audit event logged with `CONFLICT_ESCALATED` action

This is appropriate as source-level conflicts (conflicting values in source data) require human judgment.

---

## Check 6: Conflict Type Mapping

### Status: ⚠️ WARN

### Prisma Schema Conflict Types

```prisma
enum ConflictType {
  SOURCE_CONFLICT
  TEMPORAL_CONFLICT
  SCOPE_CONFLICT
  INTERPRETATION_CONFLICT
}
```

### Conflict Detector Internal Types

`conflict-detector.ts:6-11`:
```typescript
export interface ConflictSeed {
  type: "VALUE_MISMATCH" | "DATE_OVERLAP" | "AUTHORITY_SUPERSEDE" | "CROSS_SLUG_DUPLICATE"
  // ...
}
```

### Mapping Issues

The `mapConflictType()` function (`conflict-detector.ts:315-329`) maps internal types to DB enums:

| Internal Type | DB Enum | Issue |
|--------------|---------|-------|
| VALUE_MISMATCH | SOURCE_CONFLICT | ✅ |
| DATE_OVERLAP | TEMPORAL_CONFLICT | ✅ |
| AUTHORITY_SUPERSEDE | TEMPORAL_CONFLICT | ⚠️ Semantic mismatch |
| CROSS_SLUG_DUPLICATE | RULE_CONFLICT | ❌ **Not in DB enum** |

**❌ FAIL:** `CROSS_SLUG_DUPLICATE` maps to `RULE_CONFLICT` but `RULE_CONFLICT` does not exist in the Prisma `ConflictType` enum. This would cause a database error when trying to insert such conflicts.

---

## Check 7: Test Coverage

### Status: ✅ PASS

Two test files provide coverage:

1. **`arbiter.test.ts`** - Unit tests for:
   - Schema validation
   - Authority scoring
   - Escalation criteria

2. **`arbiter-e2e.test.ts`** - E2E tests for:
   - Full conflict resolution flow
   - AgentRun record creation
   - Authority hierarchy resolution

---

## Database Queries (Not Executed)

The following queries could not be run due to Docker unavailability:

```sql
-- Conflict statistics
SELECT status, "conflictType", "resolutionStrategy", COUNT(*)
FROM "RegulatoryConflict"
GROUP BY status, "conflictType", "resolutionStrategy";

-- Open conflicts
SELECT id, "conflictType", "ruleAId", "ruleBId", status, "resolutionStrategy"
FROM "RegulatoryConflict"
WHERE status = 'OPEN'
ORDER BY "createdAt" ASC LIMIT 10;

-- Authority hierarchy violations (should return 0 rows)
SELECT rc.id, ra."authorityLevel" as rule_a_auth, rb."authorityLevel" as rule_b_auth
FROM "RegulatoryConflict" rc
JOIN "RegulatoryRule" ra ON rc."ruleAId" = ra.id
JOIN "RegulatoryRule" rb ON rc."ruleBId" = rb.id
WHERE rc.status = 'RESOLVED'
AND rc."resolutionStrategy" = 'RULE_A_PREVAILS'
AND ra."authorityLevel" > rb."authorityLevel";
```

**Action Required:** Run these queries manually to verify:
1. Open conflict backlog size and age
2. Escalation rate (should be <10%)
3. No authority hierarchy violations

---

## Issues Summary

| ID | Severity | Description | Location |
|----|----------|-------------|----------|
| ARB-001 | ⚠️ WARN | REGULATION authority level not handled in arbiter | `arbiter.ts:32-45` |
| ARB-002 | ⚠️ WARN | No acyclicity validation for graph edges | `precedence-builder.ts` |
| ARB-003 | ❌ FAIL | RULE_CONFLICT not in ConflictType enum | `conflict-detector.ts:326` |
| ARB-004 | ⚠️ WARN | AUTHORITY_SUPERSEDE mapped to TEMPORAL_CONFLICT | `conflict-detector.ts:319-320` |
| ARB-005 | ℹ️ INFO | graph-edges.ts file missing | N/A |

---

## Recommendations

### Critical (Must Fix)

1. **Add RULE_CONFLICT to Prisma ConflictType enum**
   ```prisma
   enum ConflictType {
     SOURCE_CONFLICT
     TEMPORAL_CONFLICT
     SCOPE_CONFLICT
     INTERPRETATION_CONFLICT
     RULE_CONFLICT  // Add this
   }
   ```

### High Priority

2. **Add cycle detection before creating OVERRIDES edges**
   ```typescript
   async function createOverridesEdge(fromId: string, toId: string) {
     if (await doesOverride(toId, fromId)) {
       throw new Error("Cannot create edge: would create cycle");
     }
     // proceed with creation
   }
   ```

3. **Align authority levels between files**
   - Either add REGULATION to `arbiter.ts:getAuthorityScore()`
   - Or remove from `conflict-detector.ts:getAuthorityRank()`

### Medium Priority

4. **Add authority hierarchy violation check**
   - Run scheduled query to detect violations
   - Alert if RULE_A_PREVAILS but A has lower authority than B

5. **Create semantic conflict type for authority supersession**
   - AUTHORITY_SUPERSEDE being mapped to TEMPORAL_CONFLICT loses semantic meaning

---

## Audit Conclusion

**Overall Status: ⚠️ WARN**

The Arbiter conflict resolution system has a solid foundation with:
- Correct authority hierarchy implementation
- Comprehensive escalation logic
- Good test coverage
- Proper audit logging

However, the critical issue with `RULE_CONFLICT` enum mismatch needs immediate attention as it would cause runtime errors. The missing acyclicity validation is a potential edge case that could cause issues in production.

**Next Steps:**
1. Fix the RULE_CONFLICT enum issue
2. Add acyclicity validation
3. Run database queries manually to verify conflict statistics
4. Verify escalation rate is within acceptable bounds (<10%)
