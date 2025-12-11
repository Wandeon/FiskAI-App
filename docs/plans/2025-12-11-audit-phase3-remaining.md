# FiskAI Audit Phase 3 - Remaining Tasks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete remaining 9 audit items: Docker optimization, accessibility improvements, toast system, e-invoice composer enhancements, and monitoring setup.

**Architecture:** Server-side React components with Next.js 15, accessible UI patterns, client-side toast notifications with ARIA live regions, and optional analytics integration.

**Tech Stack:** Next.js 15, React 18, Tailwind CSS, Pino logging, sonner (toast library)

---

## Task 1: Optimize Docker Build - Prune devDependencies

**Files:**
- Modify: `/home/admin/FiskAI/Dockerfile`

**Step 1: Update Dockerfile runner stage**

The current Dockerfile copies standalone output but we should ensure minimal production footprint. Update the runner stage:

```dockerfile
# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Set up .next directory with correct permissions
RUN mkdir .next && chown nextjs:nodejs .next

# Copy standalone output (includes only production dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma client (required at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Verification:**
- Run: `docker build -t fiskai-test . 2>&1 | tail -5`
- Expected: Build completes successfully
- Check image size: `docker images fiskai-test --format "{{.Size}}"`

---

## Task 2: Add Accessible Data Table Component

**Files:**
- Create: `/home/admin/FiskAI/src/components/ui/data-table.tsx`

**Step 1: Create reusable accessible table component**

```tsx
// src/components/ui/data-table.tsx
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface Column<T> {
  key: string
  header: string
  cell: (item: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  caption: string
  emptyMessage?: string
  className?: string
  getRowKey: (item: T) => string
}

export function DataTable<T>({
  columns,
  data,
  caption,
  emptyMessage = "Nema podataka",
  className,
  getRowKey,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 p-8 text-center text-gray-500">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={cn("overflow-x-auto rounded-md border border-gray-200", className)}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b bg-gray-50">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-3 text-left font-medium text-gray-700",
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={getRowKey(item)}
              className="border-b last:border-b-0 hover:bg-gray-50"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn("px-4 py-3", column.className)}
                >
                  {column.cell(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

**Verification:**
- Run: `npm run build`
- Expected: Build passes with no errors

---

## Task 3: Update E-Invoices List to Use Accessible Table

**Files:**
- Modify: `/home/admin/FiskAI/src/app/(dashboard)/e-invoices/page.tsx`

**Step 1: Refactor to use DataTable component**

Replace the manual table (lines ~99-184) with the DataTable component:

```tsx
// At top of file, add import:
import { DataTable, Column } from "@/components/ui/data-table"

// Replace the table section with:
type InvoiceItem = typeof invoices.items[number]

const columns: Column<InvoiceItem>[] = [
  {
    key: "invoiceNumber",
    header: "Broj računa",
    cell: (invoice) => (
      <Link
        href={`/e-invoices/${invoice.id}`}
        className="font-medium text-blue-600 hover:underline"
      >
        {invoice.invoiceNumber}
      </Link>
    ),
  },
  {
    key: "buyer",
    header: "Kupac",
    cell: (invoice) => invoice.buyer?.name || "—",
  },
  {
    key: "issueDate",
    header: "Datum",
    cell: (invoice) =>
      new Date(invoice.issueDate).toLocaleDateString("hr-HR"),
  },
  {
    key: "dueDate",
    header: "Dospijeće",
    cell: (invoice) =>
      invoice.dueDate
        ? new Date(invoice.dueDate).toLocaleDateString("hr-HR")
        : "—",
  },
  {
    key: "totalAmount",
    header: "Iznos",
    className: "text-right",
    cell: (invoice) => (
      <span className="font-medium">
        {Number(invoice.totalAmount).toFixed(2)} EUR
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (invoice) => (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          statusColors[invoice.status] || "bg-gray-100 text-gray-700"
        }`}
      >
        {statusLabels[invoice.status] || invoice.status}
      </span>
    ),
  },
  {
    key: "actions",
    header: "Akcije",
    cell: (invoice) => <InvoiceActions invoice={invoice} />,
  },
]

// In JSX, replace the table with:
<DataTable
  columns={columns}
  data={invoices.items}
  caption="Popis e-računa"
  emptyMessage="Nemate još nijedan e-račun. Kliknite 'Novi e-račun' za početak."
  getRowKey={(invoice) => invoice.id}
/>
```

**Verification:**
- Run: `npm run build`
- Expected: Build passes, table has accessible caption

---

## Task 4: Add Toast Notification System

**Files:**
- Run: `npm install sonner`
- Modify: `/home/admin/FiskAI/src/app/layout.tsx`
- Create: `/home/admin/FiskAI/src/lib/toast.ts`

**Step 1: Install sonner (accessible toast library)**

```bash
npm install sonner
```

**Step 2: Add Toaster to root layout**

```tsx
// src/app/layout.tsx
// Add import at top:
import { Toaster } from "sonner"

