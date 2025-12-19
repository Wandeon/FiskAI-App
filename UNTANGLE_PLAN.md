# FiskAI Untangle Plan (Vision & Execution)

## The Core Philosophy: "Experience-Clean" > "Feature-Complete"

The system currently suffers from **Split Truths** (parallel module systems) and **Visual Noise** (every widget appearing at once). To be "Customer-Ready," we must shift from a collection of containers to a guided journey.

---

## 1. Structural Standardization (The Law of Truth)

We will use `src/lib/modules` as the **Single Source of Truth** for all feature gating.

- **Always-On Core**: Contacts, Products, and Documents are no longer modules. They are the "floor" of the application and are visible to everyone.
- **Gated Modules**: Only high-value/complexity items are gated in the DB `entitlements` array:
  - `e-invoicing`, `fiscalization`, `banking`, `pausalni-hub`, `reports-advanced`, `pos`.
- **System Roles**:
  - `ADMIN` -> `/admin` (The Control Tower).
  - `STAFF` -> `/staff` (Internal Accountants - _Optional Phase 2_).
  - `USER` -> `/app` (The Business Cockpit).
- **Tenant Roles**: Use `OWNER`, `ADMIN`, `MEMBER`, and `ACCOUNTANT` within the `/app` scope.

---

## 2. Dashboard Evolution (Phase-based UI)

Stop showing empty charts to new users. We will implement **Progressive Disclosure**:

- **Stage 0: Setup (Onboarding)**
  - _Visibility_: Show "Welcome" Hero and "Setup Checklist" ONLY.
  - _Goal_: Get OIB, IBAN, and 1st Contact added.
- **Stage 1: Operational (Active)**
  - _Trigger_: 1st Invoice issued OR 1st Bank Statement imported.
  - _Visibility_: Hide Checklist. Show "Today's Actions," "Revenue Trend," and "Recent Activity."
- **Stage 2: Strategic (Maintenance)**
  - _Trigger_: 10+ Invoices OR VAT-registered.
  - _Visibility_: Show "Insights," "VAT Overview," and "Advanced Deadlines."

---

## 3. The Accountant Path (Short-Term MVP)

- **Problem**: The `(staff)` portal is unfinished and creates a disconnected experience.
- **Solution**: Use the **Tenant Role: ACCOUNTANT**.
- **Workflow**: The client invites their accountant to their company. The accountant logs into the main `/app` but sees a read-only or specialized "Accounting View" of the same dashboard. This ensures the accountant sees _exactly_ what the client sees, reducing support tickets.

---

## 4. Admin "Control Tower" (The Owner's Tool)

The `/admin` portal must become functional for you to manage the platform:

- **Tenant Grid**: A list of all companies.
- **Module Toggle**: A simple UI to click "Enable E-Invoicing" or "Set Plan to Pro" for a tenant without using PSQL.
- **User Management**: Ability to reset passwords or change system roles.

---

## 5. Immediate Action Items (The "First Customer" Checklist)

### Step 1: Sidebar & Nav Purge

- Remove any "TODO" or placeholder items from the sidebar.
- Auto-hide "Banking" or "POS" if the module isn't in `company.entitlements`.

### Step 2: Dashboard Logic Refactor

- Wrap dashboard widgets in the new **Progression Stages** logic.
- Ensure a brand-new user sees a "clean room," not a "graveyard of 0s."

### Step 3: Admin Portal Gating

- Enforce `systemRole === 'ADMIN'` in `src/app/(admin)/layout.tsx`.
- Remove the email allowlist in `src/lib/admin.ts`.

### Step 4: Onboarding Alignment

- Ensure the "Onboarding Progress" pill checks for the 4 critical steps: (1) Company Data, (2) IBAN, (3) E-Invoice Provider, (4) Fiscal Certificate.

---

## 6. Open TODO Inventory (Risk Assessment)

- **High Risk**: Module key mismatch (`eInvoicing` vs `e-invoicing`). -> **FIXED in Unification Phase.**
- **Medium Risk**: Incomplete e-invoice providers. -> **ACTION**: Default to "Manual/PDF" if provider is missing.
- **Low Risk**: Placeholder staff portal. -> **ACTION**: Keep hidden until Phase 2.
