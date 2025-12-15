# Feature: Contact Filtering

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 15

## Purpose

The Contact Filtering feature provides a multi-criteria filtering system for contacts at /contacts, allowing users to filter by contact type (Customer, Supplier, Both), search across names/OIB/email, and apply advanced segment filters (VAT payers, missing email, no documents). The feature includes URL-based state management, preset saving for frequent filter combinations, and dual view modes (list and board).

## User Entry Points

| Type | Path      | Evidence                                       |
| ---- | --------- | ---------------------------------------------- |
| Page | /contacts | `src/app/(dashboard)/contacts/page.tsx:85-145` |

## Core Flow

1. User navigates to /contacts → `src/app/(dashboard)/contacts/page.tsx:85`
2. System parses query parameters: search, type, segment[], page, view → `src/app/(dashboard)/contacts/page.tsx:86-96`
3. System validates segment filters against allowed segments → `src/app/(dashboard)/contacts/page.tsx:20`
4. Server calls getContactList with filters → `src/app/(dashboard)/contacts/page.tsx:21-27`
5. Query builds WHERE clause with type, search, and segment conditions → `src/app/actions/contact-list.ts:45-56`
6. Search filters applied to name, OIB, and email (case-insensitive) → `src/app/actions/contact-list.ts:48-54`
7. Segment filters applied: VAT_PAYER, MISSING_EMAIL, NO_DOCUMENTS → `src/app/actions/contact-list.ts:24-43`
8. Results fetched with pagination (12 per page) → `src/app/actions/contact-list.ts:58-81`
9. Contacts rendered in list or board view based on view parameter → `src/app/(dashboard)/contacts/page.tsx:134-142`
10. Pagination preserves all filters via buildPageLink helper → `src/app/(dashboard)/contacts/page.tsx:245-252`
11. User can save filter presets to localStorage for quick reuse → `src/components/contacts/contact-filters.tsx:94-102`

## Key Modules

| Module         | Purpose                                         | Location                                        |
| -------------- | ----------------------------------------------- | ----------------------------------------------- |
| ContactsPage   | Main server component with filter orchestration | `src/app/(dashboard)/contacts/page.tsx`         |
| getContactList | Server-side query function with filter logic    | `src/app/actions/contact-list.ts`               |
| ContactFilters | Client filter component with preset management  | `src/components/contacts/contact-filters.tsx`   |
| ContactCard    | Contact display card with type badge            | `src/components/contacts/contact-card.tsx`      |
| ContactList    | Paginated list view component                   | `src/app/(dashboard)/contacts/page.tsx:19-83`   |
| ContactBoard   | Kanban-style board view component               | `src/app/(dashboard)/contacts/page.tsx:162-218` |

## Filter Components

### Contact Type Filters (Quick Filters)

Quick filter buttons for rapid type switching → `src/app/(dashboard)/contacts/page.tsx:118-123`

**Features:**

- Four type options: ALL, CUSTOMER, SUPPLIER, BOTH → `src/app/(dashboard)/contacts/page.tsx:146-160`
- Visual highlighting of active type filter → `src/app/(dashboard)/contacts/page.tsx:155`
- Preserves view mode when switching types → `src/app/(dashboard)/contacts/page.tsx:154`
- Croatian labels: "Svi", "Kupci", "Dobavljači", "Kupci/Dobavljači" → `src/app/(dashboard)/contacts/page.tsx:148-151`

### Search Filter

Text search input with multi-field matching → `src/components/contacts/contact-filters.tsx:126-137`

**Features:**

- Searches across name, OIB, and email fields → `src/app/actions/contact-list.ts:48-54`
- Case-insensitive search for name and email → `src/app/actions/contact-list.ts:50,52`
- Enter key support for quick filtering → `src/components/contacts/contact-filters.tsx:133`
- Debounced state with manual apply → `src/components/contacts/contact-filters.tsx:70-80`
- Placeholder: "Pretraži po nazivu, OIB-u ili emailu..." → `src/components/contacts/contact-filters.tsx:134`

### Type Filter (Advanced)

Dropdown/button selector for contact type in filter panel → `src/components/contacts/contact-filters.tsx:159-167`

**Features:**

- Desktop: Dropdown select → `src/components/contacts/contact-filters.tsx:159-167`
- Mobile: Button pills in filter panel → `src/components/contacts/contact-filters.tsx:211-226`
- Options defined in typeOptions array → `src/components/contacts/contact-filters.tsx:9-14`

### Segment Filters

