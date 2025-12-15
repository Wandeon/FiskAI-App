# Feature: Create Contact (F046)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 21

## Purpose

The Create Contact feature enables users to create customer and supplier contacts with intelligent OIB validation, automatic company data lookup via VIES/Sudski Registar APIs, postal code/city auto-suggestion, and flexible contact type classification. The feature includes smart field auto-population based on country selection, payment terms quick-select buttons, and comprehensive validation to ensure data integrity, forming the core contact management workflow in FiskAI.

## User Entry Points

| Type   | Path           | Evidence                                            |
| ------ | -------------- | --------------------------------------------------- |
| Page   | /contacts/new  | `src/app/(dashboard)/contacts/new/page.tsx:26`      |
| Action | createContact  | `src/app/actions/contact.ts:9`                      |
| Button | Spremi kontakt | `src/app/(dashboard)/contacts/new/page.tsx:344-346` |

## Core Flow

1. User navigates to /contacts/new → `src/app/(dashboard)/contacts/new/page.tsx:26`
2. System initializes form with default values (CUSTOMER type, HR country, 15 days payment terms) → `src/app/(dashboard)/contacts/new/page.tsx:41-45`
3. User selects country and contact type → `src/app/(dashboard)/contacts/new/page.tsx:134-152`
4. For Croatian contacts (country=HR), user enters OIB → `src/app/(dashboard)/contacts/new/page.tsx:188-201`
5. System validates OIB format and checksum (11 digits, ISO 7064 MOD 11-10) → `src/lib/oib-lookup.ts:86-102`
6. System auto-triggers OIB lookup when 11 digits entered → `src/components/ui/oib-input.tsx:106-117`
7. System queries VIES API first for VAT-registered companies → `src/lib/oib-lookup.ts:108-165`
8. If VIES fails, system queries Sudski Registar API → `src/lib/oib-lookup.ts:171-253`
9. System auto-fills name, address, city, postal code, VAT number from lookup → `src/app/(dashboard)/contacts/new/page.tsx:91-106`
10. System suggests city when postal code entered (or vice versa) → `src/app/(dashboard)/contacts/new/page.tsx:58-70`
11. User sets payment terms using quick-select buttons or manual input → `src/app/(dashboard)/contacts/new/page.tsx:229-260`
12. User fills remaining fields (email, phone, etc.) → `src/app/(dashboard)/contacts/new/page.tsx:318-340`
13. User submits form, triggering client-side validation → `src/app/(dashboard)/contacts/new/page.tsx:72-89`
14. System calls createContact server action with validated data → `src/app/actions/contact.ts:9-26`
15. System validates fields using Zod schema → `src/app/actions/contact.ts:13-17`
16. System creates Contact record with tenant isolation → `src/app/actions/contact.ts:19-21`
17. System revalidates /contacts route cache → `src/app/actions/contact.ts:23`
18. User redirected to /contacts list → `src/app/(dashboard)/contacts/new/page.tsx:88`

## Key Modules

| Module                    | Purpose                                           | Location                                    |
| ------------------------- | ------------------------------------------------- | ------------------------------------------- |
| NewContactPage            | Client component for contact creation form        | `src/app/(dashboard)/contacts/new/page.tsx` |
| createContact             | Server action for contact creation                | `src/app/actions/contact.ts:9-26`           |
| OibInput                  | Smart OIB input with auto-lookup functionality    | `src/components/ui/oib-input.tsx`           |
| lookupOib                 | Main OIB lookup orchestrator (VIES + Sudski)      | `src/lib/oib-lookup.ts:258-284`             |
| lookupVies                | VIES API integration for VAT data                 | `src/lib/oib-lookup.ts:108-165`             |
| lookupSudskiRegistar      | Sudski Registar API for court-registered entities | `src/lib/oib-lookup.ts:171-253`             |
| validateOib               | OIB format and checksum validation                | `src/lib/oib-lookup.ts:86-102`              |
| lookupCityByPostalCode    | Postal code to city suggestion                    | `src/lib/postal-codes.ts:33-37`             |
| lookupPostalByCity        | City to postal code suggestion                    | `src/lib/postal-codes.ts:39-46`             |
| contactSchema             | Zod validation schema for contact data            | `src/lib/validations/contact.ts:3-15`       |
| requireCompanyWithContext | Tenant-isolated database operations wrapper       | `src/lib/auth-utils.ts:75-89`               |

