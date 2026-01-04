# FiskAI Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement all findings from the audit team's security, performance, and accessibility reviews. QA-gated development - no rush, thorough implementation.

**Working Directory:** `/home/admin/FiskAI`

**Git Branch:** `main` (development phase)

---

## Task 1: Fix Cross-Tenant Contact Vulnerability (CRITICAL)

**Files:**

- Edit: `src/app/actions/e-invoice.ts`

**Problem:** Line 55 accepts `buyerId` without verifying the contact belongs to the current company. A malicious user could reference another company's contact.

**Implementation:**

In `createEInvoice()` function, after validating fields (around line 22), add ownership verification:

```typescript
// After: const { buyerId, lines, ...invoiceData } = validatedFields.data

// Verify buyer belongs to this company (prevent cross-tenant data access)
const buyer = await db.contact.findFirst({
  where: {
    id: buyerId,
    companyId: company.id,
  },
})

if (!buyer) {
  return { error: "Invalid buyer - contact not found or doesn't belong to your company" }
}
```

**Verification:**

- The buyer lookup must include both `id: buyerId` AND `companyId: company.id`
- Return clear error if not found

---

## Task 2: Implement API Key Encryption (CRITICAL)

**Files:**

- Edit: `src/app/actions/company.ts`
- Edit: `prisma/schema.prisma` (add encrypted field)
- Edit: `src/lib/validations/company.ts` (if needed)

**Problem:** `updateCompanySettings()` at lines 112-114 stores API keys in plaintext. The audit team created `src/lib/secrets.ts` with AES-256-GCM encryption utilities.

**Implementation:**

1. Update Prisma schema to add encrypted field:

```prisma
model Company {
  // ... existing fields ...
  eInvoiceApiKeyEncrypted String?  // Add this field
  // Keep eInvoiceApiKey temporarily for migration
}
```

2. In `src/app/actions/company.ts`, import and use encryption:

```typescript
import { encryptSecret, decryptSecret } from "@/lib/secrets"

// In updateCompanySettings():
data: {
  eInvoiceProvider: data.eInvoiceProvider,
  eInvoiceApiKeyEncrypted: data.eInvoiceApiKey
    ? encryptSecret(data.eInvoiceApiKey)
    : null,
  eInvoiceApiKey: null, // Clear plaintext
}
```

3. In `src/app/actions/e-invoice.ts` sendEInvoice(), decrypt when reading:

```typescript
import { decryptOptionalSecret } from "@/lib/secrets"

// In sendEInvoice():
const apiKey = decryptOptionalSecret(company.eInvoiceApiKeyEncrypted) || ""
const provider = createEInvoiceProvider(providerName, { apiKey })
```

4. Ensure EINVOICE_KEY_SECRET is in `.env.example` (already done by audit team)

**Verification:**

- API keys must never be stored in plaintext
- Decryption must work correctly for provider authentication
- Run `npm run build` to verify no type errors

---

## Task 3: Fix Floating-Point Money Math (HIGH)

**Files:**

- Edit: `src/app/actions/e-invoice.ts`

**Problem:** Lines 26-27 use JavaScript floating-point: `line.quantity * line.unitPrice`. Lines 41-48 accumulate with `Number()` before final Decimal conversion. This causes precision errors in financial calculations.

**Implementation:**

Replace floating-point arithmetic with Decimal-based calculations:

```typescript
// In createEInvoice(), replace lines 25-48:

const lineItems = lines.map((line, index) => {
  // Use Decimal for all money calculations
  const quantity = new Decimal(line.quantity)
  const unitPrice = new Decimal(line.unitPrice)
  const vatRate = new Decimal(line.vatRate)

  const netAmount = quantity.mul(unitPrice)
  const vatAmount = netAmount.mul(vatRate).div(100)

  return {
    lineNumber: index + 1,
    description: line.description,
    quantity,
    unit: line.unit,
    unitPrice,
    netAmount,
    vatRate,
    vatCategory: line.vatCategory,
    vatAmount,
  }
})

// Calculate totals using Decimal
const netAmount = lineItems.reduce((sum, line) => sum.add(line.netAmount), new Decimal(0))
const vatAmount = lineItems.reduce((sum, line) => sum.add(line.vatAmount), new Decimal(0))
const totalAmount = netAmount.add(vatAmount)
```

**Verification:**

- No `Number()` conversions in money calculations
- All arithmetic uses Decimal methods: `.mul()`, `.div()`, `.add()`
- Build must pass

---

## Task 4: Add Pagination and Optimize Auth Queries (MEDIUM)

**Files:**

- Edit: `src/app/actions/e-invoice.ts`
- Edit: `src/app/(dashboard)/e-invoices/page.tsx`

**Problem:**

