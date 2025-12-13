# 📋 Design Team - Phase 1 MVP Implementation Guide

## Quick Start

Your team is tasked with implementing **3 critical features** to complete Phase 1 of FiskAI's MVP. All requirements, technical specs, and acceptance criteria are documented in two files:

### 📄 Documents to Read (IN THIS ORDER)

1. **`DESIGN_BRIEF_PHASE1_MVP.md`** (20KB) - **START HERE**
   - Overview of what's built vs. what's missing
   - Feature requirements with user stories
   - Technical implementation scope for each feature
   - API endpoints and database schema changes
   - Testing & acceptance criteria
   - External dependencies and blockers
   - 20+ minute read for full context

2. **`PHASE1_IMPLEMENTATION_CHECKLIST.md`** (18KB) - **REFERENCE DURING WORK**
   - Task-by-task checklist with checkbox completion
   - Organized by feature (Barcode, Fiscalization, Reconciliation)
   - Specific file paths, function signatures, test cases
   - Database migration SQL scripts
   - Deployment procedures and rollback instructions
   - Sign-off section for QA verification
   - 30+ minute read for detailed task breakdown

---

## 🎯 The 3 Features (High-Level Overview)

### 1️⃣ **2D Barcode Payment** (ISO 20022)
Generate QR codes on invoices so customers can scan & pay in their banking app.

**Timeline:** Week 1-3 | **Blocker:** None
- Add barcode to PDF template
- Add IBAN input field to invoice form
- Implement ISO 20022 QR generation utility
- Validate with 5+ Croatian banking apps (mBanking, Erste, etc.)

**Files to modify:** 3 new + 2 updated
**Complexity:** ⭐⭐ Medium

---

### 2️⃣ **FINA Fiscalization** (Real Government E-Invoicing)
Replace mock provider with real FINA integration for Croatian e-invoicing compliance (B2B Jan 2026 deadline).

**Timeline:** Week 1-4 | **Blocker:** Waiting for FINA API credentials
- Create real FINA provider (replacing current mock)
- Convert invoices to UBL 2.1 XML format (EN 16931 standard)
- Submit via AS4 protocol with retry logic
- Create admin UI for failed invoice resubmission

**Files to modify:** 3 new + 1 updated
**Complexity:** ⭐⭐⭐ Hard (XML generation, async retries)

---

### 3️⃣ **Bank Reconciliation** (Payment Matching)
Allow accountants to upload bank statements and auto-match transactions to invoices for tax compliance.

**Timeline:** Week 1-4 | **Blocker:** None
- Create CSV parser for 5+ Croatian banks
- Build matching algorithm (reference, amount, date)
- Design upload & reconciliation UI
- Add database tables for transactions & imports

**Files to modify:** 4 new + 2 updated + 2 new tables
**Complexity:** ⭐⭐⭐ Hard (matching algorithm, multi-bank formats)

---

## ✅ What's Already Built (DO NOT MODIFY)

These features are complete and working:
- ✅ Invoice creation with line items & PDF export
- ✅ Contact & product management with OIB lookup
- ✅ Mark invoice as paid (`paidAt` field)
- ✅ Admin panel with password auth
- ✅ Marketing pages + robots.txt + sitemap.xml
- ✅ Expense tracking module
- ✅ Bank account management (structure exists)
- ✅ Mock fiscalization (for testing during Phase 1)

**Important:** Don't refactor or "improve" existing code. Only add what's listed in the design brief.

---

## 📊 Current Status

| Feature | Completion | Status |
|---------|-----------|--------|
| 2D Barcode | 0% | ❌ Not started |
| FINA Fiscalization | 5% | ⏳ Mock exists, needs real integration |
| Bank Reconciliation | 10% | ⏳ Banking module structure exists, reconciliation missing |

**Launch Readiness:** 60% complete (need these 3 features to reach 90% for customer onboarding)

---

## 🛠️ Tech Stack (What You're Working With)

