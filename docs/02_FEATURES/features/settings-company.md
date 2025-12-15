# Feature: Company Settings

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 14

## Purpose

Allows company owners and administrators to view and modify comprehensive company profile settings including basic information (name, OIB, address), tax configuration (VAT status, IBAN), business structure (legal form, entitlements), and integration settings (e-invoice provider, API keys). The feature provides a centralized control center at /settings with multiple tabbed sections for managing all company-level configuration. Settings are validated on both client and server, with tenant isolation ensuring each company can only access and modify their own data.

## User Entry Points

| Type | Path                     | Evidence                                        |
| ---- | ------------------------ | ----------------------------------------------- |
| Page | /settings                | `src/app/(dashboard)/settings/page.tsx:48-254`  |
| Page | /settings?tab=company    | `src/app/(dashboard)/settings/page.tsx:129-141` |
| Page | /settings?tab=einvoice   | `src/app/(dashboard)/settings/page.tsx:143-155` |
| Page | /settings?tab=plan       | `src/app/(dashboard)/settings/page.tsx:157-169` |
| Page | /settings?tab=compliance | `src/app/(dashboard)/settings/page.tsx:185-249` |
| API  | updateCompany            | `src/app/actions/company.ts:50-87`              |
| API  | updateCompanySettings    | `src/app/actions/company.ts:89-127`             |
| API  | updateCompanyPlan        | `src/app/actions/company.ts:129-166`            |

## Core Flow

### Main Settings Access Flow

1. User authenticated and has active company -> `src/lib/auth-utils.ts:43-49`
2. User navigates to /settings from dashboard or sidebar -> `src/app/(dashboard)/settings/page.tsx:48`
3. Server loads requireAuth and requireCompany -> `src/app/(dashboard)/settings/page.tsx:49-50`
4. System fetches current company data -> `src/app/(dashboard)/settings/page.tsx:50`
5. Page displays with tab navigation (company, einvoice, plan, security, compliance) -> `src/app/(dashboard)/settings/page.tsx:11-42`
6. Default tab is "company" unless specified in query params -> `src/app/(dashboard)/settings/page.tsx:52-53`
7. Active tab content renders in right panel -> `src/app/(dashboard)/settings/page.tsx:128-250`

### Company Profile Update Flow

1. User on /settings?tab=company tab -> `src/app/(dashboard)/settings/page.tsx:129`
2. CompanySettingsForm renders with pre-populated company data -> `src/app/(dashboard)/settings/company-settings-form.tsx:21-166`
3. Form displays default values from company record -> `src/app/(dashboard)/settings/company-settings-form.tsx:33-45`
4. User modifies company fields (name, address, email, phone, IBAN, VAT status) -> `src/app/(dashboard)/settings/company-settings-form.tsx:81-159`
5. OIB field is disabled and cannot be changed -> `src/app/(dashboard)/settings/company-settings-form.tsx:95-98`
6. Client validates form with Zod resolver -> `src/app/(dashboard)/settings/company-settings-form.tsx:31-32`
7. User clicks "Spremi promjene" to submit -> `src/app/(dashboard)/settings/company-settings-form.tsx:161-163`
8. Client calls updateCompany action with company ID and data -> `src/app/(dashboard)/settings/company-settings-form.tsx:53`
9. Server validates user has OWNER or ADMIN role -> `src/app/actions/company.ts:57-67`
10. Server validates form with companySchema -> `src/app/actions/company.ts:69-73`
11. If isVatPayer=true, auto-generates vatNumber as HR+OIB -> `src/app/actions/company.ts:81`
12. Database updates company record -> `src/app/actions/company.ts:77-83`
13. Cache revalidation triggers -> `src/app/actions/company.ts:85`
14. Success toast displayed to user -> `src/app/(dashboard)/settings/company-settings-form.tsx:63`
15. Page refreshes with updated data -> `src/app/(dashboard)/settings/company-settings-form.tsx:65`

### E-Invoice Provider Configuration Flow