Advanced segment filters for specific contact criteria → `src/components/contacts/contact-filters.tsx:169-188`

**Features:**

- VAT_PAYER: Contacts with vatNumber field populated → `src/app/actions/contact-list.ts:25-27`
- MISSING_EMAIL: Contacts with null or empty email → `src/app/actions/contact-list.ts:28-35`
- NO_DOCUMENTS: Contacts with no e-invoices as buyer or seller → `src/app/actions/contact-list.ts:36-43`
- Multi-select toggle pills (desktop) → `src/components/contacts/contact-filters.tsx:169-188`
- Multi-select buttons (mobile) → `src/components/contacts/contact-filters.tsx:229-246`
- Croatian labels: "PDV obveznici", "Bez e-maila", "Bez e-računa" → `src/components/contacts/contact-filters.tsx:30-34`
- Visual highlighting for active segments → `src/components/contacts/contact-filters.tsx:177-182`

### Filter Presets

Save and reuse frequent filter combinations → `src/components/contacts/contact-filters.tsx:261-307`

**Features:**

- Save current filters with custom name → `src/components/contacts/contact-filters.tsx:94-102`
- LocalStorage persistence → `src/components/contacts/contact-filters.tsx:47-61`
- One-click preset application → `src/components/contacts/contact-filters.tsx:104-116`
- Delete individual presets → `src/components/contacts/contact-filters.tsx:118-121`
- Example use case: "PDV kupci bez e-maila" → `src/components/contacts/contact-filters.tsx:266`

## Server-Side Filtering Logic

### Query Function

The `getContactList` function handles all contact filtering → `src/app/actions/contact-list.ts:17-93`

**Query Parameters:**

- `search` (optional) - Text search across name, OIB, email
- `type` (optional) - ContactType enum or "ALL"
- `segments` (optional) - Array of ContactSegment values
- `page` (optional) - Pagination page number (default: 1)
- `limit` (optional) - Results per page (default: 20, contacts page uses 12)

**Search Implementation:**

Text search with OR conditions → `src/app/actions/contact-list.ts:48-54`:

```typescript
...(search && {
  OR: [
    { name: { contains: search, mode: "insensitive" as const } },
    { oib: { contains: search } },
    { email: { contains: search, mode: "insensitive" as const } },
  ],
}),
```

**Segment Implementation:**

Dynamic segment conditions with AND logic → `src/app/actions/contact-list.ts:24-55`:

```typescript
const segmentConditions = []
if (segments.includes("VAT_PAYER")) {
  segmentConditions.push({ vatNumber: { not: null } })
}
if (segments.includes("MISSING_EMAIL")) {
  segmentConditions.push({
    OR: [{ email: null }, { email: "" }],
  })
}
if (segments.includes("NO_DOCUMENTS")) {
  segmentConditions.push({
    AND: [{ eInvoicesAsBuyer: { none: {} } }, { eInvoicesAsSeller: { none: {} } }],
  })
}
```

**Type Filtering:**

Simple enum match when type is not "ALL" → `src/app/actions/contact-list.ts:47`

**Pagination:**

Offset-based pagination with total count → `src/app/actions/contact-list.ts:58-92`

## Available Filter Options

### Contact Types

Defined in `prisma/schema.prisma:792-796`:

| Value    | Label (Croatian) | Color Class                     | Evidence                                      |
| -------- | ---------------- | ------------------------------- | --------------------------------------------- |
| ALL      | Svi              | N/A (filter only)               | `src/app/(dashboard)/contacts/page.tsx:148`   |
| CUSTOMER | Kupac            | bg-brand-100 text-brand-700     | `src/components/contacts/contact-card.tsx:24` |
| SUPPLIER | Dobavljač        | bg-purple-100 text-purple-700   | `src/components/contacts/contact-card.tsx:25` |
| BOTH     | Kupac/Dobavljač  | bg-success-100 text-success-700 | `src/components/contacts/contact-card.tsx:26` |

### Contact Segments

Advanced filter segments → `src/app/actions/contact-list.ts:15`:

| Segment       | Label (Croatian) | Database Condition                   | Evidence                                |
| ------------- | ---------------- | ------------------------------------ | --------------------------------------- |
| VAT_PAYER     | PDV obveznici    | vatNumber IS NOT NULL                | `src/app/actions/contact-list.ts:25-27` |
| MISSING_EMAIL | Bez e-maila      | email IS NULL OR email = ''          | `src/app/actions/contact-list.ts:28-35` |
| NO_DOCUMENTS  | Bez e-računa     | No related eInvoices as buyer/seller | `src/app/actions/contact-list.ts:36-43` |

