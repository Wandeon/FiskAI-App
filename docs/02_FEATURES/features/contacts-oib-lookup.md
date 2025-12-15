# Feature: OIB Lookup (F051)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 10

## Purpose

The OIB Lookup feature enables automatic retrieval of Croatian company information from official registries by entering an 11-digit OIB (Osobni Identifikacijski Broj - Personal Identification Number). It validates OIB checksums using ISO 7064 MOD 11-10 algorithm, queries VIES (EU VAT Information Exchange System) for VAT-registered entities, and falls back to Sudski Registar (Croatian Court Registry) API for non-VAT companies. When successful, it auto-fills contact forms with name, address, city, postal code, and VAT number, reducing manual data entry and ensuring accuracy.

## User Entry Points

| Type      | Path                 | Evidence                             |
| --------- | -------------------- | ------------------------------------ |
| API POST  | /api/oib/lookup      | `src/app/api/oib/lookup/route.ts:42` |
| Function  | validateOib          | `src/lib/oib-lookup.ts:86`           |
| Function  | lookupOib            | `src/lib/oib-lookup.ts:258`          |
| Function  | lookupVies           | `src/lib/oib-lookup.ts:108`          |
| Function  | lookupSudskiRegistar | `src/lib/oib-lookup.ts:171`          |
| Component | OibInput             | `src/components/ui/oib-input.tsx:27` |

## Core Flow

### OIB Validation Flow

1. User enters 11-digit OIB → `src/components/ui/oib-input.tsx:108-117`
2. Component auto-triggers lookup when 11 digits detected → `src/components/ui/oib-input.tsx:106-117`
3. Client validates format (11 digits) → `src/components/ui/oib-input.tsx:96-100`
4. Client sends POST request to /api/oib/lookup → `src/components/ui/oib-input.tsx:49-55`
5. API checks rate limit (10 requests/minute per IP) → `src/app/api/oib/lookup/route.ts:50`
6. API validates OIB format → `src/app/api/oib/lookup/route.ts:76`
7. API validates OIB checksum (ISO 7064 MOD 11-10) → `src/lib/oib-lookup.ts:86-102`
8. API performs lookup via lookupOib() → `src/app/api/oib/lookup/route.ts:87`
9. System attempts VIES lookup first → `src/lib/oib-lookup.ts:268`
10. If VIES fails, system attempts Sudski Registar lookup → `src/lib/oib-lookup.ts:274`
11. API returns company data (name, address, city, postalCode, vatNumber) → `src/app/api/oib/lookup/route.ts:89`
12. Component auto-fills form fields via callback → `src/components/ui/oib-input.tsx:64-72`
13. Success indicator displayed to user → `src/components/ui/oib-input.tsx:135`

### Manual Lookup Flow (Button)

1. User clicks "Dohvati podatke" button → `src/components/ui/oib-input.tsx:142`
2. Button handler validates format → `src/components/ui/oib-input.tsx:96-100`
3. Button triggers performLookup() → `src/components/ui/oib-input.tsx:102`
4. Same API flow as auto-lookup → `src/components/ui/oib-input.tsx:42-93`

## Key Modules

| Module                    | Purpose                                       | Location                                               |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| OIB Lookup API            | Rate-limited API endpoint for OIB queries     | `src/app/api/oib/lookup/route.ts`                      |
| OIB Lookup Service        | Core lookup logic with VIES + Sudski Registar | `src/lib/oib-lookup.ts`                                |
| OibInput Component        | React component with auto-lookup UI           | `src/components/ui/oib-input.tsx`                      |
| Contact Schema Validation | Zod schema for OIB format validation          | `src/lib/validations/contact.ts:6`                     |
| Contact Create Form       | New contact form with OIB lookup              | `src/app/(dashboard)/contacts/new/page.tsx`            |
| Contact Edit Form         | Edit contact form with OIB lookup             | `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx` |
| Onboarding Basic Info     | Company setup with OIB lookup                 | `src/components/onboarding/step-basic-info.tsx`        |

## Validation Logic

### OIB Format Validation