1. User navigates to /settings?tab=einvoice -> `src/app/(dashboard)/settings/page.tsx:143`
2. EInvoiceSettingsForm renders with current provider selection -> `src/app/(dashboard)/settings/einvoice-settings-form.tsx:48-197`
3. User selects provider from dropdown (ie-racuni, fina, ddd-invoices, mock) -> `src/app/(dashboard)/settings/einvoice-settings-form.tsx:125-136`
4. Provider info card displays with description and website -> `src/app/(dashboard)/settings/einvoice-settings-form.tsx:138-153`
5. For non-mock providers, API key input field appears -> `src/app/(dashboard)/settings/einvoice-settings-form.tsx:155-167`
6. User enters API key (encrypted on server) -> `src/app/(dashboard)/settings/einvoice-settings-form.tsx:158-162`
7. User optionally tests connection with provider -> `src/app/(dashboard)/settings/einvoice-settings-form.tsx:90-107`
8. User submits form -> `src/app/(dashboard)/settings/einvoice-settings-form.tsx:70-88`
9. Server validates ownership with OWNER/ADMIN role -> `src/app/actions/company.ts:95-105`
10. Server validates data with companySettingsSchema -> `src/app/actions/company.ts:107-111`
11. API key encrypted before storage -> `src/app/actions/company.ts:119-120`
12. Database updates eInvoiceProvider and eInvoiceApiKeyEncrypted -> `src/app/actions/company.ts:115-123`
13. Cache revalidation for /settings path -> `src/app/actions/company.ts:125`
14. Success toast confirms update -> `src/app/(dashboard)/settings/einvoice-settings-form.tsx:85`

### Business Plan & Legal Form Configuration Flow

1. User navigates to /settings?tab=plan -> `src/app/(dashboard)/settings/page.tsx:157`
2. PlanSettingsForm renders with current legal form and entitlements -> `src/app/(dashboard)/settings/plan-settings-form.tsx:27-122`
3. Form displays legal form dropdown with Croatian business types -> `src/app/(dashboard)/settings/plan-settings-form.tsx:10-16,63-74`
4. User selects legal form (OBRT_PAUSAL, OBRT_REAL, OBRT_VAT, JDOO, DOO) -> `src/app/(dashboard)/settings/plan-settings-form.tsx:64-73`
5. User toggles VAT payer checkbox -> `src/app/(dashboard)/settings/plan-settings-form.tsx:77-88`
6. User enables/disables module entitlements (invoicing, eInvoicing, expenses, banking, reports, settings) -> `src/app/(dashboard)/settings/plan-settings-form.tsx:94-112`
7. Submit button disabled if no entitlements selected -> `src/app/(dashboard)/settings/plan-settings-form.tsx:116`
8. User clicks "Spremi plan" -> `src/app/(dashboard)/settings/plan-settings-form.tsx:116-118`
9. Server validates ownership -> `src/app/actions/company.ts:135-145`
10. Server validates with planSettingsSchema -> `src/app/actions/company.ts:147-150`
11. Database updates legalForm, isVatPayer, entitlements -> `src/app/actions/company.ts:154-161`
12. Cache revalidated for both /settings and /dashboard -> `src/app/actions/company.ts:163-164`
13. Legal form affects field visibility throughout app -> `src/lib/capabilities.ts:28-59`

### Compliance Status Check Flow

1. User navigates to /settings?tab=compliance -> `src/app/(dashboard)/settings/page.tsx:185`
2. System displays three status cards: VAT payer status, Provider connection, IBAN status -> `src/app/(dashboard)/settings/page.tsx:195-214`
3. Status cards show success/warning/danger variants -> `src/app/(dashboard)/settings/page.tsx:256-282`
4. Deadline timeline card shows B2B and B2G e-invoice requirements -> `src/app/(dashboard)/settings/page.tsx:216-227`
5. Quick links to Poslovni prostori and Revizijski dnevnik -> `src/app/(dashboard)/settings/page.tsx:230-247`
6. All data derived from current company record state

