# FiskAI TypeScript Build Errors - Complete Analysis

**Generated:** 2025-12-13  
**Current Status:** Build fails with 4 categories of errors  
**Total Files Affected:** 20+ files across 3 feature modules

---

## Error Category 1: Missing Prisma Model Fields

### Problem

The following fields are used in code but don't exist in `prisma/schema.prisma`:

#### A. `Contact.paymentTermsDays` (Integer field)

**Impact:** Contact management features broken for payment terms tracking

**Referenced in:**

- `src/app/(dashboard)/contacts/new/page.tsx`
  - Line 44: Default value in form
  - Line 52: Watch hook variable
  - Line 64: Display variable
  - Line 79: Submission payload
  - Lines 227-256: Full UI section for payment terms quick buttons

- `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx`
  - Line 56: Form initialization
  - Line 88: Submission payload

- `src/lib/validations/contact.ts`
  - Zod schema validation for paymentTermsDays

- `src/app/(dashboard)/e-invoices/new/invoice-form.tsx`
  - DEFAULT_PAYMENT_TERMS_DAYS constant
  - buyerPaymentTerms variable usage

**Fix Options:**

1. **Add to Prisma schema:** `paymentTermsDays Int? @default(15)`
2. **Remove from code:** Strip all payment terms UI and logic

---

#### B. `BankTransaction.confidenceScore` (Integer field)

**Impact:** Bank reconciliation scoring system broken

**Referenced in:**

- `src/lib/banking/reconciliation.ts`
  - Return type includes confidenceScore field
  - Multiple places setting score (0, topMatch.score, etc.)

- `src/lib/banking/reconciliation-service.ts`
  - Prisma update operation: `confidenceScore: result.confidenceScore`

- `src/app/api/banking/reconciliation/match/route.ts`
  - Line 236: `confidenceScore: 0` in payload

- `src/app/api/banking/reconciliation/route.ts`
  - Mapping confidenceScore from transaction to API response

- `src/app/(dashboard)/banking/reconciliation/dashboard-client.tsx`
  - Displaying `{txn.confidenceScore}%` in UI

- `src/app/(dashboard)/banking/actions.ts`
  - Line 236: `confidenceScore: 0` initial value

**Fix Options:**

1. **Add to Prisma schema:** `confidenceScore Int? @default(0)`
2. **Remove from code:** Strip all confidence scoring logic and UI

---

### Error Category 2: Missing Prisma Model & Enums

### Problem

The `SupportTicket` model and its enums don't exist in schema at all

#### A. Missing `SupportTicket` model with enums

**Impact:** Support/ticketing system completely non-functional

**Enums needed:**

- `enum SupportTicketStatus { OPEN, IN_PROGRESS, RESOLVED, CLOSED }`
- `enum SupportTicketPriority { LOW, MEDIUM, HIGH, URGENT }`

**Referenced in:**

- `src/lib/notifications.ts`
  - Line 3: Import `SupportTicketStatus`
  - Lines 129, 135, 150, 157: Using status enum in queries

- `src/app/(dashboard)/accountant/page.tsx`
  - Importing both enums
  - Multiple support ticket queries

- `src/app/api/admin/support/dashboard/route.ts`
  - Importing both enums
  - Full dashboard statistics calculations

**Required Model Fields (example):**

