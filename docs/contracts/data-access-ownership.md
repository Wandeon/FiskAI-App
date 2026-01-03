# Data Access Ownership Contract

> **Status:** DRAFT - requires team review
> **Created:** 2026-01-03
> **Problem:** Split-brain data access between Prisma and Drizzle ORMs

## Executive Summary

FiskAI has **two ORMs accessing the same PostgreSQL database**:

- **Prisma** (201 models) - primary ORM for most business logic
- **Drizzle** (23 tables) - secondary ORM for specific modules

**16 tables are defined in BOTH ORMs**, creating:

- Schema drift risk
- Migration conflicts
- Unreliable "unused table" audits
- Tenant isolation gaps

This contract defines ownership boundaries and migration path.

---

## Current State: Table Inventory

### Category A: DUAL-DEFINED (Critical - Must Resolve)

These tables are defined in **both** Prisma schema AND Drizzle schema:

| Table (DB Name)             | Prisma Model                | Drizzle Export            | Access Pattern | Owner Decision |
| --------------------------- | --------------------------- | ------------------------- | -------------- | -------------- |
| `compliance_deadlines`      | `compliance_deadlines`      | `complianceDeadlines`     | Drizzle writes | **DRIZZLE**    |
| `user_guidance_preferences` | `user_guidance_preferences` | `userGuidancePreferences` | Drizzle writes | **DRIZZLE**    |
| `checklist_interactions`    | `checklist_interactions`    | `checklistInteractions`   | Drizzle writes | **DRIZZLE**    |
| `newsletter_subscriptions`  | `newsletter_subscriptions`  | `newsletterSubscriptions` | Drizzle writes | **DRIZZLE**    |
| `news_sources`              | `news_sources`              | `newsSources`             | Drizzle writes | **DRIZZLE**    |
| `news_categories`           | `news_categories`           | `newsCategories`          | Drizzle writes | **DRIZZLE**    |
| `news_tags`                 | `news_tags`                 | `newsTags`                | Drizzle writes | **DRIZZLE**    |
| `news_posts`                | `news_posts`                | `newsPosts`               | Drizzle writes | **DRIZZLE**    |
| `news_post_sources`         | `news_post_sources`         | `newsPostSources`         | Drizzle writes | **DRIZZLE**    |
| `news_items`                | `news_items`                | `newsItems`               | Drizzle writes | **DRIZZLE**    |
| `pausalni_profile`          | `pausalni_profile`          | `pausalniProfile`         | Drizzle writes | **DRIZZLE**    |
| `eu_vendor`                 | `eu_vendor`                 | `euVendor`                | Drizzle writes | **DRIZZLE**    |
| `payment_obligation`        | `payment_obligation`        | `paymentObligation`       | Drizzle writes | **DRIZZLE**    |
| `eu_transaction`            | `eu_transaction`            | `euTransaction`           | Drizzle writes | **DRIZZLE**    |
| `generated_form`            | `generated_form`            | `generatedForm`           | Drizzle writes | **DRIZZLE**    |
| `notification_preference`   | `notification_preference`   | `notificationPreference`  | Drizzle writes | **DRIZZLE**    |

**Action Required:** Remove these 16 models from Prisma schema after confirming no Prisma access.

### Category B: DRIZZLE-ONLY

These tables exist only in Drizzle (not in Prisma):

| Table               | Drizzle Schema File | Purpose               |
| ------------------- | ------------------- | --------------------- |
| `contentSyncEvents` | content-sync.ts     | Content sync tracking |
| `tutorialProgress`  | tutorials.ts        | Tutorial completion   |
| `intrastatTracking` | pausalni.ts         | EU Intrastat          |
| `newsPipelineRuns`  | news.ts             | News pipeline runs    |

**Status:** Clean - no action needed.

### Category C: PRISMA-ONLY

All remaining 185 models are Prisma-only. These include:

- Core business models (Invoice, Contact, Company, etc.)
- RTL system (Evidence, RegulatoryRule, etc.)
- Auth models (User, Session, Account, etc.)
- Feature systems (FeatureFlag, Experiment, etc.)

**Status:** Clean - managed exclusively by Prisma.

---

## Ownership Rules

### Rule 1: Single Owner Per Table

Every table MUST have exactly one ORM owner:

- Owner handles all migrations
- Owner handles all writes
- Non-owner may read via raw SQL if absolutely necessary (discouraged)

### Rule 2: No Cross-Writing

