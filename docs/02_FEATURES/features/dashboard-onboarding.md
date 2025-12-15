# Feature: Onboarding Checklist

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 12

## Purpose

Guides new users through essential setup steps to configure their company and start using FiskAI effectively. The onboarding system consists of two parts: a wizard for initial company creation and a dashboard checklist for post-setup tasks.

## User Entry Points

| Type | Path        | Evidence                                     |
| ---- | ----------- | -------------------------------------------- |
| Page | /onboarding | `src/app/(dashboard)/onboarding/page.tsx:11` |
| Page | /dashboard  | `src/app/(dashboard)/dashboard/page.tsx:20`  |

## Core Flow

### Initial Onboarding Wizard

1. **Access wizard** → User with no company is redirected to `/onboarding` → `src/app/(dashboard)/dashboard/page.tsx:24-26`
2. **Step 1: Basic Info** → User enters company name and OIB (11-digit tax ID), with automatic data lookup → `src/components/onboarding/step-basic-info.tsx:12-93`
3. **Step 2: Address** → User enters business address (street, postal code, city, country) → `src/components/onboarding/step-address.tsx:8-92`
4. **Step 3: Contact & Tax** → User enters email, phone, IBAN, and VAT status → `src/components/onboarding/step-contact-tax.tsx:13-130`
5. **Submit company** → Data validated and company created via server action → `src/app/actions/company.ts:11-48`
6. **Redirect to dashboard** → User sees dashboard with onboarding checklist → `src/components/onboarding/step-contact-tax.tsx:45`

### Dashboard Onboarding Checklist

1. **Display checklist** → Dashboard calculates completion status for 5 onboarding tasks → `src/app/(dashboard)/dashboard/page.tsx:114-151`
2. **Track progress** → Each task shows as completed based on data existence (company info, provider config, contacts, products, invoices) → `src/app/(dashboard)/dashboard/page.tsx:115-151`
3. **Navigate to task** → User clicks incomplete task to navigate to relevant page → `src/components/dashboard/onboarding-checklist.tsx:48-56`
4. **Auto-hide on completion** → Checklist disappears when all 5 tasks are completed → `src/components/dashboard/onboarding-checklist.tsx:25-27`

## Key Modules

| Module                 | Purpose                                     | Location                                             |
| ---------------------- | ------------------------------------------- | ---------------------------------------------------- |
| OnboardingPage         | Main wizard container with 3-step flow      | `src/app/(dashboard)/onboarding/page.tsx`            |
| OnboardingStore        | Zustand store for wizard state persistence  | `src/lib/stores/onboarding-store.ts`                 |
| StepIndicator          | Visual progress indicator for wizard steps  | `src/components/onboarding/step-indicator.tsx`       |
| StepBasicInfo          | Step 1: Company name and OIB input          | `src/components/onboarding/step-basic-info.tsx`      |
| StepAddress            | Step 2: Business address input              | `src/components/onboarding/step-address.tsx`         |
| StepContactTax         | Step 3: Contact info and VAT configuration  | `src/components/onboarding/step-contact-tax.tsx`     |
| OnboardingChecklist    | Dashboard checklist component               | `src/components/dashboard/onboarding-checklist.tsx`  |
| OnboardingProgressPill | Header widget showing completion percentage | `src/components/layout/onboarding-progress-pill.tsx` |
| createCompany          | Server action to persist company data       | `src/app/actions/company.ts`                         |

## Data

- **Tables**: `Company` → `prisma/schema.prisma:68`, `CompanyUser` → `prisma/schema.prisma:132`
- **Key fields**:
  - Company: `name`, `oib` (unique tax ID), `address`, `postalCode`, `city`, `country`, `email`, `phone`, `iban`, `isVatPayer`, `vatNumber`, `eInvoiceProvider`
  - CompanyUser: `userId`, `companyId`, `role`, `isDefault` (for multi-company support)
- **State persistence**: Wizard data persisted to localStorage via Zustand → `src/lib/stores/onboarding-store.ts:77-84`

## Onboarding Steps Detail

### Wizard Steps

1. **Basic Info** (`currentStep: 1`)
   - Fields: Company name, OIB (11-digit tax ID)
   - Validation: Name required, OIB must match `/^\d{11}$/` → `src/lib/stores/onboarding-store.ts:62`
   - Feature: Automatic OIB lookup to pre-fill company data → `src/components/onboarding/step-basic-info.tsx:26-40`
   - Analytics: Tracks `ONBOARDING_STARTED` and `ONBOARDING_STEP_COMPLETED` events → `src/components/onboarding/step-basic-info.tsx:16,21`

2. **Address** (`currentStep: 2`)
   - Fields: Street address, postal code, city, country (defaults to "HR")
   - Validation: All fields must be non-empty → `src/lib/stores/onboarding-store.ts:64-69`
   - Navigation: Back to step 1 or forward to step 3 → `src/components/onboarding/step-address.tsx:82-89`

3. **Contact & Tax** (`currentStep: 3`)
   - Fields: Email (required), phone (optional), IBAN (required), VAT payer checkbox
   - Validation: Email must contain "@", IBAN must be non-empty → `src/lib/stores/onboarding-store.ts:71`
   - Submission: Creates company and links to user with OWNER role → `src/app/actions/company.ts:32-44`
   - VAT handling: Auto-generates VAT number as `HR{oib}` if `isVatPayer` is true → `src/app/actions/company.ts:35`
   - Analytics: Tracks `ONBOARDING_COMPLETED` event → `src/components/onboarding/step-contact-tax.tsx:44`