1. `getEInvoices()` has no pagination - will be slow as data grows
2. Both page and action call `requireAuth()`/`requireCompany()` = redundant DB hits
3. Includes all relations for list view (oversized responses)

**Implementation:**

1. Add pagination parameters to `getEInvoices()`:

```typescript
export async function getEInvoices(options?: {
  direction?: "OUTBOUND" | "INBOUND"
  status?: string
  cursor?: string // For cursor-based pagination
  limit?: number // Default 20
}) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const limit = options?.limit ?? 20

  const invoices = await db.eInvoice.findMany({
    where: {
      companyId: company.id,
      ...(options?.direction && { direction: options.direction }),
      ...(options?.status && { status: options.status as EInvoiceStatus }),
    },
    // Only select fields needed for list view
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      totalAmount: true,
      vatAmount: true,
      issueDate: true,
      dueDate: true,
      jir: true,
      createdAt: true,
      buyer: {
        select: { name: true, oib: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1, // Take one extra to check if there's more
    ...(options?.cursor && {
      cursor: { id: options.cursor },
      skip: 1, // Skip the cursor itself
    }),
  })

  const hasMore = invoices.length > limit
  const items = hasMore ? invoices.slice(0, -1) : invoices
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

  return { items, nextCursor, hasMore }
}
```

2. Update page to use paginated results (keep simple for now, can add load-more later)

**Verification:**

- `getEInvoices()` returns paginated results with `{ items, nextCursor, hasMore }`
- List view only fetches needed fields (no full relations)
- Build passes

---

## Task 5: Fix Accessibility Issues (MEDIUM)

**Files:**

- Edit: `src/app/layout.tsx` - Change `lang="en"` to `lang="hr"`
- Edit: `src/components/ui/input.tsx` - Add ARIA attributes
- Edit: `src/app/(dashboard)/e-invoices/new/page.tsx` - Add label for buyer select

**Implementation:**

1. In `src/app/layout.tsx`, change:

```tsx
<html lang="hr">
```

2. In `src/components/ui/input.tsx`, add ARIA support:

```tsx
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, id, ...props }, ref) => {
    const errorId = error && id ? `${id}-error` : undefined

    return (
      <input
        type={type}
        id={id}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={errorId}
        className={cn(
          "flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-red-500 focus-visible:ring-red-500",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
```

3. In `src/app/(dashboard)/e-invoices/new/page.tsx`, add proper label association for buyer select (around line 103-114):

```tsx
<label htmlFor="buyer-select" className="block text-sm font-medium text-gray-700">
  Kupac *
</label>
<select
  id="buyer-select"
  {...register("buyerId")}
  className="..."
>
```

**Verification:**

- `<html lang="hr">` in layout
- Input component accepts `error` prop and sets ARIA attributes
- Buyer select has `id` matching label's `htmlFor`

---

## Task 6: Server-Side Contacts Fetch (MEDIUM)

**Files:**

- Edit: `src/app/(dashboard)/e-invoices/new/page.tsx`

**Problem:** Line 12 imports server action `getContacts`, line 54 calls it in `useEffect`. This causes:

1. Server action imported in client bundle (increases bundle size)
2. Extra network round-trip after page loads

**Implementation:**

Convert to Server Component that passes contacts as props, or use a client wrapper:

**Option A: Server Component with Client Form**

1. Create `src/app/(dashboard)/e-invoices/new/invoice-form.tsx` (client component with the form)
2. Make `page.tsx` a server component that fetches contacts and passes them to the form

```tsx
// src/app/(dashboard)/e-invoices/new/page.tsx
import { getContacts } from "@/app/actions/contact"
import { getProducts } from "@/app/actions/product"
import { InvoiceForm } from "./invoice-form"

export default async function NewEInvoicePage() {
  const [contacts, products] = await Promise.all([getContacts("CUSTOMER"), getProducts()])

  return <InvoiceForm contacts={contacts} products={products} />
}
```

3. Move the existing client code to `invoice-form.tsx`, accepting contacts/products as props instead of fetching in useEffect

**Verification:**

- No `useEffect` fetching contacts/products
- Server component fetches data before render
- Client form receives data as props
- Build passes, page works correctly

---

## Verification Checklist

After all tasks complete:

1. `npm run build` - Must pass with no errors
2. `npm run lint` - Should pass (warnings OK)
3. Test each feature manually:
   - Create e-invoice with valid buyer
   - Try to reference invalid buyer ID (should error)
   - Update company e-invoice settings (API key should be encrypted)
   - View e-invoice list (should load fast with pagination)
4. Check accessibility:
   - Page source shows `<html lang="hr">`
   - Form inputs have proper ARIA attributes
5. Git commit all changes with descriptive message
