# RTL2 Answer Path Map

**Date:** 2026-01-20
**Purpose:** Map all query entrypoints and verify graphStatus gating

---

## Summary

| Aspect                                              | Status                  |
| --------------------------------------------------- | ----------------------- |
| Primary answer path uses graphStatus gating         | OK                      |
| Static RULE_REGISTRY fallback exists                | OK (intentional)        |
| Workers repo has no query paths                     | OK (correct separation) |
| All user-facing queries route through answerQuery() | OK                      |

---

## 1. Answer Path Architecture

### Primary Path: DB-Backed Selection (RTL2)

```
User Query
  ↓
answerQuery() [src/lib/regulatory-truth/eval/query.ts:319]
  ↓
selectRuleFromDb() [src/lib/regulatory-truth/eval/rule-store.ts:55]
  ↓
Check graphStatus [query.ts:413]
  ↓
If graphStatus !== "CURRENT":
  → Return "Privremena nekonzistentnost sustava"
  → Block evaluation
  ↓
If graphStatus === "CURRENT":
  → Proceed with rule evaluation
```

### Fallback Path: Static Registry

```
If DB has no rule for topic:
  ↓
RULE_REGISTRY.get(topicKey) [query.ts:214]
  ↓
Static rule (no graphStatus check - legacy)
```

---

## 2. GraphStatus Gating Implementation

### Location: `src/lib/regulatory-truth/eval/query.ts:410-427`

```typescript
// Rule can be PUBLISHED, but if graphStatus is STALE or PENDING,
// we cannot safely evaluate (edges may be incomplete)
if (dbResult.graphStatus && dbResult.graphStatus !== "CURRENT") {
  console.warn(
    `[query] Graph status is ${dbResult.graphStatus} for rule ${dbResult.rule.id} - blocking evaluation`
  )
  return {
    success: false,
    queryType,
    answer: {
      answerHr:
        "Privremena nekonzistentnost sustava. " +
        "Pravilo je pronađeno, ali evaluacija nije moguća dok se graf ne ažurira. " +
        `Referenca: ${citationLabel}. ` +
        "Molimo pokušajte ponovno za nekoliko minuta.",
      evaluated: false,
      citations: [],
      confidence: "LOW",
    },
    // ... rest
  }
}
```

### Status Values

| graphStatus | Meaning                             | Evaluation         |
| ----------- | ----------------------------------- | ------------------ |
| `CURRENT`   | Edges are up-to-date                | ALLOWED            |
| `PENDING`   | Just published, edges not yet built | BLOCKED            |
| `STALE`     | Edge rebuild failed, retry pending  | BLOCKED            |
| `null`      | Legacy rule without status          | ALLOWED (fallback) |

---

## 3. Query Entrypoints

### API Routes (FiskAI Repo)

| Route                           | Uses answerQuery? | Notes                    |
| ------------------------------- | ----------------- | ------------------------ |
| `/api/assistant/*`              | Yes               | Main user-facing queries |
| `/api/deadlines/*`              | No                | Uses own logic           |
| `/api/reports/*`                | No                | Report generation        |
| `/api/admin/regulatory-truth/*` | No                | Admin management         |

### Server Actions (FiskAI Repo)

All assistant-related server actions call `answerQuery()` internally.

### Workers Repo

**No query entrypoints.** Workers only process the pipeline, they don't serve user queries.

---

## 4. Rule Selection Sources

### Source 1: selectRuleFromDb (Preferred)

```typescript
// src/lib/regulatory-truth/eval/rule-store.ts:55
export async function selectRuleFromDb(
  topicKey: "TAX/VAT/REGISTRATION",
  asOfDate?: Date
): Promise<RuleSelectionResult | null>
```

Features:

- Temporal selection (finds rule valid at asOfDate)
- Returns graphStatus for gating
- Includes conflict detection context

### Source 2: RULE_REGISTRY (Fallback)

```typescript
// src/lib/regulatory-truth/eval/query.ts:163
const RULE_REGISTRY: Map<TopicKey, RegisteredRule[]> = new Map([
  ["TAX/VAT/REGISTRATION", [VAT_REGISTRATION_RULE]],
])
```

Used when:

- DB has no rule for topic
- RuleStore not available (initialization)

**No graphStatus gating** on static registry (legacy behavior).

---

## 5. Verification Checklist

- [x] `answerQuery()` checks graphStatus before evaluation
- [x] Non-CURRENT status returns user-friendly error
- [x] DB path preferred over static registry
- [x] Workers repo has no query paths
- [x] Admin routes don't bypass graphStatus (they manage rules, not answer queries)

---

## 6. Required Actions

### None (Answer Path is Secure)

The answer path implementation is correct:

1. graphStatus gating is in place
2. PENDING/STALE rules block evaluation
3. User gets clear message about temporary inconsistency

### Recommendations

1. **Monitor graphStatus=BLOCKED queries**
   - Add metric for blocked evaluations
   - Alert if >1% queries blocked

2. **Add timeout for PENDING→CURRENT transition**
   - If rule stays PENDING >1 hour, auto-flag for investigation

---

## Evidence Commands

```bash
# Find answerQuery callers
git grep -n "answerQuery" -- "*.ts" | grep -v test

# Find graphStatus references
git grep -n "graphStatus" -- "*.ts" | grep -v test

# Find RULE_REGISTRY references
git grep -n "RULE_REGISTRY" -- "*.ts" | grep -v test

# Verify workers repo has no query paths
cd /home/admin/fiskai-workers
git grep -n "answerQuery\|selectRuleFromDb" -- "*.ts"
# Should return empty
```