## Contact Form Features

### Basic Information Fields

- **Contact Type Selection** → `src/app/(dashboard)/contacts/new/page.tsx:132-145`
  - Dropdown with 3 options: CUSTOMER, SUPPLIER, BOTH → `src/app/(dashboard)/contacts/new/page.tsx:138-140`
  - Defaults to CUSTOMER → `src/app/(dashboard)/contacts/new/page.tsx:42`
  - Determines contact relationship with company → `prisma/schema.prisma:151`
  - Required field with validation → `src/lib/validations/contact.ts:4`

- **Country Selection** → `src/app/(dashboard)/contacts/new/page.tsx:147-186`
  - Defaults to HR (Croatia) → `src/app/(dashboard)/contacts/new/page.tsx:43`
  - EU countries in optgroup → `src/app/(dashboard)/contacts/new/page.tsx:154-181`
  - "OTHER" for non-EU countries → `src/app/(dashboard)/contacts/new/page.tsx:183`
  - Determines field visibility (OIB vs VAT number) → `src/app/(dashboard)/contacts/new/page.tsx:53-54`
  - Stored with default "HR" → `src/lib/validations/contact.ts:11`

- **OIB Field (Croatian contacts only)** → `src/app/(dashboard)/contacts/new/page.tsx:188-201`
  - Shown when country=HR → `src/app/(dashboard)/contacts/new/page.tsx:188`
  - Uses smart OibInput component → `src/components/ui/oib-input.tsx:27-171`
  - Auto-triggers lookup at 11 digits → `src/components/ui/oib-input.tsx:106-117`
  - "Dohvati podatke" button for manual lookup → `src/components/ui/oib-input.tsx:139-157`
  - Validates 11-digit format → `src/lib/validations/contact.ts:6`
  - ISO 7064 MOD 11-10 checksum validation → `src/lib/oib-lookup.ts:86-102`
  - Visual feedback: loader/check/error icons → `src/components/ui/oib-input.tsx:134-137`

- **VAT Number Field (non-Croatian contacts)** → `src/app/(dashboard)/contacts/new/page.tsx:203-217`
  - Shown when country≠HR → `src/app/(dashboard)/contacts/new/page.tsx:203`
  - Label changes: "PDV ID (VAT)" for EU, "Porezni broj" for non-EU → `src/app/(dashboard)/contacts/new/page.tsx:205`
  - Placeholder shows country code for EU → `src/app/(dashboard)/contacts/new/page.tsx:209`
  - Optional field → `src/lib/validations/contact.ts:7`

- **Name Field** → `src/app/(dashboard)/contacts/new/page.tsx:219-226`
  - Required field → `src/app/(dashboard)/contacts/new/page.tsx:220`
  - Auto-filled from OIB lookup → `src/app/(dashboard)/contacts/new/page.tsx:99`
  - Minimum 2 characters → `src/lib/validations/contact.ts:5`
  - Validation error display → `src/app/(dashboard)/contacts/new/page.tsx:224`

- **Payment Terms** → `src/app/(dashboard)/contacts/new/page.tsx:228-260`
  - Quick-select buttons: 0 (Odmah), 7, 15, 30 days → `src/app/(dashboard)/contacts/new/page.tsx:231-246`
  - Manual input field (0-365 days) → `src/app/(dashboard)/contacts/new/page.tsx:247-253`
  - Defaults to 15 days → `src/app/(dashboard)/contacts/new/page.tsx:44`
  - Used for automatic due date calculation → `src/app/(dashboard)/contacts/new/page.tsx:255`
  - Stored as integer → `src/lib/validations/contact.ts:14`

- **VAT ID (auto-filled for Croatian contacts)** → `src/app/(dashboard)/contacts/new/page.tsx:262-274`
  - Shown for Croatian contacts → `src/app/(dashboard)/contacts/new/page.tsx:262`
  - Auto-filled as HR + OIB → `src/app/(dashboard)/contacts/new/page.tsx:103`
  - Disabled field (read-only) → `src/app/(dashboard)/contacts/new/page.tsx:268`
  - Format: HR{11-digit OIB} → `src/lib/oib-lookup.ts:150,238`

### Address Fields