## Key Modules

| Module                | Purpose                                        | Location                                                  |
| --------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| Settings Page         | Main settings hub with tab navigation          | `src/app/(dashboard)/settings/page.tsx`                   |
| CompanySettingsForm   | Form for basic company profile data            | `src/app/(dashboard)/settings/company-settings-form.tsx`  |
| EInvoiceSettingsForm  | E-invoice provider configuration form          | `src/app/(dashboard)/settings/einvoice-settings-form.tsx` |
| PlanSettingsForm      | Legal form and module entitlements form        | `src/app/(dashboard)/settings/plan-settings-form.tsx`     |
| updateCompany action  | Server action to update company profile        | `src/app/actions/company.ts:50-87`                        |
| updateCompanySettings | Server action to update e-invoice settings     | `src/app/actions/company.ts:89-127`                       |
| updateCompanyPlan     | Server action to update legal form and plan    | `src/app/actions/company.ts:129-166`                      |
| companySchema         | Zod validation for company profile             | `src/lib/validations/company.ts:6-18`                     |
| companySettingsSchema | Zod validation for e-invoice settings          | `src/lib/validations/company.ts:20-23`                    |
| planSettingsSchema    | Zod validation for plan settings               | `src/lib/validations/company.ts:25-29`                    |
| Capabilities          | Derives feature visibility from company config | `src/lib/capabilities.ts:28-59`                           |

## Data

### Database Tables

- **Company**: Main company configuration table -> `prisma/schema.prisma:68-118`
  - Identity: id, name, oib (unique, 11 digits) -> `prisma/schema.prisma:69-71`
  - VAT fields: vatNumber, isVatPayer (boolean, default false) -> `prisma/schema.prisma:72,80`
  - Address: address, city, postalCode, country (default "HR") -> `prisma/schema.prisma:73-76`
  - Contact: email, phone, iban -> `prisma/schema.prisma:77-79`
  - E-invoice: eInvoiceProvider (enum), eInvoiceApiKeyEncrypted -> `prisma/schema.prisma:81,84`
  - Plan: legalForm (string), entitlements (JSON), featureFlags (JSON) -> `prisma/schema.prisma:85-87`
  - Fiscalization: fiscalEnabled, fiscalEnvironment (FiscalEnv), premisesCode, deviceCode -> `prisma/schema.prisma:88-91`
  - Billing: stripeCustomerId, stripeSubscriptionId, subscriptionStatus, subscriptionPlan -> `prisma/schema.prisma:94-97`
  - Limits: invoiceLimit (default 50), userLimit (default 1), trialEndsAt -> `prisma/schema.prisma:100-102`
  - Relations: users (CompanyUser), contacts, eInvoices, expenses, products, etc. -> `prisma/schema.prisma:104-118`

### Legal Form Enum

```typescript
type LegalForm =
  | "OBRT_PAUSAL" // Paušalni obrt (flat-rate craft)
  | "OBRT_REAL" // Stvarni obrt (real craft)
  | "OBRT_VAT" // Obrt u sustavu PDV-a (VAT craft)
  | "JDOO" // Jednostavno društvo s ograničenom odgovornošću
  | "DOO" // Društvo s ograničenom odgovornošću (LLC)
```

Source: `src/lib/capabilities.ts:3`, `src/app/(dashboard)/settings/plan-settings-form.tsx:10-16`

### Module Entitlements

```typescript
type ModuleKey =
  | "invoicing" // Dokumenti - Invoice management
  | "eInvoicing" // E-Računi - Electronic invoicing
  | "expenses" // Troškovi - Expense tracking
  | "banking" // Banka - Bank integration
  | "reports" // Izvještaji - Reports
  | "settings" // Postavke - Settings
```

Source: `src/lib/capabilities.ts:4`, `src/app/(dashboard)/settings/plan-settings-form.tsx:18-25`

### E-Invoice Providers