```prisma
model SupportTicket {
  id            String    @id @default(cuid())
  companyId     String
  company       Company   @relation(fields: [companyId], references: [id])

  title         String
  description   String
  status        SupportTicketStatus @default(OPEN)
  priority      SupportTicketPriority @default(MEDIUM)

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  resolvedAt    DateTime?

  createdById   String
  createdBy     User      @relation("SupportTicketCreator", fields: [createdById], references: [id])

  assignedToId  String?
  assignedTo    User?     @relation("SupportTicketAssignee", fields: [assignedToId], references: [id])

  messages      SupportTicketMessage[]
}

model SupportTicketMessage {
  id              String    @id @default(cuid())
  ticketId        String
  ticket          SupportTicket @relation(fields: [ticketId], references: [id])

  message         String
  createdAt       DateTime  @default(now())

  authorId        String
  author          User      @relation(fields: [authorId], references: [id])
}

enum SupportTicketStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}

enum SupportTicketPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

**Fix Options:**

1. **Add full model:** Add SupportTicket and SupportTicketMessage models with all relations
2. **Add stub model:** Create minimal model to satisfy imports, mark features as unimplemented
3. **Remove support features:** Delete all support-related code

---

## Error Category 3: Missing Hook Implementation

### Problem

`useTicketSummary` hook is imported but doesn't exist

**Referenced in:**

- `src/components/layout/bottom-nav.tsx`
  - Line 9: Import statement
  - Line 30: Hook call

**Expected Hook Signature:**

```typescript
export function useTicketSummary() {
  return {
    summary: {
      unreadForMe: number
      openCount: number
    } | null
  }
}
```

**Fix Options:**

1. **Implement hook:** Create `src/hooks/use-ticket-summary.ts`
2. **Remove from UI:** Remove hook import and supportBadge logic from bottom-nav

---

## Error Category 4: Missing Icon Import

### Problem

`Plus` icon from lucide-react is used but not imported

**Referenced in:**

- `src/components/layout/bottom-nav.tsx`
  - Line 5: Missing from import statement (other icons present)
  - Line 92: Used in JSX

**Current import:**

```typescript
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  Receipt,
  Package,
  LifeBuoy,
} from "lucide-react"
```

**Should be:**

```typescript
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  Receipt,
  Package,
  LifeBuoy,
  Plus,
} from "lucide-react"
```

**Fix:** Add `Plus` to the destructured import

---

## Fix Strategies

### Strategy A: Complete Features (Add Missing Fields & Models)

**Timeline:** 2-3 days  
**Effort:** High  
**Scope:**

1. Add `paymentTermsDays Int?` to Contact model
2. Add `confidenceScore Int?` to BankTransaction model
3. Add complete SupportTicket model with all relations
4. Implement `useTicketSummary` hook
5. Add `Plus` to lucide-react imports
6. Run `npx prisma migrate dev --name add_missing_fields_models`
7. Run `npx prisma generate`

**Pros:** All features become functional and testable  
**Cons:** Significant database schema work, migration creation needed

---

### Strategy B: Minimal Fix (Add Only Schema Fields)

**Timeline:** 1 day  
**Effort:** Low  
**Scope:**

1. Add `paymentTermsDays Int?` to Contact
2. Add `confidenceScore Int?` to BankTransaction
3. Add SupportTicket model (can be minimal)
4. Implement stub `useTicketSummary` hook
5. Add `Plus` icon import
6. Run migrations

**Pros:** Builds successfully, minimal changes  
**Cons:** Features may have incomplete functionality

---

### Strategy C: Focused Features (Cherry-pick what to build)

**Timeline:** Varies by choice  
**Effort:** Medium-High  
**Scope:**

- Choose which features to implement (e.g., only payment terms, skip banking/support)
- Remove code for features you're not implementing yet
- Add only needed Prisma fields
- Implement only required hooks/UI

**Pros:** Build passes, only implement what's needed now  
**Cons:** Must consciously decide what to cut

---

## Files to Modify (All Strategies)

**Must-modify:**

1. `prisma/schema.prisma` - Add missing fields/models
2. `src/components/layout/bottom-nav.tsx` - Fix icon import

**If completing support feature:** 3. `src/hooks/use-ticket-summary.ts` - Create hook 4. `src/lib/notifications.ts` - Verify queries work 5. `src/app/(dashboard)/accountant/page.tsx` - Verify queries work 6. `src/app/api/admin/support/dashboard/route.ts` - Verify API works

**If completing payment terms:** 7. `src/lib/validations/contact.ts` - Verify validation 8. `src/app/(dashboard)/contacts/new/page.tsx` - Verify form 9. `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx` - Verify form 10. `src/app/(dashboard)/e-invoices/new/invoice-form.tsx` - Verify usage

**If completing banking reconciliation:** 11. All files in `src/lib/banking/` - Verify algorithms 12. All files in `src/app/api/banking/` - Verify APIs 13. All files in `src/app/(dashboard)/banking/` - Verify UI

---

## Build Command to Test

After making changes:

```bash
cd /home/admin/FiskAI
npm run build 2>&1 | tail -50
```

Should see: `✓ Compiled successfully`

---

## Deployment After Fix

Once build succeeds:

```bash
git add -A
git commit -m "fix: Add missing Prisma fields and implement required hooks"
git push origin main

# Staging auto-deploys via webhook
# Production: Use Coolify dashboard at https://git.metrica.hr
```

---

## Questions for Your Developer

1. **Which features are priority for launch?**
   - E-invoicing (core, done)
   - Payment terms tracking (contacts)
   - Bank reconciliation (banking)
   - Support ticketing (support)

2. **Timeline constraints?**
   - Need build passing immediately? (Strategy B)
   - Can spend 2-3 days on full implementation? (Strategy A)

3. **Database migration comfort level?**
   - Comfortable creating and testing migrations?
   - Need guidance on schema changes?

---

**Last Updated:** 2025-12-13  
**Repository:** https://github.com/Wandeon/FiskAI  
**Current Branch:** main (commit: 617cb2e)