- **Address Section** → `src/app/(dashboard)/contacts/new/page.tsx:277-316`
  - Street and number field → `src/app/(dashboard)/contacts/new/page.tsx:283-289`
  - Postal code field → `src/app/(dashboard)/contacts/new/page.tsx:291-302`
  - City field → `src/app/(dashboard)/contacts/new/page.tsx:304-315`
  - All fields optional → `src/lib/validations/contact.ts:8-10`
  - Auto-filled from OIB lookup → `src/app/(dashboard)/contacts/new/page.tsx:100-102`

- **Smart Postal/City Suggestions** → `src/app/(dashboard)/contacts/new/page.tsx:58-70`
  - City suggested when postal code entered → `src/app/(dashboard)/contacts/new/page.tsx:58-63`
  - Postal code suggested when city entered → `src/app/(dashboard)/contacts/new/page.tsx:65-70`
  - Only triggers if destination field empty → `src/app/(dashboard)/contacts/new/page.tsx:60,67`
  - Respects user touch state to avoid overwriting → `src/app/(dashboard)/contacts/new/page.tsx:30-31`
  - Covers 31 major Croatian cities → `src/lib/postal-codes.ts:3-31`

### Contact Information Fields

- **Email Field** → `src/app/(dashboard)/contacts/new/page.tsx:323-331`
  - Optional email input → `src/app/(dashboard)/contacts/new/page.tsx:325-330`
  - Email format validation → `src/lib/validations/contact.ts:12`
  - Error display → `src/app/(dashboard)/contacts/new/page.tsx:329`

- **Phone Field** → `src/app/(dashboard)/contacts/new/page.tsx:333-339`
  - Optional phone input → `src/app/(dashboard)/contacts/new/page.tsx:334-338`
  - No format validation → `src/lib/validations/contact.ts:13`
  - Placeholder shows Croatian format → `src/app/(dashboard)/contacts/new/page.tsx:337`

## OIB Lookup Integration

### OibInput Component

- **Auto-Lookup Behavior** → `src/components/ui/oib-input.tsx:106-117`
  - Triggers when value reaches 11 digits → `src/components/ui/oib-input.tsx:109`
  - Validates regex before lookup → `src/components/ui/oib-input.tsx:112`
  - Only executes once per OIB value → `src/components/ui/oib-input.tsx:111`
  - Prevents duplicate lookups → `src/components/ui/oib-input.tsx:40,101`

- **Manual Lookup Button** → `src/components/ui/oib-input.tsx:139-157`
  - "Dohvati podatke" button → `src/components/ui/oib-input.tsx:154`
  - Validates 11 digits before proceeding → `src/components/ui/oib-input.tsx:96-100`
  - Shows loading state → `src/components/ui/oib-input.tsx:146-150`
  - Disabled during lookup → `src/components/ui/oib-input.tsx:143`

- **Visual Feedback** → `src/components/ui/oib-input.tsx:133-169`
  - Loader icon while looking up → `src/components/ui/oib-input.tsx:134`
  - Green check on success → `src/components/ui/oib-input.tsx:135`
  - Yellow alert on error → `src/components/ui/oib-input.tsx:136`
  - Progress message: "Provjeravam VIES…" → `src/components/ui/oib-input.tsx:160-162`
  - Success message with source info → `src/components/ui/oib-input.tsx:163-165`
  - Error message display → `src/components/ui/oib-input.tsx:166-168`

### OIB Lookup API

- **API Endpoint** → `src/app/api/oib/lookup/route.ts:42-100`
  - POST /api/oib/lookup → `src/app/api/oib/lookup/route.ts:42`
  - Rate limiting: 10 requests per minute per IP → `src/app/api/oib/lookup/route.ts:8-30`
  - Input validation: OIB required → `src/app/api/oib/lookup/route.ts:65-73`
  - Format validation before lookup → `src/app/api/oib/lookup/route.ts:76-84`
  - Returns JSON with success/error → `src/app/api/oib/lookup/route.ts:89`

- **OIB Validation** → `src/lib/oib-lookup.ts:86-102`
  - Validates 11-digit format → `src/lib/oib-lookup.ts:88-90`
  - ISO 7064 MOD 11-10 checksum algorithm → `src/lib/oib-lookup.ts:93-97`
  - Returns boolean → `src/lib/oib-lookup.ts:101`