```typescript
type EInvoiceProvider =
  | "ie-racuni" // IE Računi (Croatian)
  | "fina" // Fina national clearing
  | "ddd-invoices" // DDD Invoices (PEPPOL)
  | "mock" // Test mode
```

Source: `src/lib/validations/company.ts:21`, `src/app/(dashboard)/settings/einvoice-settings-form.tsx:21-46`

### Field Constraints

**Company Profile (companySchema)**:

- **name**: Minimum 2 characters, required -> `src/lib/validations/company.ts:7`
- **oib**: Exactly 11 digits (regex `^\d{11}$`), required, unique -> `src/lib/validations/company.ts:8`
- **vatNumber**: Optional string -> `src/lib/validations/company.ts:9`
- **address**: Minimum 1 character, required -> `src/lib/validations/company.ts:10`
- **city**: Minimum 1 character, required -> `src/lib/validations/company.ts:11`
- **postalCode**: Minimum 1 character, required -> `src/lib/validations/company.ts:12`
- **country**: String, default "HR" -> `src/lib/validations/company.ts:13`
- **email**: Valid email format or empty string -> `src/lib/validations/company.ts:14`
- **phone**: Optional string -> `src/lib/validations/company.ts:15`
- **iban**: Optional string -> `src/lib/validations/company.ts:16`
- **isVatPayer**: Boolean, default false -> `src/lib/validations/company.ts:17`

**Plan Settings (planSettingsSchema)**:

- **legalForm**: Enum with 5 values, required -> `src/lib/validations/company.ts:26`
- **isVatPayer**: Boolean, default false -> `src/lib/validations/company.ts:27`
- **entitlements**: Array of module keys, minimum 1 required -> `src/lib/validations/company.ts:28`

## Edit Restrictions

### Ownership Validation

- Company settings can only be edited by OWNER or ADMIN roles -> `src/app/actions/company.ts:57-67,95-105,135-145`
- User-company relationship verified through CompanyUser table -> `src/app/actions/company.ts:57-63`
- Unauthorized access returns error "Unauthorized" -> `src/app/actions/company.ts:66,104,144`

### Immutable Fields

**OIB cannot be changed after company creation**:

- OIB field is disabled in UI with gray background -> `src/app/(dashboard)/settings/company-settings-form.tsx:95-98`
- Helper text states "OIB se ne može mijenjati nakon kreiranja tvrtke" -> `src/app/(dashboard)/settings/company-settings-form.tsx:98`
- OIB is unique identifier for company and used in VAT number generation

### Validation Rules

All updates must pass respective Zod schemas:

- Company profile validated with companySchema -> `src/app/actions/company.ts:69-73`
- E-invoice settings validated with companySettingsSchema -> `src/app/actions/company.ts:107-111`
- Plan settings validated with planSettingsSchema -> `src/app/actions/company.ts:147-150`
- Invalid fields return error with flattened details -> `src/app/actions/company.ts:72,110,149`

## Field Validation

### Company Profile Fields

Validated through companySchema:

- **name**: String, min 2 chars -> `src/lib/validations/company.ts:7`
- **oib**: String, regex `^\d{11}$` -> `src/lib/validations/company.ts:8`
- **vatNumber**: String, optional, auto-generated if isVatPayer=true -> `src/lib/validations/company.ts:9`
- **address**: String, min 1 char -> `src/lib/validations/company.ts:10`
- **city**: String, min 1 char -> `src/lib/validations/company.ts:11`
- **postalCode**: String, min 1 char -> `src/lib/validations/company.ts:12`
- **country**: String, default "HR" -> `src/lib/validations/company.ts:13`
- **email**: Email format or empty string -> `src/lib/validations/company.ts:14`
- **phone**: String, optional -> `src/lib/validations/company.ts:15`
- **iban**: String, optional -> `src/lib/validations/company.ts:16`
- **isVatPayer**: Boolean, default false -> `src/lib/validations/company.ts:17`

### E-Invoice Settings Fields

Validated through companySettingsSchema:

- **eInvoiceProvider**: Enum ("ie-racuni", "fina", "ddd-invoices", "mock"), optional -> `src/lib/validations/company.ts:21`
- **eInvoiceApiKey**: String, optional, encrypted before storage -> `src/lib/validations/company.ts:22`

### Plan Settings Fields

Validated through planSettingsSchema:

- **legalForm**: Enum with 5 business types -> `src/lib/validations/company.ts:26`
- **isVatPayer**: Boolean, affects field visibility -> `src/lib/validations/company.ts:27`
- **entitlements**: Array of module keys, min 1 required -> `src/lib/validations/company.ts:28`

### Server-Side Validation

```typescript
const validatedFields = companySchema.safeParse(formData)

if (!validatedFields.success) {
  return { error: "Invalid fields", details: validatedFields.error.flatten() }
}
```

Source: `src/app/actions/company.ts:69-73`

### Client-Side Validation

- React Hook Form with Zod resolver for all forms -> `src/app/(dashboard)/settings/company-settings-form.tsx:31-32`
- Real-time validation on blur/change -> `src/app/(dashboard)/settings/company-settings-form.tsx:28-30`
- Error messages displayed inline below fields -> `src/app/(dashboard)/settings/company-settings-form.tsx:86-87`
- Form-level errors shown in banner at top -> `src/app/(dashboard)/settings/company-settings-form.tsx:70-79`

## Security Features

### Authentication & Authorization

- Requires authenticated user via requireAuth -> `src/app/(dashboard)/settings/page.tsx:49`
- Requires user to have company via requireCompany -> `src/app/(dashboard)/settings/page.tsx:50`
- Company ownership verified in all update actions -> `src/app/actions/company.ts:57-67`
- Role-based access: Only OWNER and ADMIN can update settings -> `src/app/actions/company.ts:61`

### Permission Requirements

- **View Settings**: Standard authentication, any company member
- **Update Company Profile**: OWNER or ADMIN role -> `src/app/actions/company.ts:57-67`
- **Update E-Invoice Settings**: OWNER or ADMIN role -> `src/app/actions/company.ts:95-105`
- **Update Plan Settings**: OWNER or ADMIN role -> `src/app/actions/company.ts:135-145`

### Data Integrity

- Zod schema validation prevents invalid data -> `src/lib/validations/company.ts:6-29`
- OIB uniqueness enforced at database level -> `prisma/schema.prisma:71`
- OIB format validation (exactly 11 digits) -> `src/lib/validations/company.ts:4,8`
- Email format validation when provided -> `src/lib/validations/company.ts:14`
- Entitlements array must contain at least 1 module -> `src/lib/validations/company.ts:28`

### Data Privacy & Encryption

- E-invoice API keys encrypted before storage -> `src/app/actions/company.ts:119-120`
- Encrypted keys never displayed in UI -> `src/app/(dashboard)/settings/einvoice-settings-form.tsx:63`
- API key input always empty on form load for security -> `src/app/(dashboard)/settings/einvoice-settings-form.tsx:63`
- Company data isolated by tenant context in other operations
- Password fields use type="password" for API keys -> `src/app/(dashboard)/settings/einvoice-settings-form.tsx:159`

### Audit Trail

- All updates trigger timestamp changes via updatedAt field -> `prisma/schema.prisma:83`
- Changes can be tracked in AuditLog table -> `prisma/schema.prisma:104`
- Cache revalidation ensures immediate UI updates -> `src/app/actions/company.ts:85,125,163-164`

## Dependencies

- **Depends on**:
  - Authentication system - User session management
  - Authorization (RBAC) - Role verification for OWNER/ADMIN
  - Tenant context - Automatic company filtering in queries
  - Encryption service - API key encryption (src/lib/secrets.ts)

- **Depended by**:
  - All modules - Capabilities derive feature visibility from company settings
  - E-Invoice system - Uses provider and API key configuration
  - Reports - Legal form affects available reports (KPR, Paušalni obrt)
  - Invoicing - VAT payer status affects invoice templates
  - Onboarding - Creates initial company record
  - Dashboard - Displays company info and compliance status

