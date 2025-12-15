# Feature: Edit Contact

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 12

## Purpose

Allows users to modify existing contact details (name, tax identifiers, address, payment terms, contact information) through the updateContact server action. Contacts can be edited at any time with full validation and automatic postal code/city lookup integration. The feature supports both domestic (Croatian) contacts with OIB and international contacts with VAT numbers, along with smart field validation based on the selected country.

## User Entry Points

| Type | Path               | Evidence                                             |
| ---- | ------------------ | ---------------------------------------------------- |
| Page | /contacts/:id/edit | `src/app/(dashboard)/contacts/[id]/edit/page.tsx:1`  |
| Page | /contacts/:id      | `src/app/(dashboard)/contacts/[id]/page.tsx:156-160` |
| API  | updateContact      | `src/app/actions/contact.ts:28-58`                   |

## Core Flow

### Contact Edit Flow

1. User navigates to contacts list at /contacts -> `src/app/(dashboard)/contacts/page.tsx:99`
2. User clicks on a contact card to view details -> `src/components/contacts/contact-card.tsx` (referenced)
3. System displays contact overview page -> `src/app/(dashboard)/contacts/[id]/page.tsx:31-436`
4. User clicks "Uredi" (Edit) button in header -> `src/app/(dashboard)/contacts/[id]/page.tsx:156-160`
5. System routes to edit page at /contacts/:id/edit -> `src/app/(dashboard)/contacts/[id]/edit/page.tsx:10-32`
6. Server fetches contact data with company validation -> `src/app/(dashboard)/contacts/[id]/edit/page.tsx:15-24`
7. EditContactForm renders with pre-populated data -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:30-360`
8. Form displays with default values from contact -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:45-58`
9. User modifies contact fields (name, address, payment terms, etc.) -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:122-348`
10. Client validates form data with Zod schema -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:43-44`
11. User submits form by clicking "Spremi promjene" -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:83-100`
12. Client calls updateContact server action with contact ID and data -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:87-91`
13. Server validates ownership through tenant context -> `src/app/actions/contact.ts:34-42`
14. Server validates form data with contactSchema -> `src/app/actions/contact.ts:44-48`
15. Server updates contact in database -> `src/app/actions/contact.ts:50-53`
16. Cache revalidation triggers UI refresh -> `src/app/actions/contact.ts:55`
17. User redirected to contacts list -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:99`

### OIB Lookup Integration (Croatian Contacts)

1. User selects "Hrvatska" as country -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:65`
2. Form displays OIB input field with lookup button -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:195-208`
3. User enters 11-digit OIB -> `src/components/ui/oib-input.tsx:123-131`
4. System auto-triggers lookup when 11 digits entered -> `src/components/ui/oib-input.tsx:106-117`
5. OibInput component fetches company data from VIES/Registry -> `src/components/ui/oib-input.tsx:42-93`
6. On success, form auto-fills name, address, city, postal code, VAT number -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:102-116`
7. Success toast displayed to user -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:115`

### Postal Code/City Auto-Linking

1. User enters postal code in form -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:299-309`
2. System looks up matching city from postal code database -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:69-74`
3. If city field is empty, auto-fills with suggestion -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:71-73`
4. Alternatively, user enters city name -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:311-322`
5. System looks up matching postal code from city database -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:76-81`
6. If postal field is empty, auto-fills with suggestion -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:78-80`

## Key Modules

| Module               | Purpose                                       | Location                                               |
| -------------------- | --------------------------------------------- | ------------------------------------------------------ |
| Edit Contact Page    | Server component that loads contact data      | `src/app/(dashboard)/contacts/[id]/edit/page.tsx`      |
| EditContactForm      | Client form with validation and auto-lookup   | `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx` |
| updateContact action | Server action to update contact fields        | `src/app/actions/contact.ts:28-58`                     |
| Contact Detail Page  | Overview page with edit button                | `src/app/(dashboard)/contacts/[id]/page.tsx`           |
| OibInput             | Smart input with auto-lookup for Croatian OIB | `src/components/ui/oib-input.tsx`                      |
| contactSchema        | Zod validation schema for contact data        | `src/lib/validations/contact.ts:3-15`                  |
| Postal Code Helpers  | City/postal code lookup functions             | `src/lib/postal-codes.ts` (referenced)                 |

## Data

### Database Tables

- **Contact**: Main contact table -> `prisma/schema.prisma:148-171`
  - Key fields: id, companyId, type, name
  - Tax fields: oib (11 digits, optional), vatNumber (optional) -> `prisma/schema.prisma:153-154`
  - Address fields: address, city, postalCode, country (default "HR") -> `prisma/schema.prisma:155-158`
  - Contact fields: email, phone -> `prisma/schema.prisma:159-160`
  - Payment terms: paymentTermsDays (default 15) -> `prisma/schema.prisma:163`
  - Relations: eInvoicesAsBuyer, eInvoicesAsSeller, expensesAsVendor -> `prisma/schema.prisma:165-167`
  - Indexes: companyId, oib -> `prisma/schema.prisma:169-170`

### Contact Type Enum

```typescript
enum ContactType {
  CUSTOMER    // Customer only
  SUPPLIER    // Supplier only
  BOTH        // Both customer and supplier
}
```

Source: `prisma/schema.prisma:792-796`

### Field Constraints

- **name**: Minimum 2 characters, required -> `src/lib/validations/contact.ts:5`
- **oib**: Exactly 11 digits (regex: `^\d{11}$`), optional -> `src/lib/validations/contact.ts:6`
- **vatNumber**: Optional string -> `src/lib/validations/contact.ts:7`
- **email**: Valid email format, optional -> `src/lib/validations/contact.ts:12`
- **paymentTermsDays**: Integer, 0-365, default 15 -> `src/lib/validations/contact.ts:14`
- **country**: String, default "HR" -> `src/lib/validations/contact.ts:11`

## Edit Restrictions

### Ownership Validation

- Contact must belong to user's company -> `src/app/actions/contact.ts:36-42`
- Tenant context automatically filters by companyId -> `src/app/actions/contact.ts:34`
- Returns error "Contact not found" if not owned by company -> `src/app/actions/contact.ts:41`

### No Status-Based Restrictions

Unlike invoices or expenses, contacts have **no status-based edit restrictions**:

- All contacts can be edited at any time
- No workflow state prevents modifications
- Changes apply immediately to all related documents

### Validation Rules

All updates must pass contactSchema validation:

- Name must be at least 2 characters -> `src/lib/validations/contact.ts:5`
- OIB must be exactly 11 digits if provided -> `src/lib/validations/contact.ts:6`
- Email must be valid format if provided -> `src/lib/validations/contact.ts:12`
- Payment terms must be 0-365 days -> `src/lib/validations/contact.ts:14`

## Field Validation

### Update Input Fields

All fields are validated through contactSchema:

- **type**: Enum (CUSTOMER, SUPPLIER, BOTH) -> `src/lib/validations/contact.ts:4`
- **name**: String, min 2 chars, required -> `src/lib/validations/contact.ts:5`
- **oib**: String, 11 digits regex, optional -> `src/lib/validations/contact.ts:6`
- **vatNumber**: String, optional -> `src/lib/validations/contact.ts:7`
- **address**: String, optional -> `src/lib/validations/contact.ts:8`
- **city**: String, optional -> `src/lib/validations/contact.ts:9`
- **postalCode**: String, optional -> `src/lib/validations/contact.ts:10`
- **country**: String, default "HR" -> `src/lib/validations/contact.ts:11`
- **email**: String, email format, optional -> `src/lib/validations/contact.ts:12`
- **phone**: String, optional -> `src/lib/validations/contact.ts:13`
- **paymentTermsDays**: Number, 0-365, default 15 -> `src/lib/validations/contact.ts:14`

### Server-Side Validation

```typescript
const validatedFields = contactSchema.safeParse(formData)