- **Format Check** → `src/lib/oib-lookup.ts:88`
  - Must be exactly 11 digits
  - Regex pattern: `/^\d{11}$/`
  - No letters, spaces, or special characters allowed

- **Checksum Validation** → `src/lib/oib-lookup.ts:92-101`
  - Algorithm: ISO 7064, MOD 11-10
  - Process:
    1. Initialize sum = 10
    2. For each of first 10 digits:
       - Add digit to sum, modulo 10
       - If sum = 0, set sum = 10
       - Multiply sum by 2, modulo 11
    3. Calculate check digit = (11 - sum) % 10
    4. Verify check digit matches 11th digit
  - Error if checksum invalid: "Neispravan format OIB-a ili kontrolna znamenka"

### Rate Limiting

- **In-Memory Rate Limiting** → `src/app/api/oib/lookup/route.ts:6-30`
  - Limit: 10 requests per minute per IP
  - Window: 60 seconds (rolling)
  - Identifier: IP address from x-forwarded-for or x-real-ip headers
  - Cleanup: Automatic every 5 minutes → `src/app/api/oib/lookup/route.ts:33-40`
  - Error response (429): "Previše zahtjeva. Pokušajte ponovno za nekoliko trenutaka."

### Request Validation

- **Missing OIB** → `src/app/api/oib/lookup/route.ts:65-73`
  - Status: 400
  - Error: "OIB je obavezan"

- **Invalid Format** → `src/app/api/oib/lookup/route.ts:76-84`
  - Status: 400
  - Error: "Neispravan format OIB-a ili kontrolna znamenka"

## External API Integration

### VIES API (EU VAT System)

- **API Endpoint** → `src/lib/oib-lookup.ts:110`
  - URL: `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/HR/vat/{oib}`
  - Method: GET
  - Timeout: 10 seconds
  - Covers: VAT-registered companies (both d.o.o. and obrt)

- **Response Parsing** → `src/lib/oib-lookup.ts:132-152`
  - Validates `data.valid` flag
  - Extracts company name → `src/lib/oib-lookup.ts:146`
  - Parses address string into components → `src/lib/oib-lookup.ts:142`
  - Constructs VAT number: `HR{oib}` → `src/lib/oib-lookup.ts:150`
  - Source tag: "vies"

- **Error Handling** → `src/lib/oib-lookup.ts:125-164`
  - Timeout: "VIES API timeout - pokusajte ponovno"
  - Not found: "OIB nije pronaden u VIES sustavu"
  - API error: "Greska pri dohvatu iz VIES-a"

### Sudski Registar API (Croatian Court Registry)

- **OAuth Authentication** → `src/lib/oib-lookup.ts:45-80`
  - Token URL: `https://sudreg-data.gov.hr/api/oauth/token`
  - Grant type: client_credentials
  - Credentials: Basic Auth (client_id:client_secret base64)
  - Token caching: 5-minute buffer before expiry → `src/lib/oib-lookup.ts:47`
  - Default credentials provided → `src/lib/oib-lookup.ts:34-35`

- **API Endpoint** → `src/lib/oib-lookup.ts:184`
  - URL: `https://sudreg-data.gov.hr/api/javni/detalji_subjekta`
  - Parameters: `tip_identifikatora=oib&identifikator={oib}`
  - Method: GET
  - Authorization: Bearer token
  - Timeout: 15 seconds

- **Response Parsing** → `src/lib/oib-lookup.ts:211-240`
  - Company name: `skracena_tvrtka.ime` or extracted from `tvrtka.ime` → `src/lib/oib-lookup.ts:214`
  - Address: Constructed from `sjediste.ulica` + `sjediste.kucni_broj` → `src/lib/oib-lookup.ts:218-224`
  - City: `sjediste.naziv_naselja` → `src/lib/oib-lookup.ts:225`
  - Postal code: Mapped from `sjediste.sifra_zupanije` → `src/lib/oib-lookup.ts:228-230`
  - VAT number: `HR{oib}` → `src/lib/oib-lookup.ts:238`
  - Source tag: "sudski-registar"