### View Modes

Toggle between list and board views → `src/app/(dashboard)/contacts/page.tsx:220-242`

| View  | Label (Croatian) | Icon       | Default | Evidence                                   |
| ----- | ---------------- | ---------- | ------- | ------------------------------------------ |
| list  | Lista            | Rows       | Yes     | `src/app/(dashboard)/contacts/page.tsx:90` |
| board | Board            | LayoutGrid | No      | `src/app/(dashboard)/contacts/page.tsx:90` |

**Board View Columns:**

- CUSTOMER (Kupci)
- SUPPLIER (Dobavljači)
- BOTH (Kupci/Dobavljači)
- OTHER (Ostalo)

→ `src/app/(dashboard)/contacts/page.tsx:180-195`

## Data

### Database Tables

- **Contact** → `prisma/schema.prisma:148-171`
  - Indexed fields: companyId, oib
  - Searchable fields: name, oib, email
  - Filterable fields: type, vatNumber
  - Segment fields: vatNumber (for VAT_PAYER), email (for MISSING_EMAIL)
  - Relations: eInvoicesAsBuyer, eInvoicesAsSeller (for NO_DOCUMENTS segment)
  - Type field: ContactType enum (CUSTOMER, SUPPLIER, BOTH)

### Query Performance

- Parallel queries for contacts and count → `src/app/actions/contact-list.ts:58-81`
- Uses Prisma's `contains` with `mode: 'insensitive'` for name/email search
- OIB search is case-sensitive (numeric field) → `src/app/actions/contact-list.ts:51`
- Tenant isolation via companyId (automatic via requireCompany) → `src/app/actions/contact-list.ts:18-19`
- Order by name ascending → `src/app/actions/contact-list.ts:61`
- Efficient segment filtering with relation counts → `src/app/actions/contact-list.ts:72-77`

## State Management

### URL-Based State

All filter state stored in URL query parameters → `src/app/(dashboard)/contacts/page.tsx:86-96`

**Parameters:**

- `search` - Search term (string)
- `type` - Contact type filter (ContactType | "ALL")
- `segment` - Array parameter for multiple segments (string[])
- `page` - Current page number (number, default: 1)
- `view` - View mode: "list" or "board" (default: "list")

**Benefits:**

- Shareable URLs with filters applied
- Browser back/forward navigation works correctly
- Server-side rendering compatible
- No client-side state synchronization needed

**URL Parameter Encoding:**

Multiple segments appended as separate params → `src/app/(dashboard)/contacts/page.tsx:245-252`:

- Example: `?type=CUSTOMER&segment=VAT_PAYER&segment=MISSING_EMAIL&page=1&view=list`

### Client State (ContactFilters)

Filter component uses local React state → `src/components/contacts/contact-filters.tsx:40-45`

**State Variables:**

- `search` - Search input value (string)
- `type` - Selected contact type (string)
- `isOpen` - Mobile filter panel visibility (boolean)
- `segments` - Selected segment filters (string[])
- `presetName` - Preset name input (string)
- `presets` - Saved filter presets (SavedPreset[])
- `isPending` - Navigation transition state (boolean)

**LocalStorage:**

- Key: `contacts-filter-presets`
- Value: JSON array of SavedPreset objects
- Loaded on mount → `src/components/contacts/contact-filters.tsx:47-56`
- Persisted on save/delete → `src/components/contacts/contact-filters.tsx:58-61`

## Pagination

### Implementation

Offset-based pagination with filter preservation → `src/app/(dashboard)/contacts/page.tsx:19-83`

**Features:**

- Page number in query params → `src/app/(dashboard)/contacts/page.tsx:89`
- Previous/Next links preserve all filters → `src/app/(dashboard)/contacts/page.tsx:65-77`
- Current page indicator (e.g., "Stranica 2 od 5") → `src/app/(dashboard)/contacts/page.tsx:70-72`
- 12 results per page in list view → `src/app/(dashboard)/contacts/page.tsx:26`
- 120 results in board view (no pagination) → `src/app/(dashboard)/contacts/page.tsx:177`
- buildPageLink helper preserves search, type, segments → `src/app/(dashboard)/contacts/page.tsx:245-252`

**Pagination Data:**

Returned from getContactList → `src/app/actions/contact-list.ts:83-92`:

- `total` - Total number of contacts matching filters
- `page` - Current page number
- `limit` - Results per page
- `totalPages` - Total number of pages
- `hasMore` - Boolean indicating more pages available

## View Modes

### List View

Standard paginated list with contact cards → `src/app/(dashboard)/contacts/page.tsx:139-141`

**Features:**

- Grid layout: 1 column mobile, 2 columns tablet, 3 columns desktop → `src/app/(dashboard)/contacts/page.tsx:55`
- Pagination controls at bottom → `src/app/(dashboard)/contacts/page.tsx:62-80`
- 12 contacts per page → `src/app/(dashboard)/contacts/page.tsx:26`
- Contact cards with actions (email, call, new invoice, edit, delete) → `src/components/contacts/contact-card.tsx:104-147`

### Board View

Kanban-style board organized by contact type → `src/app/(dashboard)/contacts/page.tsx:134-137`

**Features:**

- Four columns: Kupci, Dobavljači, Kupci/Dobavljači, Ostalo → `src/app/(dashboard)/contacts/page.tsx:180-185`
- No pagination (loads all matching contacts, limit 120) → `src/app/(dashboard)/contacts/page.tsx:177`
- Column-based grouping by type → `src/app/(dashboard)/contacts/page.tsx:187-195`
- Count badge per column → `src/app/(dashboard)/contacts/page.tsx:203`
- Responsive: 1 column mobile, 2 columns tablet, 4 columns desktop → `src/app/(dashboard)/contacts/page.tsx:198`

## Dependencies

- **Depends on**:
  - [[auth-login]] - User must be authenticated → `src/app/actions/contact-list.ts:18`
  - [[company-management]] - Company context required for tenant isolation → `src/app/actions/contact-list.ts:19`
  - [[e-invoice-management]] - E-invoice relations for NO_DOCUMENTS segment

- **Depended by**:
  - [[dashboard-main]] - Links to contacts page
  - [[contact-management]] - Core contact CRUD operations
  - [[e-invoice-management]] - Contact selection in invoice forms

## Integrations

None - This is a pure data query and display feature with no external API integrations.

## Verification Checklist

- [x] Authenticated user can access /contacts with filters
- [x] Search input filters by contact name case-insensitively
- [x] Search input filters by OIB
- [x] Search input filters by email case-insensitively
- [x] Type filter works for CUSTOMER, SUPPLIER, BOTH, and ALL
- [x] VAT_PAYER segment filters contacts with vatNumber
- [x] MISSING_EMAIL segment filters contacts without email
- [x] NO_DOCUMENTS segment filters contacts without e-invoices
- [x] Multiple segments can be combined with AND logic
- [x] Pagination preserves all filter parameters
- [x] View toggle switches between list and board modes
- [x] Board view groups contacts by type into columns
- [x] Filter presets can be saved to localStorage
- [x] Saved presets can be applied and deleted
- [x] Mobile responsive filter panel works correctly
- [x] All queries are tenant-scoped (companyId isolation)
- [x] Empty state displays when no contacts match filters
- [x] Quick filter buttons preserve view mode

## Evidence Links

1. `src/app/(dashboard)/contacts/page.tsx:85-145` - Main contacts page with filter orchestration
2. `src/app/actions/contact-list.ts:17-93` - Server-side query function with filtering logic
3. `src/app/actions/contact-list.ts:48-54` - Search filter implementation (name, OIB, email)
4. `src/app/actions/contact-list.ts:24-43` - Segment filter conditions (VAT_PAYER, MISSING_EMAIL, NO_DOCUMENTS)
5. `src/components/contacts/contact-filters.tsx:36-310` - Client filter component with presets
6. `src/components/contacts/contact-filters.tsx:30-34` - Segment options definition
7. `src/components/contacts/contact-filters.tsx:94-102` - Preset save functionality
8. `src/components/contacts/contact-card.tsx:23-27` - Contact type configuration and labels
9. `src/app/(dashboard)/contacts/page.tsx:146-160` - Quick filter buttons for contact types
10. `src/app/(dashboard)/contacts/page.tsx:220-242` - View toggle component (list/board)
11. `src/app/(dashboard)/contacts/page.tsx:162-218` - Board view with type-based columns
12. `src/app/(dashboard)/contacts/page.tsx:245-252` - buildPageLink helper for filter preservation
13. `prisma/schema.prisma:148-171` - Contact model with indexed fields
14. `prisma/schema.prisma:792-796` - ContactType enum definition
15. `src/app/actions/contact-list.ts:15` - ContactSegment type definition