### Dashboard Checklist Tasks

1. **Company Data** (`id: "company"`)
   - Description: "Dodajte OIB, adresu i kontakt podatke"
   - Completion: `!!company.oib && !!company.address`
   - Link: `/settings`

2. **Provider Configuration** (`id: "provider"`)
   - Description: "Povežite se s IE-Računi ili drugim posrednikom"
   - Completion: `!!company.eInvoiceProvider`
   - Link: `/settings`

3. **First Contact** (`id: "contact"`)
   - Description: "Kreirajte kupca ili dobavljača"
   - Completion: `contactCount > 0`
   - Link: `/contacts/new`

4. **First Product** (`id: "product"`)
   - Description: "Kreirajte artikl za fakturiranje"
   - Completion: `productCount > 0`
   - Link: `/products/new`

5. **First Invoice** (`id: "invoice"`)
   - Description: "Izdajte i fiskalizirajte račun"
   - Completion: `eInvoiceCount > 0`
   - Link: `/e-invoices/new`

## Completion Tracking

### Wizard Progress

- Visual step indicator shows current step (1-3) → `src/components/onboarding/step-indicator.tsx:7-11`
- Completed steps shown with checkmark icon → `src/components/onboarding/step-indicator.tsx:39-46`
- Step validation prevents proceeding without valid data → `src/lib/stores/onboarding-store.ts:58-75`
- Data auto-saved to localStorage during input → `src/lib/stores/onboarding-store.ts:47-50`

### Dashboard Checklist Progress

- Progress bar shows completion percentage → `src/components/dashboard/onboarding-checklist.tsx:22-43`
- Completed count displayed as "X/5 dovršeno" → `src/components/dashboard/onboarding-checklist.tsx:34-36`
- Completed tasks shown with green checkmark and success background → `src/components/dashboard/onboarding-checklist.tsx:58-59`
- Incomplete tasks shown with circle icon and arrow → `src/components/dashboard/onboarding-checklist.tsx:60-74`
- Entire checklist auto-hides when all tasks completed → `src/components/dashboard/onboarding-checklist.tsx:25-27`

### Header Progress Widget

- Desktop-only pill widget in header → `src/components/layout/onboarding-progress-pill.tsx:11-49`
- Shows completion as "X/Y dovršeno (Z%)" → `src/components/layout/onboarding-progress-pill.tsx:28-30`
- Links to continue onboarding → `src/components/layout/onboarding-progress-pill.tsx:33-38`
- Includes "invite accountant" action → `src/components/layout/onboarding-progress-pill.tsx:39-45`

## Dependencies

- **Depends on**: [[auth-session]] (requires authenticated user), Company data model
- **Depended by**: [[dashboard-main]], Settings pages, all feature creation flows

## Integrations

- **OIB Lookup**: External API integration for auto-filling company data → `src/components/ui/oib-input.tsx` (referenced in `src/components/onboarding/step-basic-info.tsx:61`)
- **Analytics**: Tracks onboarding funnel events (started, step completed, completed) → `src/lib/analytics.ts` (referenced in `src/components/onboarding/step-basic-info.tsx:9,16,21`)
- **Toast notifications**: Success/error feedback for OIB lookup and company creation → `src/lib/toast.ts` (referenced in `src/components/onboarding/step-basic-info.tsx:10,39,44`)

## Verification Checklist

- [x] User without company is redirected to /onboarding
- [x] Wizard steps validate input before allowing progression
- [x] OIB lookup auto-fills company data when available
- [x] Company creation succeeds with valid data
- [x] User is redirected to dashboard after completion
- [x] Dashboard checklist shows correct completion status
- [x] Checklist items link to relevant pages
- [x] Checklist disappears when all tasks complete
- [x] Wizard data persists across page refreshes
- [x] Analytics events track onboarding funnel

## Evidence Links

1. `src/app/(dashboard)/onboarding/page.tsx:1-38` - Main onboarding wizard page
2. `src/lib/stores/onboarding-store.ts:1-86` - Zustand store with state management and validation
3. `src/components/onboarding/step-indicator.tsx:1-75` - Visual step progress indicator
4. `src/components/onboarding/step-basic-info.tsx:1-94` - Step 1 component with OIB lookup
5. `src/components/onboarding/step-address.tsx:1-93` - Step 2 address input component
6. `src/components/onboarding/step-contact-tax.tsx:1-131` - Step 3 with company creation
7. `src/app/actions/company.ts:11-48` - Server action for company creation
8. `src/components/dashboard/onboarding-checklist.tsx:1-82` - Dashboard checklist component
9. `src/app/(dashboard)/dashboard/page.tsx:114-151` - Checklist items definition and logic
10. `src/components/layout/onboarding-progress-pill.tsx:1-50` - Header progress widget
11. `prisma/schema.prisma:68-130` - Company and CompanyUser data models
12. `src/app/(dashboard)/dashboard/page.tsx:24-26` - Redirect logic for users without company