**FORBIDDEN:**

```typescript
// If table is Drizzle-owned:
await db.pausalniProfile.create({...})  // ❌ FORBIDDEN

// If table is Prisma-owned:
await drizzleDb.insert(invoice).values({...})  // ❌ FORBIDDEN
```

### Rule 3: Schema Changes Follow Owner

- Drizzle-owned tables: modify `src/lib/db/schema/*.ts`, run Drizzle migrations
- Prisma-owned tables: modify `prisma/schema.prisma`, run Prisma migrations

### Rule 4: FK References Are Read-Only

Drizzle schemas may reference Prisma tables (User, Company) for FK constraints:

```typescript
// OK - FK reference only, no writes
export const company = pgTable("Company", {
  id: text("id").primaryKey(),
})
```

---

## Migration Plan

### Phase 1: Remove Prisma Definitions for Drizzle-Owned Tables

**PR: "chore: remove dual-defined models from Prisma"**

Remove these 16 models from `prisma/schema.prisma`:

- `compliance_deadlines`
- `user_guidance_preferences`
- `checklist_interactions`
- `newsletter_subscriptions`
- `news_sources`, `news_categories`, `news_tags`, `news_posts`, `news_post_sources`, `news_items`
- `pausalni_profile`, `eu_vendor`, `payment_obligation`, `eu_transaction`, `generated_form`, `notification_preference`

**Prerequisites:**

1. Grep confirm zero `db.modelName` access for each
2. Verify no Prisma relations pointing TO these tables
3. Run `prisma generate` to confirm type removal is safe

### Phase 2: Add CI Guardrails

**File: `.github/workflows/schema-ownership.yml`**

```yaml
name: Schema Ownership Check
on: [pull_request]
jobs:
  check-ownership:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for dual definitions
        run: |
          # Extract Drizzle table names
          DRIZZLE_TABLES=$(grep -rh 'pgTable' src/lib/db/schema/*.ts | grep -oE '"[a-z_]+"' | tr -d '"' | sort -u)

          # Check if any exist in Prisma
          for tbl in $DRIZZLE_TABLES; do
            if grep -q "@@map.*$tbl" prisma/schema.prisma; then
              echo "ERROR: $tbl is defined in both Prisma and Drizzle"
              exit 1
            fi
          done
          echo "No dual definitions found"
```

### Phase 3: Document Ownership in Schema Files

Add header comments:

```prisma
// prisma/schema.prisma
// OWNER: Prisma
// Tables in this file are managed exclusively by Prisma ORM
// Do NOT add tables that are managed by Drizzle (see src/lib/db/schema/)
```

```typescript
// src/lib/db/schema/pausalni.ts
// OWNER: Drizzle
// Tables in this file are managed exclusively by Drizzle ORM
// Do NOT add corresponding models to prisma/schema.prisma
```

---

## Long-Term Direction

### Recommended: Prisma-Only

Migrate Drizzle tables to Prisma over time:

- Drizzle was added for specific pausalni/news features
- Prisma is the primary ORM with better ecosystem support
- Single ORM reduces complexity

### Alternative: Explicit Dual-ORM (if justified)

If Drizzle provides unique value (e.g., better raw SQL support):

1. Move Drizzle tables to separate PostgreSQL schema (`drizzle.*`)
2. Enforce via DB permissions
3. Document why dual-ORM is necessary

---

## Forbidden Actions

1. **Adding new tables to both ORMs**
2. **Writing to Drizzle tables via Prisma client**
3. **Writing to Prisma tables via Drizzle client**
4. **Running Prisma migrations on Drizzle-owned tables**
5. **Running Drizzle migrations on Prisma-owned tables**

---

## Appendix: Verification Commands

### Check for Prisma access to Drizzle tables

```bash
# Should return 0 for all Drizzle-owned tables
grep -rn "db\.pausalniProfile\|db\.euVendor\|db\.euTransaction" src/
```

### Check for Drizzle access to Prisma tables

```bash
# Should only show FK references, not writes
grep -rn "drizzleDb.*insert.*invoice\|drizzleDb.*update.*invoice" src/
```

### List all dual-defined tables

```bash
for tbl in $(grep -rh 'pgTable' src/lib/db/schema/*.ts | grep -oE '"[a-z_]+"' | tr -d '"'); do
  grep -q "@@map.*$tbl\|model.*$tbl" prisma/schema.prisma && echo "$tbl: DUAL"
done
```