- **Error Handling** → `src/lib/oib-lookup.ts:197-252`
  - Timeout: "Sudski registar API timeout"
  - Not found (error_code 505/508): "OIB nije pronaden u Sudskom registru"
  - API error: "Sudski registar API greska"
  - Auth failure: "Sudski registar autentifikacija nije uspjela"

### Fallback Strategy

- **Dual Lookup** → `src/lib/oib-lookup.ts:258-284`
  1. Try VIES first (faster, covers most businesses) → `src/lib/oib-lookup.ts:268`
  2. If VIES fails, try Sudski Registar → `src/lib/oib-lookup.ts:274`
  3. If both fail, return error: "OIB nije pronaden - unesite podatke rucno" → `src/lib/oib-lookup.ts:282`

## Data Processing

### Name Extraction

- **Short Name Extraction** → `src/lib/oib-lookup.ts:293-320`
  - Handles format: "NAME - drustvo s ogranicenom odgovornoscu..."
  - Splits on " - " separator → `src/lib/oib-lookup.ts:298`
  - Detects legal form from description:
    - "drustvo s ogranicenom" or "d.o.o" → appends " d.o.o." → `src/lib/oib-lookup.ts:303-305`
    - "dionicko drustvo" or "d.d" → appends " d.d." → `src/lib/oib-lookup.ts:306-308`
    - "jednostavno drustvo" or "j.d.o.o" → appends " j.d.o.o." → `src/lib/oib-lookup.ts:309-311`
  - Truncates long names (>60 chars) → `src/lib/oib-lookup.ts:316-318`

### Address Parsing

- **VIES Address Parsing** → `src/lib/oib-lookup.ts:322-357`
  - Format: "STREET NUMBER\nPOSTAL CITY" or "STREET NUMBER, POSTAL CITY"
  - Splits on newline or comma → `src/lib/oib-lookup.ts:328`
  - Extracts street from first line → `src/lib/oib-lookup.ts:334`
  - Extracts postal code (5 digits) and city from last line → `src/lib/oib-lookup.ts:339`
  - Regex: `/^(\d{5})\s+(.+)$/` → `src/lib/oib-lookup.ts:339`

- **Sudski Registar Address Construction**
  - Street: `ulica + " " + kucni_broj` → `src/lib/oib-lookup.ts:219-224`
  - City: Direct from `naziv_naselja` → `src/lib/oib-lookup.ts:225`
  - Postal code: Mapped from zupanija code → `src/lib/oib-lookup.ts:228-230`

### Postal Code Mapping

- **Zupanija to Postal Code** → `src/lib/oib-lookup.ts:362-390`
  - Maps 21 Croatian counties to postal codes
  - Examples:
    - Zagreb (21): 10000
    - Split-Dalmatia (12): 21000
    - Istria (18): 52000
  - Fallback: Empty string if unknown → `src/lib/oib-lookup.ts:389`

## UI Component

### OibInput Component Features

- **Auto-Lookup Trigger** → `src/components/ui/oib-input.tsx:106-117`
  - Triggers when 11 digits entered
  - Debounces with lastLookupValue check
  - Only runs once per value

- **Manual Lookup Button** → `src/components/ui/oib-input.tsx:139-157`
  - Label: "Dohvati podatke"
  - Icon: Search
  - Loading state: "Tražim..." with spinner

- **Visual Indicators** → `src/components/ui/oib-input.tsx:133-137`
  - Loading: Blue spinner (Loader2)
  - Success: Green checkmark (Check)
  - Error: Yellow alert circle (AlertCircle)

- **Progress Messages** → `src/components/ui/oib-input.tsx:160-168`
  - During lookup: "• Provjeravam VIES... (VIES → Sudski registar)"
  - Success: "Pronađeno! Podaci su automatski popunjeni."
  - Error: Displays specific error message

- **Callbacks** → `src/components/ui/oib-input.tsx:20-21`
  - `onLookupSuccess`: Receives company data object
  - `onLookupError`: Receives error message string

## Integration Points

### Contact Creation