// In the body, add Toaster component before children:
<body className={inter.className}>
  <Toaster
    position="top-right"
    richColors
    closeButton
    toastOptions={{
      className: "font-sans",
      duration: 4000,
    }}
  />
  {children}
</body>
```

**Step 3: Create toast helper module**

```typescript
// src/lib/toast.ts
import { toast as sonnerToast } from "sonner"

export const toast = {
  success: (message: string, description?: string) => {
    sonnerToast.success(message, { description })
  },
  error: (message: string, description?: string) => {
    sonnerToast.error(message, { description })
  },
  info: (message: string, description?: string) => {
    sonnerToast.info(message, { description })
  },
  warning: (message: string, description?: string) => {
    sonnerToast.warning(message, { description })
  },
  loading: (message: string) => {
    return sonnerToast.loading(message)
  },
  dismiss: (id?: string | number) => {
    sonnerToast.dismiss(id)
  },
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string
      error: string
    }
  ) => {
    return sonnerToast.promise(promise, messages)
  },
}
```

**Verification:**
- Run: `npm run build`
- Expected: Build passes

---

## Task 5: Replace Browser Alerts with Toast Notifications

**Files:**
- Modify: `/home/admin/FiskAI/src/app/(dashboard)/contacts/delete-button.tsx`
- Modify: `/home/admin/FiskAI/src/app/(dashboard)/products/delete-button.tsx`
- Modify: `/home/admin/FiskAI/src/app/(dashboard)/e-invoices/invoice-actions.tsx`

**Step 1: Update contacts delete button**

```tsx
// src/app/(dashboard)/contacts/delete-button.tsx
"use client"

import { useTransition } from "react"
import { deleteContact } from "@/app/actions/contact"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"

export function DeleteContactButton({ contactId }: { contactId: string }) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    // Use native confirm for destructive actions (accessible)
    if (!confirm("Jeste li sigurni da želite obrisati ovaj kontakt?")) {
      return
    }

    startTransition(async () => {
      const result = await deleteContact(contactId)
      if (result?.error) {
        toast.error("Greška", result.error)
      } else {
        toast.success("Kontakt obrisan")
      }
    })
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDelete}
      disabled={isPending}
    >
      {isPending ? "Brisanje..." : "Obriši"}
    </Button>
  )
}
```

**Step 2: Update products delete button**

```tsx
// src/app/(dashboard)/products/delete-button.tsx
"use client"

import { useTransition } from "react"
import { deleteProduct } from "@/app/actions/product"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"

export function DeleteProductButton({ productId }: { productId: string }) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (!confirm("Jeste li sigurni da želite obrisati ovaj proizvod?")) {
      return
    }

    startTransition(async () => {
      const result = await deleteProduct(productId)
      if (result?.error) {
        toast.error("Greška", result.error)
      } else {
        toast.success("Proizvod obrisan")
      }
    })
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDelete}
      disabled={isPending}
    >
      {isPending ? "Brisanje..." : "Obriši"}
    </Button>
  )
}
```

**Step 3: Update invoice actions**

```tsx
// src/app/(dashboard)/e-invoices/invoice-actions.tsx
"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { sendEInvoice, deleteEInvoice } from "@/app/actions/e-invoice"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"

type Invoice = {
  id: string
  status: string
}

export function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSend = () => {
    startTransition(async () => {
      const toastId = toast.loading("Slanje e-računa...")
      const result = await sendEInvoice(invoice.id)
      toast.dismiss(toastId)

      if (result?.error) {
        toast.error("Greška pri slanju", result.error)
      } else {
        toast.success("E-račun poslan", "Fiskalizacija u tijeku")
        router.refresh()
      }
    })
  }

  const handleDelete = () => {
    if (!confirm("Jeste li sigurni da želite obrisati ovaj e-račun?")) {
      return
    }

    startTransition(async () => {
      const result = await deleteEInvoice(invoice.id)
      if (result?.error) {
        toast.error("Greška", result.error)
      } else {
        toast.success("E-račun obrisan")
        router.refresh()
      }
    })
  }

  const canSend = invoice.status === "DRAFT"
  const canDelete = invoice.status === "DRAFT"

  return (
    <div className="flex gap-2">
      {canSend && (
        <Button size="sm" onClick={handleSend} disabled={isPending}>
          {isPending ? "..." : "Pošalji"}
        </Button>
      )}
      {canDelete && (
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
        >
          Obriši
        </Button>
      )}
    </div>
  )
}
```

**Verification:**
- Run: `npm run build`
- Expected: Build passes

---

## Task 6: Add Buyer Typeahead Search Component

**Files:**
- Create: `/home/admin/FiskAI/src/components/ui/combobox.tsx`

**Step 1: Create accessible combobox component**

```tsx
// src/components/ui/combobox.tsx
"use client"