## Integrations

### Prisma ORM

- Direct company record updates via db.company.update -> `src/app/actions/company.ts:77-83,115-123,154-161`
- CompanyUser relationship queries for authorization -> `src/app/actions/company.ts:57-63`
- Transaction safety through Prisma's atomic operations
- Unique constraint enforcement on OIB field -> `prisma/schema.prisma:71`

### Next.js Cache

- revalidatePath("/dashboard") after company updates -> `src/app/actions/company.ts:85,164`
- revalidatePath("/settings") after settings updates -> `src/app/actions/company.ts:125,163`
- Server component re-renders on navigation -> `src/app/(dashboard)/settings/page.tsx:48`
- router.refresh() forces client-side refresh -> `src/app/(dashboard)/settings/company-settings-form.tsx:65`

### Capabilities System

- deriveCapabilities() computes feature visibility from company config -> `src/lib/capabilities.ts:28-59`
- Legal form affects requireVatFields, allowReverseCharge, requireOib -> `src/lib/capabilities.ts:43-45`
- Module entitlements control sidebar navigation and page access
- Feature flags enable experimental features per company -> `src/lib/capabilities.ts:31`

### Encryption Service

- encryptSecret() encrypts API keys before database storage -> `src/app/actions/company.ts:120`
- Keys stored in eInvoiceApiKeyEncrypted field -> `prisma/schema.prisma:84`
- Decryption happens in e-invoice provider integrations
- Encrypted values never exposed to client

## UI Components

### Settings Page Components

- **Settings Hub**: Main tabbed interface -> `src/app/(dashboard)/settings/page.tsx:55-252`
- **Tab Navigation**: Left sidebar with 5 tabs (company, einvoice, plan, security, compliance) -> `src/app/(dashboard)/settings/page.tsx:11-42,66-126`
- **CompanySettingsForm**: Basic company info form -> `src/app/(dashboard)/settings/company-settings-form.tsx:21-166`
- **EInvoiceSettingsForm**: E-invoice provider configuration -> `src/app/(dashboard)/settings/einvoice-settings-form.tsx:48-197`
- **PlanSettingsForm**: Legal form and entitlements -> `src/app/(dashboard)/settings/plan-settings-form.tsx:27-122`
- **StatusCard**: Compliance status indicators -> `src/app/(dashboard)/settings/page.tsx:256-282`
- **Card/CardHeader/CardContent**: Consistent card styling -> `src/app/(dashboard)/settings/page.tsx:130-140`

### Form Sections

**Company Tab** -> `src/app/(dashboard)/settings/company-settings-form.tsx:69-164`:

1. Basic information: Name (required), OIB (disabled)
2. Address: Street, postal code, city
3. Contact: Email, phone
4. Banking: IBAN
5. Tax: VAT payer checkbox

**E-Invoice Tab** -> `src/app/(dashboard)/settings/einvoice-settings-form.tsx:110-195`:

1. Provider selection dropdown
2. Provider information card
3. API key input (for non-mock)
4. Test connection button
5. Save settings button

**Plan Tab** -> `src/app/(dashboard)/settings/plan-settings-form.tsx:56-120`:

1. Legal form dropdown
2. VAT payer checkbox
3. Module entitlements grid (6 checkboxes)
4. Save plan button

**Compliance Tab** -> `src/app/(dashboard)/settings/page.tsx:185-249`:

1. Three status cards (VAT, Provider, IBAN)
2. Deadline timeline card
3. Quick links to Premises and Audit Log

### Advanced Settings Links

Navigation links in left sidebar -> `src/app/(dashboard)/settings/page.tsx:98-125`:

- **Fiskalizacija** (/settings/fiscalisation) - Certificate management
- **Poslovni prostori** (/settings/premises) - Business premises codes
- **Revizijski dnevnik** (/settings/audit-log) - Audit trail

## Error Handling

