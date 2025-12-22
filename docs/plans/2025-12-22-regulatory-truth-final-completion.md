# Regulatory Truth Layer - Final Completion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete all remaining gaps for external audit readiness.

**Tech Stack:** Next.js 15, Prisma 7, PostgreSQL, TypeScript

---

## Task 1: Add Knowledge Graph Population to Composer

**Files:**

- Modify: `src/lib/regulatory-truth/agents/composer.ts`

**Step 1: Add Concept upsert after rule creation**

After the rule is created (around line 148), add:

```typescript
// Create or update Concept for this rule
const concept = await db.concept.upsert({
  where: { slug: draftRule.concept_slug },
  create: {
    slug: draftRule.concept_slug,
    nameHr: draftRule.title_hr,
    nameEn: draftRule.title_en,
    description: draftRule.explanation_hr,
    tags: [draftRule.risk_tier, authorityLevel],
  },
  update: {
    // Update names if they're longer/better
    nameHr: draftRule.title_hr,
    nameEn: draftRule.title_en,
  },
})

// Link rule to concept
await db.regulatoryRule.update({
  where: { id: rule.id },
  data: { conceptId: concept.id },
})
```

**Step 2: Add GraphEdge for supersedes relationship**

```typescript
// Create AMENDS edge if this rule supersedes another
if (draftRule.supersedes) {
  await db.graphEdge.create({
    data: {
      fromId: rule.id,
      toId: draftRule.supersedes,
      relation: "AMENDS",
      validFrom: rule.effectiveFrom,
    },
  })
}
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/lib/regulatory-truth/agents/composer.ts
git commit -m "feat: populate Knowledge Graph (Concept/GraphEdge) in Composer"
```

---

## Task 2: Fix Stale Rules Calculation

**Files:**

- Modify: `src/lib/regulatory-truth/monitoring/metrics.ts`

**Step 1: Add stale rules query to Promise.all**

At line 59, add to the destructuring:

```typescript
rulesStale,
```

At line 93 (before conflictsOpen), add:

```typescript
// Stale rules (effectiveUntil has passed)
db.regulatoryRule.count({
  where: {
    status: "PUBLISHED",
    effectiveUntil: { lt: new Date() },
  },
}),
```

**Step 2: Update return value**

Change line 124 from:

```typescript
rulesStale: 0, // TODO: Calculate based on effectiveUntil
```

To:

```typescript
rulesStale,
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/lib/regulatory-truth/monitoring/metrics.ts
git commit -m "fix: calculate stale rules based on effectiveUntil"
```

---

## Task 3: Add Alert Email on Pipeline Failure

**Files:**

- Modify: `src/lib/regulatory-truth/scheduler/cron.ts`

**Step 1: Add email import and alert function**

At the top, add:

```typescript
import { Resend } from "resend"
```

Replace the TODO comment (line 31) with:

```typescript
// Send alert email
try {
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "FiskAI <noreply@fiskai.hr>",
    to: process.env.ADMIN_ALERT_EMAIL || "admin@fiskai.hr",
    subject: "🚨 Regulatory Pipeline Failed",
    html: `
      <h2>Overnight Pipeline Failure</h2>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      <p><strong>Error:</strong> ${error instanceof Error ? error.message : String(error)}</p>
      <p><a href="https://admin.fiskai.hr/regulatory">View Dashboard</a></p>
    `,
  })
  console.log("[scheduler] Alert email sent")
} catch (emailError) {
  console.error("[scheduler] Failed to send alert email:", emailError)
}
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/lib/regulatory-truth/scheduler/cron.ts
git commit -m "feat: send alert email on pipeline failure"
```

---

## Task 4: Run End-to-End Pipeline Test

**Step 1: Trigger discovery on one endpoint**

Use the trigger API to run discovery phase:

```bash
curl -X POST http://localhost:3000/api/admin/regulatory-truth/trigger \
  -H "Content-Type: application/json" \
  -d '{"phase": "discovery"}'
```

Or via database script - run Sentinel on first active endpoint.

**Step 2: Check database state**

Verify:

- DiscoveredItem count > 0
- Evidence count increased
- SourcePointer count increased

**Step 3: Run extraction phase**

```bash
curl -X POST http://localhost:3000/api/admin/regulatory-truth/trigger \
  -H "Content-Type: application/json" \
  -d '{"phase": "extraction"}'
```

**Step 4: Run composition phase**

```bash
curl -X POST http://localhost:3000/api/admin/regulatory-truth/trigger \
  -H "Content-Type: application/json" \
  -d '{"phase": "composition"}'
```

**Step 5: Verify Concept created**

```sql
SELECT COUNT(*) FROM "Concept";
-- Should be > 0
```

**Step 6: Run review and release phases**

Continue pipeline to get published rules.

---

## Task 5: Verify All API Endpoints

**Step 1: Test rules search API**

```bash
curl http://localhost:3000/api/rules/search?q=test
```

Expected: JSON with rules array

**Step 2: Test rules evaluate API**

```bash
curl -X POST http://localhost:3000/api/rules/evaluate \
  -H "Content-Type: application/json" \
  -d '{"context": {"annual_revenue": 50000, "asOf": "2025-01-01"}}'
```

Expected: JSON with applicableRules

**Step 3: Test status API**

```bash
curl http://localhost:3000/api/admin/regulatory-truth/status
```

Expected: JSON with metrics

**Step 4: Document results**

Record which endpoints work and any issues found.

---

## Task 6: Final Build and Push

**Step 1: Run full build**

```bash
npm run build
```

**Step 2: Run tests**

```bash
npx tsx --test src/lib/regulatory-truth/__tests__/arbiter.test.ts
npx tsx --test src/lib/regulatory-truth/__tests__/sentinel.test.ts
```

**Step 3: Check database counts**

```sql
SELECT
  (SELECT COUNT(*) FROM "Evidence") as evidence,
  (SELECT COUNT(*) FROM "SourcePointer") as pointers,
  (SELECT COUNT(*) FROM "RegulatoryRule") as rules,
  (SELECT COUNT(*) FROM "Concept") as concepts,
  (SELECT COUNT(*) FROM "GraphEdge") as edges,
  (SELECT COUNT(*) FROM "RuleRelease") as releases,
  (SELECT COUNT(*) FROM "RegulatoryAuditLog") as audit_logs;
```

**Step 4: Push all commits**

```bash
git push origin main
```

---

## Summary

| Task                           | Priority | Files       |
| ------------------------------ | -------- | ----------- |
| 1. Knowledge Graph in Composer | HIGH     | composer.ts |
| 2. Fix stale rules calculation | HIGH     | metrics.ts  |
| 3. Add alert email             | MEDIUM   | cron.ts     |
| 4. End-to-end test             | HIGH     | -           |
| 5. Verify APIs                 | HIGH     | -           |
| 6. Final build and push        | HIGH     | -           |

**Total: 6 tasks**