- **Lookup Orchestration** → `src/lib/oib-lookup.ts:258-284`
  - Validates OIB first → `src/lib/oib-lookup.ts:260-265`
  - Tries VIES API first → `src/lib/oib-lookup.ts:268-271`
  - Falls back to Sudski Registar → `src/lib/oib-lookup.ts:274-277`
  - Returns consolidated error if both fail → `src/lib/oib-lookup.ts:280-283`

### VIES API Integration

- **VIES Lookup** → `src/lib/oib-lookup.ts:108-165`
  - EU VAT Information Exchange System → `src/lib/oib-lookup.ts:110`
  - Endpoint: ec.europa.eu/taxation_customs/vies/rest-api → `src/lib/oib-lookup.ts:110`
  - 10-second timeout → `src/lib/oib-lookup.ts:113`
  - Returns company name, address → `src/lib/oib-lookup.ts:146-150`
  - Parses address into street/city/postal → `src/lib/oib-lookup.ts:142`
  - Generates VAT number as HR+OIB → `src/lib/oib-lookup.ts:150`
  - Source tag: "vies" → `src/lib/oib-lookup.ts:151`

- **Address Parsing** → `src/lib/oib-lookup.ts:322-357`
  - Splits on newline or comma → `src/lib/oib-lookup.ts:328`
  - Extracts 5-digit postal code → `src/lib/oib-lookup.ts:339`
  - Separates street from city line → `src/lib/oib-lookup.ts:334,344`

- **Name Extraction** → `src/lib/oib-lookup.ts:293-320`
  - Extracts short name from legal description → `src/lib/oib-lookup.ts:298`
  - Identifies d.o.o., d.d., j.d.o.o. suffixes → `src/lib/oib-lookup.ts:303-311`
  - Truncates very long names → `src/lib/oib-lookup.ts:316-318`

### Sudski Registar API Integration

- **OAuth Authentication** → `src/lib/oib-lookup.ts:45-80`
  - Client credentials flow → `src/lib/oib-lookup.ts:60`
  - Token caching with expiry → `src/lib/oib-lookup.ts:40,47-48`
  - 5-minute buffer before expiry → `src/lib/oib-lookup.ts:47`
  - Basic auth header → `src/lib/oib-lookup.ts:52,57`

- **Company Lookup** → `src/lib/oib-lookup.ts:171-253`
  - Endpoint: sudreg-data.gov.hr/api/javni/detalji_subjekta → `src/lib/oib-lookup.ts:184`
  - Query by OIB → `src/lib/oib-lookup.ts:184`
  - 15-second timeout → `src/lib/oib-lookup.ts:182`
  - Extracts short company name → `src/lib/oib-lookup.ts:214`
  - Parses address from sjediste object → `src/lib/oib-lookup.ts:217-226`
  - Derives postal code from zupanija → `src/lib/oib-lookup.ts:228-230`
  - Source tag: "sudski-registar" → `src/lib/oib-lookup.ts:239`

- **Postal Code Derivation** → `src/lib/oib-lookup.ts:362-390`
  - Maps 21 županijas to postal codes → `src/lib/oib-lookup.ts:364-386`
  - Approximate mapping (city center codes) → `src/lib/oib-lookup.ts:363`

## Server-Side Processing

### Authentication & Tenant Isolation

- **Multi-Layer Security** → `src/app/actions/contact.ts:10-12`
  - requireAuth() validates session → `src/lib/auth-utils.ts:12-18`
  - requireCompanyWithContext() enforces tenant scope → `src/lib/auth-utils.ts:75-89`
  - runWithTenant() wraps database operations → `src/lib/auth-utils.ts:86-88`
  - All queries auto-filtered by companyId → `src/lib/prisma-extensions.ts:53-76`

### Form Validation

- **Client-Side Validation** → `src/app/(dashboard)/contacts/new/page.tsx:39-40`
  - Zod resolver on form → `src/app/(dashboard)/contacts/new/page.tsx:40`
  - Real-time field validation → `src/app/(dashboard)/contacts/new/page.tsx:36`
  - Error messages displayed inline → `src/app/(dashboard)/contacts/new/page.tsx:142-144,224,257-259,329`

- **Server-Side Validation** → `src/app/actions/contact.ts:13-17`
  - Zod schema safeParse → `src/app/actions/contact.ts:13`
  - Returns flattened errors → `src/app/actions/contact.ts:16`
  - Prevents invalid data from reaching database → `src/app/actions/contact.ts:15-17`

### Database Transaction