if (!validatedFields.success) {
  return { error: "Invalid fields", details: validatedFields.error.flatten() }
}
```

Source: `src/app/actions/contact.ts:44-48`

### Client-Side Validation

- React Hook Form with Zod resolver -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:43-44`
- Real-time field validation on blur/change -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:37-58`
- Error messages displayed inline -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:149-151`

## Security Features

### Authentication & Authorization

- Requires authenticated user -> `src/app/(dashboard)/contacts/[id]/edit/page.tsx:12`
- Requires user to have company -> `src/app/(dashboard)/contacts/[id]/edit/page.tsx:13`
- Tenant context isolation via requireCompanyWithContext -> `src/app/actions/contact.ts:34`
- Company ownership validation through tenant middleware -> `src/lib/auth-utils.ts:51-78`

### Permission Requirements

- **View Edit Page**: Standard authentication, no special permission -> `src/app/(dashboard)/contacts/[id]/edit/page.tsx:12-13`
- **Update Contact**: Standard company context, no special permission -> `src/app/actions/contact.ts:34`
- **Delete Contact**: Handled separately in delete action -> `src/app/actions/contact.ts:60-79`

### Data Integrity

- Tenant isolation prevents cross-company access -> `src/app/actions/contact.ts:34-42`
- Zod schema validation ensures data consistency -> `src/app/actions/contact.ts:44-48`
- OIB validation ensures 11-digit format -> `src/lib/validations/contact.ts:6`
- Email validation prevents invalid email addresses -> `src/lib/validations/contact.ts:12`
- Payment terms bounded to reasonable range (0-365 days) -> `src/lib/validations/contact.ts:14`