- **New Contact Form** → `src/app/(dashboard)/contacts/new/page.tsx:191-197`
  - OibInput component integrated
  - Auto-fills: name, address, city, postalCode, vatNumber → `src/app/(dashboard)/contacts/new/page.tsx:99-103`
  - Success toast: "Pronađeno! Podaci o tvrtki su automatski popunjeni" → `src/app/(dashboard)/contacts/new/page.tsx:105`
  - Error toast: Displays error message → `src/app/(dashboard)/contacts/new/page.tsx:109`

### Contact Editing

- **Edit Contact Form** → `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:198-204`
  - OibInput component integrated
  - Same auto-fill behavior as creation → `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:109-113`
  - Success/error toasts → `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:115,119`

### Company Onboarding

- **Basic Info Step** → `src/components/onboarding/step-basic-info.tsx:61-66`
  - OibInput integrated in first onboarding step
  - Auto-fills: name, address, city, postalCode → `src/components/onboarding/step-basic-info.tsx:34-37`
  - Success toast: "Pronađeno! Podaci o tvrtki su automatski popunjeni" → `src/components/onboarding/step-basic-info.tsx:39`
  - Streamlines company setup process

### Database Storage

- **Contact Model** → `prisma/schema.prisma:148-168`
  - Field: `oib String?` (optional) → `prisma/schema.prisma:153`
  - Format: 11 digits, no separators
  - Validation: Enforced via Zod schema → `src/lib/validations/contact.ts:6`
  - Used for Croatian contacts (country = "HR")

- **Contact Validation Schema** → `src/lib/validations/contact.ts:6`
  - Pattern: `/^\d{11}$/`
  - Error: "OIB must be exactly 11 digits"
  - Optional field (can be empty string)

## Error Handling

### Client-Side Validation

- **Format Validation** → `src/components/ui/oib-input.tsx:96-100`
  - Checks: `/^\d{11}$/` regex
  - Error: "OIB mora imati 11 znamenki"
  - Displayed: Yellow text with AlertCircle icon

### API Error Responses

- **Rate Limit Exceeded** → `src/app/api/oib/lookup/route.ts:51-57`
  - Status: 429
  - Error: "Previše zahtjeva. Pokušajte ponovno za nekoliko trenutaka."

- **Missing OIB** → `src/app/api/oib/lookup/route.ts:66-72`
  - Status: 400
  - Error: "OIB je obavezan"

- **Invalid Format/Checksum** → `src/app/api/oib/lookup/route.ts:77-83`
  - Status: 400
  - Error: "Neispravan format OIB-a ili kontrolna znamenka"

- **Server Error** → `src/app/api/oib/lookup/route.ts:90-98`
  - Status: 500
  - Error: "Dogodila se greška prilikom pretrage OIB-a"
  - Logs error to console → `src/app/api/oib/lookup/route.ts:91`

### Service Layer Errors

- **VIES Timeout** → `src/lib/oib-lookup.ts:154-158`
  - Error: "VIES API timeout - pokusajte ponovno"

- **VIES Not Found** → `src/lib/oib-lookup.ts:134-138`
  - Error: "OIB nije pronaden u VIES sustavu"

- **VIES API Error** → `src/lib/oib-lookup.ts:160-163`
  - Error: "Greska pri dohvatu iz VIES-a"

- **Sudski Registar Auth Failure** → `src/lib/oib-lookup.ts:174-178`
  - Error: "Sudski registar autentifikacija nije uspjela"

- **Sudski Registar Timeout** → `src/lib/oib-lookup.ts:242-246`
  - Error: "Sudski registar API timeout"

- **Sudski Registar Not Found** → `src/lib/oib-lookup.ts:199-203`
  - Error: "OIB nije pronaden u Sudskom registru"

- **Both APIs Failed** → `src/lib/oib-lookup.ts:280-283`
  - Error: "OIB nije pronaden - unesite podatke rucno"

## Data Structures

### OibLookupResult Interface

```typescript
interface OibLookupResult {
  success: boolean
  name?: string
  address?: string
  city?: string
  postalCode?: string
  vatNumber?: string
  source?: "vies" | "sudski-registar" | "manual"
  error?: string
}
```

Location: `src/lib/oib-lookup.ts:8-17`

### OibLookupData (Component)