- **Contact Creation** → `src/app/actions/contact.ts:19-21`
  - Creates Contact record → `src/app/actions/contact.ts:19`
  - Auto-adds companyId via tenant middleware → `src/lib/prisma-extensions.ts:53-76`
  - Returns created contact → `src/app/actions/contact.ts:24`
  - Revalidates /contacts route → `src/app/actions/contact.ts:23`

## Validation

### Contact Schema

- **Zod Validation Rules** → `src/lib/validations/contact.ts:3-15`
  - type: enum CUSTOMER/SUPPLIER/BOTH (required) → `src/lib/validations/contact.ts:4`
  - name: min 2 characters (required) → `src/lib/validations/contact.ts:5`
  - oib: 11 digits regex, optional or empty string → `src/lib/validations/contact.ts:6`
  - vatNumber: optional string → `src/lib/validations/contact.ts:7`
  - address: optional string → `src/lib/validations/contact.ts:8`
  - city: optional string → `src/lib/validations/contact.ts:9`
  - postalCode: optional string → `src/lib/validations/contact.ts:10`
  - country: defaults to "HR" → `src/lib/validations/contact.ts:11`
  - email: email format, optional or empty → `src/lib/validations/contact.ts:12`
  - phone: optional string → `src/lib/validations/contact.ts:13`
  - paymentTermsDays: integer 0-365, defaults to 15 → `src/lib/validations/contact.ts:14`

### Input Constraints

- **OIB Validation** → `src/lib/validations/contact.ts:6`
  - Exactly 11 digits → `src/lib/validations/contact.ts:6`
  - Regex pattern: ^\d{11}$ → `src/lib/validations/contact.ts:6`
  - Checksum validation in API → `src/lib/oib-lookup.ts:86-102`

- **Payment Terms** → `src/lib/validations/contact.ts:14`
  - Integer type coercion → `src/lib/validations/contact.ts:14`
  - Minimum: 0 days → `src/lib/validations/contact.ts:14`
  - Maximum: 365 days → `src/lib/validations/contact.ts:14`

## Data

### Database Tables

- **Contact** → `prisma/schema.prisma:148-171`
  - Primary contact record
  - Key fields:
    - id: CUID primary key → `prisma/schema.prisma:149`
    - companyId: Foreign key to Company (tenant isolation) → `prisma/schema.prisma:150`
    - type: ContactType enum (CUSTOMER/SUPPLIER/BOTH) → `prisma/schema.prisma:151`
    - name: Contact name (required) → `prisma/schema.prisma:152`
    - oib: Croatian tax ID (optional) → `prisma/schema.prisma:153`
    - vatNumber: VAT identification (optional) → `prisma/schema.prisma:154`
    - address: Street address (optional) → `prisma/schema.prisma:155`
    - city: City name (optional) → `prisma/schema.prisma:156`
    - postalCode: Postal code (optional) → `prisma/schema.prisma:157`
    - country: Default "HR" → `prisma/schema.prisma:158`
    - email: Email address (optional) → `prisma/schema.prisma:159`
    - phone: Phone number (optional) → `prisma/schema.prisma:160`
    - paymentTermsDays: Default 15 days → `prisma/schema.prisma:163`
  - Relations:
    - company: Company relation → `prisma/schema.prisma:164`
    - eInvoicesAsBuyer: E-invoices where contact is buyer → `prisma/schema.prisma:165`
    - eInvoicesAsSeller: E-invoices where contact is seller → `prisma/schema.prisma:166`
    - expensesAsVendor: Expenses where contact is vendor → `prisma/schema.prisma:167`
  - Indexes: companyId, oib → `prisma/schema.prisma:169-170`

### Enums

- **ContactType** → `prisma/schema.prisma:792-796`
  - CUSTOMER: Only buyer → `prisma/schema.prisma:793`
  - SUPPLIER: Only vendor → `prisma/schema.prisma:794`
  - BOTH: Can be buyer or vendor → `prisma/schema.prisma:795`

## Integrations

### VIES API

- **EU VAT Validation** → `src/lib/oib-lookup.ts:108-165`
  - REST API endpoint
  - No authentication required
  - Returns VAT validity and company data
  - 10-second timeout protection
  - Covers all VAT-registered entities

### Sudski Registar API

- **Croatian Court Registry** → `src/lib/oib-lookup.ts:171-253`
  - OAuth 2.0 client credentials
  - Government-maintained database
  - Court-registered companies (d.o.o., j.d.o.o., d.d.)
  - 15-second timeout protection
  - Token caching for performance