- **Unauthorized access**: Returns { error: "Unauthorized" } -> `src/app/actions/company.ts:66,104,144`
- **Invalid fields**: Returns validation errors with details -> `src/app/actions/company.ts:72,110,149`
- **Duplicate OIB**: "A company with this OIB already exists" -> `src/app/actions/company.ts:28`
- **OIB format error**: "OIB must be exactly 11 digits" -> `src/lib/validations/company.ts:8`
- **Email format error**: Zod email validator message -> `src/lib/validations/company.ts:14`
- **Minimum name length**: "Company name must be at least 2 characters" -> `src/lib/validations/company.ts:7`
- **Empty entitlements**: Min 1 module required -> `src/lib/validations/company.ts:28`
- **Form submission error**: Red banner at top of form -> `src/app/(dashboard)/settings/company-settings-form.tsx:70-74`
- **Success confirmation**: Green banner and toast notification -> `src/app/(dashboard)/settings/company-settings-form.tsx:75-78`
- **Missing API key on test**: "API ključ je obavezan za testiranje veze" -> `src/app/(dashboard)/settings/einvoice-settings-form.tsx:101`

## Verification Checklist

- [x] User can access settings page from dashboard
- [x] Tab navigation works correctly with query params
- [x] Company profile form pre-populates with existing data
- [x] OIB field is disabled and cannot be modified
- [x] All company fields can be updated except OIB
- [x] VAT number auto-generates when isVatPayer is checked
- [x] E-invoice provider can be selected and configured
- [x] API keys are encrypted before storage
- [x] Legal form dropdown shows all 5 Croatian business types
- [x] Module entitlements can be enabled/disabled
- [x] At least 1 module must be enabled
- [x] Compliance tab shows current status indicators
- [x] Only OWNER and ADMIN can update settings
- [x] Client-side validation shows errors inline
- [x] Server-side validation prevents invalid data
- [x] Cache invalidation refreshes UI after updates
- [x] Success toast confirms saved changes
- [x] Error messages are clear and localized (Croatian)
- [x] Links to advanced settings sections work correctly

## Related Features

- **Create Company**: `src/app/actions/company.ts:11-48` (Onboarding)
- **Switch Company**: `src/app/actions/company.ts:168-196` (Multi-tenant)
- **Company Switcher**: `src/components/layout/company-switcher.tsx` (Navigation)
- **Business Premises**: `src/app/(dashboard)/settings/premises/page.tsx` (F069)
- **Fiscalisation Settings**: `src/app/(dashboard)/settings/fiscalisation/page.tsx` (F070)
- **Audit Log**: `src/app/(dashboard)/settings/audit-log/page.tsx` (F071)
- **Capabilities Derivation**: `src/lib/capabilities.ts` (Field visibility)

## Evidence Links

1. `src/app/(dashboard)/settings/page.tsx:1-282` - Main settings page with tab navigation and all sections
2. `src/app/(dashboard)/settings/company-settings-form.tsx:1-165` - Company profile form with validation
3. `src/app/(dashboard)/settings/einvoice-settings-form.tsx:1-197` - E-invoice provider configuration form
4. `src/app/(dashboard)/settings/plan-settings-form.tsx:1-122` - Legal form and entitlements form
5. `src/app/actions/company.ts:50-87` - updateCompany server action with role validation
6. `src/app/actions/company.ts:89-127` - updateCompanySettings server action with encryption
7. `src/app/actions/company.ts:129-166` - updateCompanyPlan server action
8. `src/lib/validations/company.ts:1-33` - All company validation schemas (3 schemas)
9. `src/lib/capabilities.ts:1-59` - Capabilities system deriving visibility from company config
10. `src/lib/auth-utils.ts:43-49` - requireCompany helper for authentication
11. `prisma/schema.prisma:68-118` - Company model with all fields and relations
12. `src/components/onboarding/step-basic-info.tsx:1-93` - Initial company creation flow
13. `src/components/onboarding/step-contact-tax.tsx:1-130` - Company creation with tax info
14. `src/lib/field-visibility.ts:1-13` - Field visibility derived from capabilities