```typescript
interface OibLookupData {
  name?: string
  address?: string
  city?: string
  postalCode?: string
  vatNumber?: string
}
```

Location: `src/components/ui/oib-input.tsx:9-15`

## Performance Optimizations

### Token Caching

- **Sudski Registar OAuth Token** → `src/lib/oib-lookup.ts:40-49`
  - In-memory cache: `cachedToken` object
  - Includes expiration timestamp
  - 5-minute buffer before expiry
  - Reduces auth requests significantly

### Rate Limiting

- **In-Memory Map** → `src/app/api/oib/lookup/route.ts:6`
  - Fast O(1) lookup by IP
  - Automatic cleanup every 5 minutes
  - Prevents API abuse without external dependencies

### Timeouts

- **VIES API**: 10 seconds → `src/lib/oib-lookup.ts:113`
- **Sudski Registar API**: 15 seconds → `src/lib/oib-lookup.ts:182`
- Prevents hanging requests
- Uses AbortController for clean cancellation

## Dependencies

- **Depends on**:
  - [[auth-login]] - User authentication for API endpoint (implicit for forms)
  - [[company-management]] - Company context for contact creation
  - **VIES API** - EU VAT Information Exchange System (external)
  - **Sudski Registar API** - Croatian Court Registry (external)
  - **React Hook Form** - Form state management → Used in all form integrations
  - **Zod** - Schema validation → `src/lib/validations/contact.ts`
  - **Next.js Toast** - User feedback → `src/lib/toast.ts`

- **Depended by**:
  - [[contacts-create]] - Uses OIB lookup for contact creation → `src/app/(dashboard)/contacts/new/page.tsx`
  - [[contacts-edit]] - Uses OIB lookup for contact updates → `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx`
  - [[onboarding]] - Uses OIB lookup for company setup → `src/components/onboarding/step-basic-info.tsx`
  - [[e-invoice-compliance]] - Validates OIB format (11 digits) → `src/lib/compliance/en16931-validator.ts:186-192`

## Verification Checklist

- [ ] User can enter 11-digit OIB in contact forms
- [ ] OIB format validated (exactly 11 digits)
- [ ] OIB checksum validated (ISO 7064 MOD 11-10)
- [ ] Auto-lookup triggers when 11 digits entered
- [ ] Manual "Dohvati podatke" button works
- [ ] Rate limiting enforced (10 requests/minute per IP)
- [ ] VIES API queried first for company data
- [ ] Sudski Registar API used as fallback
- [ ] Company name extracted and shortened
- [ ] Address parsed into street, city, postal code components
- [ ] VAT number constructed (HR + OIB)
- [ ] Form fields auto-filled on successful lookup
- [ ] Success indicator (green checkmark) displayed
- [ ] Error messages displayed for failed lookups
- [ ] Loading spinner shown during lookup
- [ ] Progress messages indicate current API being checked
- [ ] Toast notifications show success/failure
- [ ] OIB lookup works in new contact form
- [ ] OIB lookup works in edit contact form
- [ ] OIB lookup works in company onboarding
- [ ] Invalid checksums rejected with clear error
- [ ] Missing OIB returns 400 error
- [ ] Rate limit exceeded returns 429 error
- [ ] Timeouts handled gracefully (10s VIES, 15s Sudski)
- [ ] OAuth token cached to reduce auth requests
- [ ] User can manually enter data if lookup fails
- [ ] Contact saved with OIB in database

## Evidence Links

1. API POST endpoint → `src/app/api/oib/lookup/route.ts:42`
2. OIB validation function → `src/lib/oib-lookup.ts:86`
3. OIB lookup function → `src/lib/oib-lookup.ts:258`
4. VIES API integration → `src/lib/oib-lookup.ts:108`
5. Sudski Registar API integration → `src/lib/oib-lookup.ts:171`
6. OibInput component → `src/components/ui/oib-input.tsx:27`
7. Contact creation integration → `src/app/(dashboard)/contacts/new/page.tsx:191`
8. Contact edit integration → `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:198`
9. Onboarding integration → `src/components/onboarding/step-basic-info.tsx:61`
10. Contact validation schema → `src/lib/validations/contact.ts:6`