### Toast Notifications

- **User Feedback** → `src/lib/toast.ts:1-32`
  - Success: "Pronađeno! Podaci o tvrtki su automatski popunjeni" → `src/app/(dashboard)/contacts/new/page.tsx:105`
  - Error: OIB lookup failures → `src/app/(dashboard)/contacts/new/page.tsx:109`
  - Error: Form validation errors → `src/app/(dashboard)/contacts/new/page.tsx:117-120`

## Dependencies

- **Depends on**:
  - [[auth-login]] - User authentication required → `src/app/actions/contact.ts:10`
  - [[company-management]] - Company must exist → `src/lib/auth-utils.ts:84`
  - [[tenant-isolation]] - Multi-tenant data separation → `src/lib/prisma-extensions.ts:53-76`
  - [[vies-api]] - EU VAT data lookup → `src/lib/oib-lookup.ts:108-165`
  - [[sudski-registar-api]] - Croatian company registry → `src/lib/oib-lookup.ts:171-253`

- **Depended by**:
  - [[contacts-list]] - Redirects to contact list on success → `src/app/(dashboard)/contacts/new/page.tsx:88`
  - [[expenses-create]] - Contacts used as vendors (SUPPLIER/BOTH) → Referenced in template
  - [[einvoice-create]] - Contacts used as buyers/sellers
  - [[contact-detail]] - Created contacts viewable at /contacts/:id

## Verification Checklist

- [ ] User can access /contacts/new with authentication
- [ ] Form initializes with default values (CUSTOMER, HR, 15 days)
- [ ] Contact type dropdown shows 3 options
- [ ] Country selector shows HR default + EU countries + OTHER
- [ ] OIB field appears only for Croatian contacts
- [ ] VAT number field appears for non-Croatian contacts
- [ ] OIB auto-lookup triggers at 11 digits
- [ ] "Dohvati podatke" button performs manual lookup
- [ ] OIB validation checks format and checksum
- [ ] VIES API lookup populates company data
- [ ] Sudski Registar fallback works when VIES fails
- [ ] Name, address, city, postal code auto-filled from lookup
- [ ] VAT number auto-generated as HR+OIB
- [ ] Postal code entry suggests city
- [ ] City entry suggests postal code
- [ ] Payment terms quick buttons (0, 7, 15, 30) work
- [ ] Manual payment terms input accepts 0-365
- [ ] Email field validates email format
- [ ] Client-side validation shows inline errors
- [ ] Server-side validation prevents invalid data
- [ ] Contact created with tenant isolation
- [ ] User redirected to /contacts on success
- [ ] Toast notification on successful lookup
- [ ] Rate limiting prevents API abuse (10/min)

## Evidence Links

1. Entry point page component → `src/app/(dashboard)/contacts/new/page.tsx:26`
2. Server action for creation → `src/app/actions/contact.ts:9`
3. OIB input component → `src/components/ui/oib-input.tsx:27`
4. Contact validation schema → `src/lib/validations/contact.ts:3`
5. OIB lookup orchestrator → `src/lib/oib-lookup.ts:258`
6. VIES API integration → `src/lib/oib-lookup.ts:108`
7. Sudski Registar integration → `src/lib/oib-lookup.ts:171`
8. OIB validation logic → `src/lib/oib-lookup.ts:86`
9. OIB lookup API endpoint → `src/app/api/oib/lookup/route.ts:42`
10. Postal code lookup → `src/lib/postal-codes.ts:33`
11. City lookup → `src/lib/postal-codes.ts:39`
12. Contact schema definition → `prisma/schema.prisma:148`
13. ContactType enum → `prisma/schema.prisma:792`
14. Tenant context wrapper → `src/lib/auth-utils.ts:75`
15. Database create transaction → `src/app/actions/contact.ts:19`
16. Route revalidation → `src/app/actions/contact.ts:23`
17. Success redirect → `src/app/(dashboard)/contacts/new/page.tsx:88`
18. Auto-lookup trigger → `src/components/ui/oib-input.tsx:106`
19. Address parsing → `src/lib/oib-lookup.ts:322`
20. Name extraction → `src/lib/oib-lookup.ts:293`
21. Rate limiting → `src/app/api/oib/lookup/route.ts:11-30`