- **Framework:** Next.js 15 + React 18 + TypeScript
- **Database:** PostgreSQL (Prisma ORM)
- **Styling:** Tailwind CSS (already set up, don't add new colors)
- **Form Library:** React Hook Form + Zod validation
- **File Upload:** Built-in browser API (no external library)
- **PDF Generation:** `@react-pdf/renderer` (already installed)
- **QR Code:** `qrcode.react` (already installed)
- **Logging:** Pino (already configured)
- **Auth:** NextAuth.js (already configured)

**New dependencies needed:** None! Everything is already installed.

---

## 📁 Project Structure (Relevant Files)

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── e-invoices/          ← 2D Barcode: Modify invoice form
│   │   ├── banking/              ← Reconciliation: Add import + reconciliation pages
│   │   └── admin/                ← Fiscalization: Add retry UI
│   ├── api/
│   │   └── [routes for new features]
│   └── actions/
│       ├── e-invoice.ts          ← Barcode: Modify PDF generation
│       └── fiscalize.ts          ← Fiscalization: Modify to add retries
├── components/
│   ├── invoice/                  ← Barcode: Modify PDF template
│   └── banking/                  ← Reconciliation: Add new components
├── lib/
│   ├── barcode.ts                ← NEW: QR generation
│   ├── banking/                  ← NEW: CSV parser + reconciliation engine
│   └── e-invoice/providers/
│       ├── fina-fiscal.ts        ← NEW: Real FINA provider
│       └── index.ts              ← Swap mock → real provider
└── prisma/
    ├── schema.prisma             ← Add 2 new tables, 2 new columns
    └── migrations/               ← Run migration after schema update
```

---

## 🚀 Getting Started

### Step 1: Read the Brief (20-30 min)
```bash
cat DESIGN_BRIEF_PHASE1_MVP.md
```
Understand the "why" and "what" of each feature.

### Step 2: Check the Checklist (15-20 min)
```bash
cat PHASE1_IMPLEMENTATION_CHECKLIST.md
```
See the exact tasks, file paths, and test cases.

### Step 3: Divide Work Among Team
- **Frontend Dev:** 2D Barcode (Week 1-2) + Reconciliation UI (Week 2-3)
- **Backend Dev:** FINA Fiscalization (Week 1-4) + CSV Parser + Matching (Week 1-3)
- **QA Lead:** Create test plan from acceptance criteria

### Step 4: Start Coding
Pick ONE feature to start with (Barcode is easiest, no external dependencies).

---

## 🔑 Key Files by Feature

### 2D Barcode
- `src/app/(dashboard)/e-invoices/new/invoice-form.tsx` ← Add IBAN input
- `src/lib/pdf/invoice-template.tsx` ← Add barcode to PDF
- `src/lib/barcode.ts` ← **NEW:** QR generation logic
- `prisma/schema.prisma` ← Add 2 columns to EInvoice

### FINA Fiscalization
- `src/lib/e-invoice/providers/fina-fiscal.ts` ← **NEW:** Real FINA provider
- `src/lib/e-invoice/providers/index.ts` ← Swap mock → real
- `src/app/actions/fiscalize.ts` ← Add retry logic
- `src/app/admin/fiscalization/page.tsx` ← **NEW:** Admin UI for retries

### Bank Reconciliation
- `src/lib/banking/csv-parser.ts` ← **NEW:** Parse bank CSVs
- `src/lib/banking/reconciliation.ts` ← **NEW:** Matching algorithm
- `src/app/(dashboard)/banking/import/import-form.tsx` ← Upload UI
- `src/app/(dashboard)/banking/reconciliation/page.tsx` ← **NEW:** Results & actions
- `prisma/schema.prisma` ← Add 2 new tables

---

## 🧪 Testing Strategy

Each feature has 10-30 acceptance criteria. Before marking done:

1. **Unit Tests:** Test individual functions (CSV parser, matching algorithm, barcode generation)
2. **Integration Tests:** Test features together (invoice → barcode → PDF)
3. **E2E Tests:** Test user workflows (upload CSV → reconcile transaction → verify invoice.paidAt updated)
4. **Manual Testing:** Test with real banking apps (QR scanner), real bank CSVs, real FINA test environment

See `PHASE1_IMPLEMENTATION_CHECKLIST.md` section "Testing Checklist" for exact test cases.

---

## ⚠️ Common Pitfalls (Learn from Previous Sessions)

1. **Don't modify existing features** - Only add what's in the brief
2. **Don't replace design system** - Use existing colors, spacing, components
3. **Don't add validation where not required** - Trust framework guarantees
4. **Don't use sed on JSX files** - Use Write/Edit tools instead, or create files locally then scp
5. **Test before claiming done** - "Looks good" is not the same as "verified"
6. **Read the whole brief first** - Don't skip sections; misunderstandings compound

---

## 📞 Questions?

Before starting implementation, clarify with Product (Mislav):

**2D Barcode:**
- Gross or net amount in QR code?
- Default IBAN source (company bank account or input per invoice)?
- Warning for businesses without IBAN?

**Fiscalization:**
- When will FINA credentials arrive?
- Should failed fiscalization block invoice marking as sent?
- Max retries before escalating to manual review?

**Reconciliation:**
- Confidence score threshold for auto-match (70%? 80%?)?
- Require approval for partial matches (amount ±5%)?
- New invoice status "PAID_VERIFIED" or update existing status?

---

## 🎯 Success Criteria

Feature is **DONE** when:
- [ ] All code review comments addressed
- [ ] All unit tests pass (`npm run test`)
- [ ] Build succeeds (`npm run build`)
- [ ] All acceptance criteria met (checkbox in checklist)
- [ ] Manual testing verified (documented in checklist)
- [ ] Database migrations applied (schema matches code)
- [ ] Code committed to main branch
- [ ] Merged & deployed via Coolify

---

## 📅 Timeline

**Recommended parallel work:**
- **Week 1:** Barcode (quick, no blockers) + Reconciliation backend (CSV parser)
- **Week 2:** Barcode UI + Reconciliation UI + Fiscalization backend (if credentials arrive)
- **Week 3:** Testing + integration + edge cases
- **Week 4:** Final QA + deployment

**Hard deadline:** End of Week 4 for Phase 1 MVP complete

---

## 🚢 Deployment

After all features complete:
1. All changes committed to main branch
2. Manual test on dev server (`http://100.64.123.81:3001`)
3. Trigger Coolify deploy from `git.metrica.hr` dashboard
4. Verify features on production (`https://erp.metrica.hr`)

**Important:** User account for testing: `info@metrica.hr` / `Ovsenica07!`

---

## 📚 Additional Resources

- **PostgreSQL + Prisma:** `prisma/schema.prisma` (reference existing models)
- **TypeScript/React:** `src/app/(dashboard)/e-invoices/` (reference existing pages)
- **Tailwind CSS:** `tailwind.config.ts` (use existing tokens)
- **Form validation:** `src/lib/validations.ts` (copy patterns)
- **API routes:** `src/app/api/` (follow existing patterns for auth, logging)

---

## ✨ Remember

- Be pragmatic: Don't over-engineer, don't over-test
- Be thorough: Read the brief completely before coding
- Be collaborative: Ask clarifying questions early
- Be honest: If something is unclear or blocked, flag it immediately

Good luck! 🚀