import { useState, useRef, useEffect, KeyboardEvent } from "react"
import { cn } from "@/lib/utils"

export interface ComboboxOption {
  value: string
  label: string
  description?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
  id?: string
  disabled?: boolean
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Odaberite...",
  emptyMessage = "Nema rezultata",
  className,
  id,
  disabled,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedOption = options.find((o) => o.value === value)

  const filteredOptions = options.filter(
    (option) =>
      option.label.toLowerCase().includes(search.toLowerCase()) ||
      option.description?.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    if (!isOpen) {
      setSearch("")
      setHighlightedIndex(0)
    }
  }, [isOpen])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) =>
          Math.min(prev + 1, filteredOptions.length - 1)
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => Math.max(prev - 1, 0))
        break
      case "Enter":
        e.preventDefault()
        if (filteredOptions[highlightedIndex]) {
          onChange(filteredOptions[highlightedIndex].value)
          setIsOpen(false)
        }
        break
      case "Escape":
        setIsOpen(false)
        break
    }
  }

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={
          isOpen && filteredOptions[highlightedIndex]
            ? `${id}-option-${highlightedIndex}`
            : undefined
        }
        className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        placeholder={isOpen ? "Pretraži..." : selectedOption?.label || placeholder}
        value={isOpen ? search : ""}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />

      {/* Display selected value when not searching */}
      {!isOpen && selectedOption && (
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm">
          {selectedOption.label}
        </div>
      )}

      {/* Dropdown arrow */}
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        <svg
          className={cn("h-4 w-4 text-gray-400 transition-transform", isOpen && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <ul
          ref={listRef}
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</li>
          ) : (
            filteredOptions.map((option, index) => (
              <li
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={option.value === value}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm",
                  index === highlightedIndex && "bg-blue-50",
                  option.value === value && "bg-blue-100 font-medium"
                )}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={() => handleSelect(option.value)}
              >
                <div>{option.label}</div>
                {option.description && (
                  <div className="text-xs text-gray-500">{option.description}</div>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
```

**Verification:**
- Run: `npm run build`
- Expected: Build passes

---

## Task 7: Update Invoice Form with Buyer Typeahead

**Files:**
- Modify: `/home/admin/FiskAI/src/app/(dashboard)/e-invoices/new/invoice-form.tsx`

**Step 1: Replace select with Combobox for buyer selection**

At the top of the file, add import:
```tsx
import { Combobox, ComboboxOption } from "@/components/ui/combobox"
```

Convert contacts to ComboboxOptions:
```tsx
const buyerOptions: ComboboxOption[] = contacts.map((contact) => ({
  value: contact.id,
  label: contact.name,
  description: `OIB: ${contact.oib}`,
}))
```

Replace the buyer select (around lines 100-117) with:
```tsx
<div>
  <label htmlFor="buyer-select" className="block text-sm font-medium text-gray-700">
    Kupac *
  </label>
  <Combobox
    id="buyer-select"
    options={buyerOptions}
    value={watch("buyerId") || ""}
    onChange={(value) => setValue("buyerId", value)}
    placeholder="Pretraži kupce..."
    emptyMessage="Nema pronađenih kupaca"
  />
  {errors.buyerId && (
    <p className="mt-1 text-sm text-red-600">{errors.buyerId.message}</p>
  )}
</div>
```

**Verification:**
- Run: `npm run build`
- Expected: Build passes

---

## Task 8: Add Product Picker to Invoice Lines

**Files:**
- Create: `/home/admin/FiskAI/src/components/invoice/product-picker.tsx`
- Modify: `/home/admin/FiskAI/src/app/(dashboard)/e-invoices/new/invoice-form.tsx`
- Modify: `/home/admin/FiskAI/src/app/(dashboard)/e-invoices/new/page.tsx`

**Step 1: Create product picker component**

```tsx
// src/components/invoice/product-picker.tsx
"use client"

import { Combobox, ComboboxOption } from "@/components/ui/combobox"

type Product = {
  id: string
  name: string
  sku: string | null
  unitPrice: number | { toNumber: () => number }
  vatRate: number | { toNumber: () => number }
  unit: string
}

interface ProductPickerProps {
  products: Product[]
  onSelect: (product: Product) => void
}

export function ProductPicker({ products, onSelect }: ProductPickerProps) {
  const options: ComboboxOption[] = products.map((product) => ({
    value: product.id,
    label: product.name,
    description: product.sku ? `SKU: ${product.sku}` : undefined,
  }))

  const handleChange = (productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (product) {
      onSelect(product)
    }
  }

  return (
    <Combobox
      id="product-picker"
      options={options}
      value=""
      onChange={handleChange}
      placeholder="Dodaj proizvod..."
      emptyMessage="Nema proizvoda"
      className="max-w-xs"
    />
  )
}
```

**Step 2: Update page.tsx to fetch products**

```tsx
// src/app/(dashboard)/e-invoices/new/page.tsx
import { getContacts } from "@/app/actions/contact"
import { getProducts } from "@/app/actions/product"
import { InvoiceForm } from "./invoice-form"

export default async function NewEInvoicePage() {
  const [contacts, products] = await Promise.all([
    getContacts("CUSTOMER"),
    getProducts(),
  ])

  return <InvoiceForm contacts={contacts} products={products} />
}
```

**Step 3: Update invoice form to accept and use products**

Add products to props type and use ProductPicker:

```tsx
// In invoice-form.tsx props:
type InvoiceFormProps = {
  contacts: Contact[]
  products: Product[]
}

// Add import:
import { ProductPicker } from "@/components/invoice/product-picker"

// Add handler for product selection:
const handleProductSelect = (product: Product) => {
  const unitPrice = typeof product.unitPrice === 'number'
    ? product.unitPrice
    : product.unitPrice.toNumber()
  const vatRate = typeof product.vatRate === 'number'
    ? product.vatRate
    : product.vatRate.toNumber()

  append({
    description: product.name,
    quantity: 1,
    unit: product.unit,
    unitPrice: unitPrice,
    vatRate: vatRate,
    vatCategory: "S",
  })
}

// Add ProductPicker above line items:
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Brzo dodaj proizvod
  </label>
  <ProductPicker products={products} onSelect={handleProductSelect} />
</div>
```

**Verification:**
- Run: `npm run build`
- Expected: Build passes

---

## Task 9: Add Form Success Feedback with Toast

**Files:**
- Modify: `/home/admin/FiskAI/src/app/(dashboard)/e-invoices/new/invoice-form.tsx`
- Modify: `/home/admin/FiskAI/src/app/(dashboard)/settings/company-settings-form.tsx`
- Modify: `/home/admin/FiskAI/src/app/(dashboard)/settings/einvoice-settings-form.tsx`

**Step 1: Update invoice form submission**

```tsx
// In invoice-form.tsx, import toast:
import { toast } from "@/lib/toast"

// Update onSubmit handler:
const onSubmit = async (data: EInvoiceFormData) => {
  setError(null)

  const result = await createEInvoice(data)

  if (result?.error) {
    setError(result.error)
    toast.error("Greška", result.error)
    return
  }

  toast.success("E-račun kreiran", "Možete ga pregledati i poslati")
  router.push("/e-invoices")
}
```

**Step 2: Update company settings form**

```tsx
// In company-settings-form.tsx, add import:
import { toast } from "@/lib/toast"

// Update form submission to use toast:
const result = await updateCompanySettings(data)

if (result?.error) {
  setError(result.error)
  toast.error("Greška", result.error)
} else {
  toast.success("Postavke spremljene")
  setError(null)
}
```

**Step 3: Update e-invoice settings form similarly**

```tsx
// In einvoice-settings-form.tsx, add import:
import { toast } from "@/lib/toast"

// Update submission:
if (result?.error) {
  setError(result.error)
  toast.error("Greška", result.error)
} else {
  toast.success("Postavke e-računa spremljene")
  setError(null)
}
```

**Verification:**
- Run: `npm run build`
- Expected: Build passes

---

## Task 10: Commit All Changes

**Step 1: Stage all changes**

```bash
git add -A
```

**Step 2: Commit with descriptive message**

```bash
git commit -m "feat: implement audit phase 3 - accessibility, UX, and Docker optimization

- Optimize Dockerfile by ensuring only production dependencies in runner
- Add accessible DataTable component with caption and scope attributes
- Refactor e-invoices list to use accessible DataTable
- Add sonner toast notification system with ARIA live regions
- Replace browser alerts with accessible toast notifications
- Add Combobox component for typeahead search
- Update invoice form with buyer typeahead search
- Add ProductPicker for quick line item addition
- Add toast feedback for form submissions

Addresses remaining audit findings from phases 4-7

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

**Verification:**
- Run: `git log --oneline -1`
- Expected: Shows new commit with message

---

## Verification Checklist

After all tasks complete:

1. `npm run build` - Must pass with no errors
2. `npm run lint` - Should pass (warnings OK)
3. Test accessibility:
   - Tables have `<caption>` elements (check with DevTools)
   - Toast notifications appear and are announced by screen readers
   - Combobox is keyboard navigable (Arrow keys, Enter, Escape)
4. Test functionality:
   - Create e-invoice with product picker
   - Search for buyer using typeahead
   - Delete actions show toast instead of alert
5. Docker build: `docker build -t fiskai-test .` completes successfully