### Data Privacy

- Contact data never exposed across companies
- All queries automatically filtered by companyId through tenant context
- notFound() returned instead of error details when contact not accessible -> `src/app/(dashboard)/contacts/[id]/edit/page.tsx:22-24`

## Dependencies

- **Depends on**:
  - View Contacts (F047) - Entry point for editing
  - OIB Lookup Integration - Auto-fills Croatian company data
  - Postal Code Database - Auto-links city and postal code

- **Depended by**:
  - E-Invoice Creation - Uses updated contact data for buyer/seller info
  - Expense Creation - Uses updated vendor contact data
  - Contact Overview - Displays updated contact information

## Integrations

### Prisma ORM

- Tenant context filtering via middleware -> `src/lib/db.ts` (referenced)
- Automatic companyId injection in queries -> `src/app/actions/contact.ts:34`
- findFirst validation for ownership check -> `src/app/actions/contact.ts:36-42`
- update operation for data persistence -> `src/app/actions/contact.ts:50-53`

### Next.js Cache

- revalidatePath for real-time UI updates -> `src/app/actions/contact.ts:55`
- Invalidates /contacts list view after edit -> `src/app/actions/contact.ts:55`
- Server component re-renders on navigation back -> `src/app/(dashboard)/contacts/page.tsx:85`

### OIB Lookup Service

- Auto-lookup Croatian company data via OibInput -> `src/components/ui/oib-input.tsx:42-93`
- Fetches from VIES and Sudski registar (Court Registry) -> `src/components/ui/oib-input.tsx:46,161`
- Auto-fills name, address, city, postalCode, vatNumber -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:102-116`
- Shows progress indicator during lookup -> `src/components/ui/oib-input.tsx:39,160-161`

### Postal Code Database

- lookupCityByPostalCode auto-suggests city from postal code -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:70`
- lookupPostalByCity auto-suggests postal code from city -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:77`
- Only auto-fills if target field is empty and not touched -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:71,78`

## UI Components

### Edit Page Components

- **EditContactForm**: Main form component with sections -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:30-360`
- **Input**: Standard text input fields -> `src/components/ui/input.tsx` (referenced)
- **OibInput**: Special input with auto-lookup for OIB -> `src/components/ui/oib-input.tsx:27-171`
- **Button**: Submit and cancel actions -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:351-356`
- **Select**: Dropdowns for type and country -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:141-193`

### Form Sections

1. **Osnovni podaci (Basic Data)** -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:131-282`
   - Contact type (Customer/Supplier/Both)
   - Country selection with flag emojis
   - OIB input with auto-lookup (for Croatia)
   - VAT number (for EU/international)
   - Company/person name
   - Payment terms quick buttons and input

2. **Adresa (Address)** -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:284-323`
   - Street and number
   - Postal code (auto-links to city)
   - City (auto-links to postal code)

3. **Kontakt podaci (Contact Information)** -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:325-347`
   - Email address
   - Phone number

### Payment Terms Quick Select

```typescript
const paymentQuickOptions = [0, 7, 15, 30]
// Displays as: "Odmah", "7 dana", "15 dana", "30 dana"
```

Source: `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:67,238-252`

### Country Selection

- Croatia (HR) as default -> `src/lib/validations/contact.ts:11`
- All EU countries grouped in optgroup -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:161-188`
- "OTHER" option for non-EU countries -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:190`
- Flag emojis for visual recognition -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:160-190`

## Error Handling

- **Contact not found**: Returns { error: "Contact not found" } -> `src/app/actions/contact.ts:41`
- **Invalid fields**: Returns validation errors with details -> `src/app/actions/contact.ts:46-47`
- **OIB format error**: Inline validation message "OIB must be exactly 11 digits" -> `src/lib/validations/contact.ts:6`
- **Email format error**: Inline validation from Zod email validator -> `src/lib/validations/contact.ts:12`
- **Payment terms out of range**: Validation error if not 0-365 -> `src/lib/validations/contact.ts:14`
- **OIB lookup failed**: Toast error notification with message -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:118-120`
- **Form submission error**: Red error banner at top of form -> `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:124-128`
- **Not found (unauthorized)**: Next.js notFound() page -> `src/app/(dashboard)/contacts/[id]/edit/page.tsx:22-24`

## Verification Checklist

- [x] User can access edit page from contact detail view
- [x] Form pre-populates with existing contact data
- [x] All contact fields can be modified
- [x] Contact type can be changed (CUSTOMER/SUPPLIER/BOTH)
- [x] OIB field appears for Croatian contacts with auto-lookup
- [x] VAT number field appears for EU/international contacts
- [x] Postal code and city auto-link when one is entered
- [x] Payment terms can be set via quick buttons or manual input
- [x] Client-side validation shows errors inline
- [x] Server-side validation prevents invalid data
- [x] Tenant isolation prevents cross-company edits
- [x] Cache invalidation refreshes contact list
- [x] User redirected to /contacts after successful update
- [x] Error messages are clear and localized (Croatian)
- [x] Cancel button returns to previous page

## Related Features

- **Create Contact**: `src/app/actions/contact.ts:9-26` (F046)
- **View Contacts**: `src/app/(dashboard)/contacts/page.tsx` (F047)
- **View Contact Details**: `src/app/(dashboard)/contacts/[id]/page.tsx` (F047)
- **Delete Contact**: `src/app/actions/contact.ts:60-79` (separate action)
- **Search Contacts**: `src/app/actions/contact.ts:94-110` (F047)

## Evidence Links

1. `src/app/(dashboard)/contacts/[id]/edit/page.tsx:1-32` - Edit page server component with contact loading
2. `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:1-330` - Complete edit form with validation and auto-lookup
3. `src/app/actions/contact.ts:28-58` - updateContact server action with ownership validation
4. `src/app/actions/contact.ts:36-42` - Contact ownership check through tenant context
5. `src/app/actions/contact.ts:44-48` - Server-side Zod schema validation
6. `src/app/actions/contact.ts:50-53` - Database update operation
7. `src/lib/validations/contact.ts:3-15` - contactSchema with all field validations
8. `src/components/ui/oib-input.tsx:1-171` - OIB input with auto-lookup integration
9. `src/app/(dashboard)/contacts/[id]/page.tsx:156-160` - Edit button on contact detail page
10. `src/app/(dashboard)/contacts/[id]/edit/edit-form.tsx:69-81` - Postal code/city auto-linking logic
11. `prisma/schema.prisma:148-171` - Contact model with all fields and relations
12. `prisma/schema.prisma:792-796` - ContactType enum definition
