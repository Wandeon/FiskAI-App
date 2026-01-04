# FiskAI Layered Architecture Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address all audit findings through a layered architecture refactor that establishes proper foundations before fixing individual issues.

**Architecture:** Five layers building on each other: (1) Foundation utilities for shared patterns, (2) Security hardening for tenant isolation and encryption, (3) Accessibility compliance for WCAG AA, (4) Performance optimization for queries and data fetching, (5) Polish for CI and cleanup.

**Tech Stack:** Next.js 15, TypeScript, Prisma 7, PostgreSQL, Zod, React Hook Form, AES-256-GCM encryption

**Audit Sources:** `audit/*.md` - 11 reports from security, code quality, performance, accessibility, DevEx, domain modeling, UI/UX audits

---

## Layer 1: Foundation Utilities

### Task 1.1: Create ActionResult Type System

**Files:**

- Create: `src/lib/action-result.ts`

**Step 1: Create the ActionResult type and helpers**

```typescript
// src/lib/action-result.ts
export type ActionResult<T = void> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; code?: string; details?: Record<string, string[]> }

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { success: true, data, message }
}

export function err(
  error: string,
  code?: string,
  details?: Record<string, string[]>
): ActionResult<never> {
  return { success: false, error, code, details }
}

export function fromZodError(error: {
  flatten: () => { fieldErrors: Record<string, string[]> }
}): ActionResult<never> {
  return {
    success: false,
    error: "Validation failed",
    code: "VALIDATION_ERROR",
    details: error.flatten().fieldErrors,
  }
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/lib/action-result.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/action-result.ts
git commit -m "feat: add ActionResult type system for consistent server action responses"
```

---

### Task 1.2: Create Decimal Math Utilities

**Files:**

- Create: `src/lib/decimal.ts`

**Step 1: Create decimal math helpers using Prisma Decimal**

```typescript
// src/lib/decimal.ts
import { Prisma } from "@prisma/client"

const Decimal = Prisma.Decimal

export type DecimalLike = Prisma.Decimal | number | string

/**
 * Safely convert any numeric value to Decimal
 */
export function toDecimal(value: DecimalLike): Prisma.Decimal {
  if (value instanceof Decimal) return value
  return new Decimal(value)
}

/**
 * Multiply two values with Decimal precision
 */
export function multiply(a: DecimalLike, b: DecimalLike): Prisma.Decimal {
  return toDecimal(a).mul(toDecimal(b))
}

/**
 * Add multiple values with Decimal precision
 */
export function sum(...values: DecimalLike[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, val) => acc.add(toDecimal(val)), new Decimal(0))
}

/**
 * Calculate percentage of a value (e.g., VAT)
 */
export function percentage(value: DecimalLike, percent: DecimalLike): Prisma.Decimal {
  return multiply(value, toDecimal(percent).div(100))
}

/**
 * Round to 2 decimal places for currency
 */
export function roundCurrency(value: DecimalLike): Prisma.Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

/**
 * Calculate line item totals
 */
export function calculateLineTotal(
  quantity: DecimalLike,
  unitPrice: DecimalLike,
  vatRate: DecimalLike
): { netAmount: Prisma.Decimal; vatAmount: Prisma.Decimal; totalAmount: Prisma.Decimal } {
  const netAmount = roundCurrency(multiply(quantity, unitPrice))
  const vatAmount = roundCurrency(percentage(netAmount, vatRate))
  const totalAmount = roundCurrency(sum(netAmount, vatAmount))
  return { netAmount, vatAmount, totalAmount }
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/lib/decimal.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/decimal.ts
git commit -m "feat: add Decimal math utilities for precise currency calculations"
```

---

### Task 1.3: Create Tenant Guard Utilities

**Files:**

- Create: `src/lib/tenant.ts`

**Step 1: Create tenant verification helpers**

```typescript
// src/lib/tenant.ts
import { db } from "@/lib/db"
import { err, ActionResult } from "@/lib/action-result"

/**
 * Verify a contact belongs to the specified company
 */
export async function verifyContactOwnership(
  contactId: string,
  companyId: string
): Promise<ActionResult<{ id: string }>> {
  const contact = await db.contact.findFirst({
    where: { id: contactId, companyId },
    select: { id: true },
  })

  if (!contact) {
    return err("Contact not found or access denied", "TENANT_MISMATCH")
  }

  return { success: true, data: contact }
}

/**
 * Verify a product belongs to the specified company
 */
export async function verifyProductOwnership(
  productId: string,
  companyId: string
): Promise<ActionResult<{ id: string }>> {
  const product = await db.product.findFirst({
    where: { id: productId, companyId },
    select: { id: true },
  })

  if (!product) {
    return err("Product not found or access denied", "TENANT_MISMATCH")
  }

  return { success: true, data: product }
}

/**
 * Verify an invoice belongs to the specified company
 */
export async function verifyInvoiceOwnership(
  invoiceId: string,
  companyId: string
): Promise<ActionResult<{ id: string; status: string }>> {
  const invoice = await db.eInvoice.findFirst({
    where: { id: invoiceId, companyId },
    select: { id: true, status: true },
  })

  if (!invoice) {
    return err("Invoice not found or access denied", "TENANT_MISMATCH")
  }

  return { success: true, data: invoice }
}

/**
 * Verify multiple contacts belong to the specified company
 */
export async function verifyContactsOwnership(
  contactIds: (string | null | undefined)[],
  companyId: string
): Promise<ActionResult<void>> {
  const validIds = contactIds.filter((id): id is string => !!id)

  if (validIds.length === 0) {
    return { success: true, data: undefined }
  }

  const contacts = await db.contact.findMany({
    where: { id: { in: validIds }, companyId },
    select: { id: true },
  })

  if (contacts.length !== validIds.length) {
    return err("One or more contacts not found or access denied", "TENANT_MISMATCH")
  }

  return { success: true, data: undefined }
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/lib/tenant.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/tenant.ts
git commit -m "feat: add tenant guard utilities for multi-tenancy enforcement"
```

---

### Task 1.4: Export Foundation Utilities

**Files:**

- Create: `src/lib/index.ts`

**Step 1: Create barrel export**

```typescript
// src/lib/index.ts
export * from "./action-result"
export * from "./decimal"
export * from "./tenant"
export * from "./secrets"
```

**Step 2: Commit**

```bash
git add src/lib/index.ts
git commit -m "feat: add barrel export for lib utilities"
```

---

## Layer 2: Security Hardening

### Task 2.1: Update Prisma Schema for Encrypted API Keys

**Files:**

- Modify: `prisma/schema.prisma:83-85`

**Step 1: Update Company model to use encrypted field**

In `prisma/schema.prisma`, change lines 83-85 from:

```prisma
  // E-invoice settings
  eInvoiceProvider    String?
  eInvoiceApiKey      String?
```

To:

```prisma
  // E-invoice settings
  eInvoiceProvider         String?
  eInvoiceApiKeyEncrypted  String?
```

**Step 2: Generate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: rename eInvoiceApiKey to eInvoiceApiKeyEncrypted in schema"
```

---

### Task 2.2: Update Company Settings Validation

**Files:**

- Modify: `src/lib/validations/company.ts:20-23`

**Step 1: Update schema to reflect new field name**

In `src/lib/validations/company.ts`, the schema already uses `eInvoiceApiKey` for input - this is intentional. The encryption happens in the action. No changes needed here.

**Step 2: Verify schema exports**

Run: `npx tsc --noEmit src/lib/validations/company.ts`
Expected: No errors

---

### Task 2.3: Update Company Actions with Encryption

**Files:**

- Modify: `src/app/actions/company.ts`

**Step 1: Add encryption imports and update updateCompanySettings**

Replace the entire `src/app/actions/company.ts` file with:

```typescript
"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth-utils"
import { companySchema, companySettingsSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { encryptSecret, decryptOptionalSecret } from "@/lib/secrets"
import { ok, err, fromZodError, ActionResult } from "@/lib/action-result"

export async function createCompany(
  formData: z.input<typeof companySchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth()

  const validatedFields = companySchema.safeParse(formData)

  if (!validatedFields.success) {
    return fromZodError(validatedFields.error)
  }

  const data = validatedFields.data

  // Check if OIB already exists
  const existingCompany = await db.company.findUnique({
    where: { oib: data.oib },
  })

  if (existingCompany) {
    return err("A company with this OIB already exists", "DUPLICATE_OIB")
  }

  // Create company and link to user as owner
  const company = await db.company.create({
    data: {
      ...data,
      vatNumber: data.isVatPayer ? `HR${data.oib}` : null,
      users: {
        create: {
          userId: user.id!,
          role: "OWNER",
          isDefault: true,
        },
      },
    },
  })

  revalidatePath("/dashboard")
  redirect("/dashboard")
}

export async function updateCompany(
  companyId: string,
  formData: z.input<typeof companySchema>
): Promise<ActionResult<void>> {
  const user = await requireAuth()

  // Verify user has access to this company
  const companyUser = await db.companyUser.findFirst({
    where: {
      userId: user.id!,
      companyId,
      role: { in: ["OWNER", "ADMIN"] },
    },
  })

  if (!companyUser) {
    return err("Unauthorized", "UNAUTHORIZED")
  }

  const validatedFields = companySchema.safeParse(formData)

  if (!validatedFields.success) {
    return fromZodError(validatedFields.error)
  }

  const data = validatedFields.data

  await db.company.update({
    where: { id: companyId },
    data: {
      ...data,
      vatNumber: data.isVatPayer ? `HR${data.oib}` : null,
    },
  })

  revalidatePath("/dashboard")
  return ok(undefined, "Company updated")
}

export async function updateCompanySettings(
  companyId: string,
  formData: z.infer<typeof companySettingsSchema>
): Promise<ActionResult<void>> {
  const user = await requireAuth()

  const companyUser = await db.companyUser.findFirst({
    where: {
      userId: user.id!,
      companyId,
      role: { in: ["OWNER", "ADMIN"] },
    },
  })

  if (!companyUser) {
    return err("Unauthorized", "UNAUTHORIZED")
  }

  const validatedFields = companySettingsSchema.safeParse(formData)

  if (!validatedFields.success) {
    return fromZodError(validatedFields.error)
  }

  const { eInvoiceProvider, eInvoiceApiKey } = validatedFields.data

  // Encrypt API key if provided, otherwise clear it
  let encryptedKey: string | null = null
  if (eInvoiceApiKey && eInvoiceApiKey.trim()) {
    encryptedKey = encryptSecret(eInvoiceApiKey)
  }

  await db.company.update({
    where: { id: companyId },
    data: {
      eInvoiceProvider: eInvoiceProvider || null,
      eInvoiceApiKeyEncrypted: encryptedKey,
    },
  })

  revalidatePath("/settings")
  return ok(undefined, "Settings updated")
}

export async function getCompanyApiKey(companyId: string): Promise<string | null> {
  const user = await requireAuth()

  const companyUser = await db.companyUser.findFirst({
    where: {
      userId: user.id!,
      companyId,
      role: { in: ["OWNER", "ADMIN"] },
    },
  })

  if (!companyUser) {
    return null
  }

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { eInvoiceApiKeyEncrypted: true },
  })

  return decryptOptionalSecret(company?.eInvoiceApiKeyEncrypted)
}

export async function switchCompany(companyId: string): Promise<ActionResult<void>> {
  const user = await requireAuth()

  // Verify user has access
  const companyUser = await db.companyUser.findFirst({
    where: {
      userId: user.id!,
      companyId,
    },
  })

  if (!companyUser) {
    return err("Unauthorized", "UNAUTHORIZED")
  }

  // Set as default
  await db.companyUser.updateMany({
    where: { userId: user.id! },
    data: { isDefault: false },
  })

  await db.companyUser.update({
    where: { id: companyUser.id },
    data: { isDefault: true },
  })

  revalidatePath("/dashboard")
  return ok(undefined, "Company switched")
}

export async function getUserCompanies() {
  const user = await requireAuth()

  return db.companyUser.findMany({
    where: { userId: user.id! },
    include: { company: true },
    orderBy: { createdAt: "asc" },
  })
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/app/actions/company.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/actions/company.ts
git commit -m "feat: add API key encryption to company settings"
```

---

### Task 2.4: Update E-Invoice Actions with Tenant Guards

**Files:**

- Modify: `src/app/actions/e-invoice.ts`

**Step 1: Update e-invoice actions with tenant verification and Decimal math**

Replace the entire `src/app/actions/e-invoice.ts` file with:

```typescript
"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { eInvoiceSchema } from "@/lib/validations"
import { createEInvoiceProvider, generateUBLInvoice } from "@/lib/e-invoice"
import { revalidatePath } from "next/cache"
import { ok, err, fromZodError, ActionResult } from "@/lib/action-result"
import { verifyContactsOwnership, verifyInvoiceOwnership } from "@/lib/tenant"
import { calculateLineTotal, sum, toDecimal, roundCurrency } from "@/lib/decimal"
import { decryptOptionalSecret } from "@/lib/secrets"

export async function createEInvoice(
  formData: z.input<typeof eInvoiceSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const validatedFields = eInvoiceSchema.safeParse(formData)

  if (!validatedFields.success) {
    return fromZodError(validatedFields.error)
  }

  const { buyerId, lines, ...invoiceData } = validatedFields.data

  // SECURITY: Verify buyer belongs to this company
  if (buyerId) {
    const ownershipCheck = await verifyContactsOwnership([buyerId], company.id)
    if (!ownershipCheck.success) {
      return ownershipCheck
    }
  }

  // Calculate totals using Decimal math (no floating point)
  const lineItems = lines.map((line, index) => {
    const { netAmount, vatAmount } = calculateLineTotal(line.quantity, line.unitPrice, line.vatRate)
    return {
      lineNumber: index + 1,
      description: line.description,
      quantity: toDecimal(line.quantity),
      unit: line.unit,
      unitPrice: toDecimal(line.unitPrice),
      netAmount,
      vatRate: toDecimal(line.vatRate),
      vatCategory: line.vatCategory,
      vatAmount,
    }
  })

  const netAmount = roundCurrency(sum(...lineItems.map((l) => l.netAmount)))
  const vatAmount = roundCurrency(sum(...lineItems.map((l) => l.vatAmount)))
  const totalAmount = roundCurrency(sum(netAmount, vatAmount))

  const eInvoice = await db.eInvoice.create({
    data: {
      companyId: company.id,
      direction: "OUTBOUND",
      buyerId: buyerId || null,
      invoiceNumber: invoiceData.invoiceNumber,
      issueDate: invoiceData.issueDate,
      dueDate: invoiceData.dueDate,
      currency: invoiceData.currency,
      buyerReference: invoiceData.buyerReference,
      netAmount,
      vatAmount,
      totalAmount,
      status: "DRAFT",
      lines: {
        create: lineItems,
      },
    },
  })

  revalidatePath("/e-invoices")
  return ok({ id: eInvoice.id }, "E-Invoice created")
}

export async function sendEInvoice(
  eInvoiceId: string
): Promise<ActionResult<{ jir?: string; zki?: string }>> {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const eInvoice = await db.eInvoice.findFirst({
    where: {
      id: eInvoiceId,
      companyId: company.id,
      direction: "OUTBOUND",
      status: { in: ["DRAFT", "ERROR"] },
    },
    include: {
      lines: true,
      buyer: true,
      seller: true,
      company: true,
    },
  })

  if (!eInvoice) {
    return err("E-Invoice not found or cannot be sent", "NOT_FOUND")
  }

  // Generate UBL XML
  const ublXml = generateUBLInvoice(eInvoice)

  // Get provider with decrypted API key
  const providerName = company.eInvoiceProvider || "mock"
  const apiKey = decryptOptionalSecret(company.eInvoiceApiKeyEncrypted) || ""

  const provider = createEInvoiceProvider(providerName, { apiKey })

  // Send via provider
  const result = await provider.sendInvoice(eInvoice, ublXml)

  if (!result.success) {
    await db.eInvoice.update({
      where: { id: eInvoiceId },
      data: {
        status: "ERROR",
        providerError: result.error,
      },
    })
    return err(result.error || "Failed to send invoice", "PROVIDER_ERROR")
  }

  // Update invoice with fiscalization data
  await db.eInvoice.update({
    where: { id: eInvoiceId },
    data: {
      status: "SENT",
      ublXml,
      providerRef: result.providerRef,
      jir: result.jir,
      zki: result.zki,
      fiscalizedAt: result.jir ? new Date() : null,
      sentAt: new Date(),
    },
  })

  revalidatePath("/e-invoices")
  return ok({ jir: result.jir, zki: result.zki }, "E-Invoice sent successfully")
}

export async function getEInvoices(
  direction?: "OUTBOUND" | "INBOUND",
  status?: string,
  limit = 50,
  offset = 0
) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  return db.eInvoice.findMany({
    where: {
      companyId: company.id,
      ...(direction && { direction }),
      ...(status && {
        status: status as
          | "DRAFT"
          | "PENDING_FISCALIZATION"
          | "FISCALIZED"
          | "SENT"
          | "DELIVERED"
          | "ACCEPTED"
          | "REJECTED"
          | "ARCHIVED"
          | "ERROR",
      }),
    },
    select: {
      id: true,
      invoiceNumber: true,
      issueDate: true,
      dueDate: true,
      currency: true,
      netAmount: true,
      vatAmount: true,
      totalAmount: true,
      status: true,
      jir: true,
      direction: true,
      createdAt: true,
      buyer: {
        select: { id: true, name: true, oib: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  })
}

export async function getEInvoice(eInvoiceId: string) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  return db.eInvoice.findFirst({
    where: {
      id: eInvoiceId,
      companyId: company.id,
    },
    include: {
      buyer: true,
      seller: true,
      company: true,
      lines: {
        orderBy: { lineNumber: "asc" },
      },
    },
  })
}

export async function deleteEInvoice(eInvoiceId: string): Promise<ActionResult<void>> {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const ownershipCheck = await verifyInvoiceOwnership(eInvoiceId, company.id)
  if (!ownershipCheck.success) {
    return ownershipCheck
  }

  if (ownershipCheck.data.status !== "DRAFT") {
    return err("Can only delete draft invoices", "INVALID_STATUS")
  }

  await db.eInvoice.delete({
    where: { id: eInvoiceId },
  })

  revalidatePath("/e-invoices")
  return ok(undefined, "E-Invoice deleted")
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/app/actions/e-invoice.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/actions/e-invoice.ts
git commit -m "feat: add tenant guards and Decimal math to e-invoice actions

SECURITY: Verify buyerId belongs to caller's company before creating invoice
SECURITY: Use encrypted API key when sending to provider
PERF: Add pagination to getEInvoices, optimize select fields"
```

---

### Task 2.5: Apply Database Migration for Encrypted Keys

**Files:**

- Database operation

**Step 1: Rename column in database**

Run on VPS-01:

```bash
ssh admin@vps-01 'docker exec -i fiskai-postgres psql -U fiskai -d fiskai -c "ALTER TABLE \"Company\" RENAME COLUMN \"eInvoiceApiKey\" TO \"eInvoiceApiKeyEncrypted\";"'
```

Expected: `ALTER TABLE`

**Step 2: Verify column renamed**

Run:

```bash
ssh admin@vps-01 'docker exec -i fiskai-postgres psql -U fiskai -d fiskai -c "\d \"Company\"" | grep -i apikey'
```

Expected: Shows `eInvoiceApiKeyEncrypted`

**Step 3: Sync Prisma state**

Run:

```bash
ssh admin@vps-01 "cd FiskAI && DATABASE_URL='postgresql://fiskai:fiskai_secret_2025@172.18.0.2:5432/fiskai?schema=public' npx prisma db pull --config=prisma.config.ts"
```

---

## Layer 3: Accessibility Compliance

### Task 3.1: Fix HTML Language Attribute

**Files:**

- Modify: `src/app/layout.tsx:15`

**Step 1: Change lang from "en" to "hr"**

In `src/app/layout.tsx`, change line 15 from:

```tsx
    <html lang="en">
```

To:

```tsx
    <html lang="hr">
```

**Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix(a11y): set document language to Croatian (hr)"
```

---

### Task 3.2: Add ARIA Attributes to Input Component

**Files:**

- Modify: `src/components/ui/input.tsx`

**Step 1: Update Input component with ARIA support**

Replace the entire `src/components/ui/input.tsx` with:

```tsx
import { forwardRef, InputHTMLAttributes, useId } from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
  label?: string
  description?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, description, id: providedId, ...props }, ref) => {
    const generatedId = useId()
    const id = providedId || generatedId
    const errorId = `${id}-error`
    const descriptionId = `${id}-description`

    const hasError = !!error
    const hasDescription = !!description

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <input
          id={id}
          className={cn(
            "flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
            hasError ? "border-red-500" : "border-gray-300",
            className
          )}
          ref={ref}
          aria-invalid={hasError ? "true" : undefined}
          aria-describedby={
            [hasError && errorId, hasDescription && descriptionId].filter(Boolean).join(" ") ||
            undefined
          }
          {...props}
        />
        {description && !hasError && (
          <p id={descriptionId} className="mt-1 text-sm text-gray-500">
            {description}
          </p>
        )}
        {hasError && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-red-500">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/components/ui/input.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ui/input.tsx
git commit -m "fix(a11y): add ARIA attributes and labels to Input component

- Add aria-invalid for error states
- Add aria-describedby linking to error/description
- Add optional label prop with htmlFor
- Add role=alert for error messages"
```

---

### Task 3.3: Create Accessible Select Component

**Files:**

- Create: `src/components/ui/select.tsx`

**Step 1: Create Select component with accessibility**

```tsx
// src/components/ui/select.tsx
import { forwardRef, SelectHTMLAttributes, useId } from "react"
import { cn } from "@/lib/utils"

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string
  label?: string
  description?: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, error, label, description, options, placeholder, id: providedId, ...props },
    ref
  ) => {
    const generatedId = useId()
    const id = providedId || generatedId
    const errorId = `${id}-error`
    const descriptionId = `${id}-description`

    const hasError = !!error
    const hasDescription = !!description

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <select
          id={id}
          className={cn(
            "flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
            hasError ? "border-red-500" : "border-gray-300",
            className
          )}
          ref={ref}
          aria-invalid={hasError ? "true" : undefined}
          aria-describedby={
            [hasError && errorId, hasDescription && descriptionId].filter(Boolean).join(" ") ||
            undefined
          }
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {description && !hasError && (
          <p id={descriptionId} className="mt-1 text-sm text-gray-500">
            {description}
          </p>
        )}
        {hasError && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-red-500">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
```

**Step 2: Update UI component exports**

Create or update `src/components/ui/index.ts`:

```typescript
export { Button } from "./button"
export { Input } from "./input"
export { Card, CardHeader, CardTitle, CardContent, CardDescription } from "./card"
export { Select } from "./select"
```

**Step 3: Commit**

```bash
git add src/components/ui/select.tsx src/components/ui/index.ts
git commit -m "feat(a11y): add accessible Select component with ARIA support"
```

---

### Task 3.4: Add Table Accessibility to E-Invoice List

**Files:**

- Modify: `src/app/(dashboard)/e-invoices/page.tsx`

**Step 1: Add caption and scope attributes to invoice table**

In `src/app/(dashboard)/e-invoices/page.tsx`, find the `<table>` element and add a caption. Update the table structure:

Find:

```tsx
              <table className="w-full">
                <thead className="border-b bg-gray-50">
```

Replace with:

```tsx
              <table className="w-full">
                <caption className="sr-only">
                  Lista e-računa s brojem računa, kupcem, datumom, iznosom i statusom
                </caption>
                <thead className="border-b bg-gray-50">
```

Also update each `<th>` to include `scope="col"`:

Find:

```tsx
<th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Broj računa</th>
```

Replace with:

```tsx
<th scope="col" className="px-4 py-3 text-left text-sm font-medium text-gray-500">
  Broj računa
</th>
```

(Repeat for all 7 `<th>` elements)

**Step 2: Add status text alongside color badges**

The status badges already have text labels (from `statusLabels` map), which is good. No change needed.

**Step 3: Commit**

```bash
git add src/app/(dashboard)/e-invoices/page.tsx
git commit -m "fix(a11y): add table caption and scope attributes to invoice list"
```

---

## Layer 4: Performance Optimization

### Task 4.1: Convert New Invoice Page to Server-Side Data Fetching

**Files:**

- Modify: `src/app/(dashboard)/e-invoices/new/page.tsx`

**Step 1: Split into server component and client form**

Create a new file `src/app/(dashboard)/e-invoices/new/invoice-form.tsx` with the form logic, and update the page to be a server component that fetches data.

First, create the form component:

```tsx
// src/app/(dashboard)/e-invoices/new/invoice-form.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { eInvoiceSchema } from "@/lib/validations"
import { createEInvoice } from "@/app/actions/e-invoice"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

type EInvoiceFormInput = z.input<typeof eInvoiceSchema>

interface Contact {
  id: string
  name: string
  oib: string | null
}

interface InvoiceFormProps {
  contacts: Contact[]
}

export function InvoiceForm({ contacts }: InvoiceFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EInvoiceFormInput>({
    resolver: zodResolver(eInvoiceSchema),
    defaultValues: {
      issueDate: new Date(),
      currency: "EUR",
      lines: [
        {
          description: "",
          quantity: 1,
          unit: "C62",
          unitPrice: 0,
          vatRate: 25,
          vatCategory: "S",
        },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
  })

  const lines = watch("lines")
  const totals = lines.reduce(
    (acc, line) => {
      const net = (line.quantity || 0) * (line.unitPrice || 0)
      const vat = net * ((line.vatRate || 0) / 100)
      return {
        net: acc.net + net,
        vat: acc.vat + vat,
        total: acc.total + net + vat,
      }
    },
    { net: 0, vat: 0, total: 0 }
  )

  async function onSubmit(data: EInvoiceFormInput) {
    setLoading(true)
    setError(null)

    const result = await createEInvoice(data)

    if (!result.success) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push("/e-invoices")
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Osnovni podaci</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="buyerId" className="text-sm font-medium">
              Kupac
            </label>
            <select
              id="buyerId"
              className="h-10 w-full rounded-md border border-gray-300 px-3"
              aria-invalid={errors.buyerId ? "true" : undefined}
              aria-describedby={errors.buyerId ? "buyerId-error" : undefined}
              {...register("buyerId")}
            >
              <option value="">Odaberite kupca</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name} {contact.oib && `(${contact.oib})`}
                </option>
              ))}
            </select>
            {errors.buyerId && (
              <p id="buyerId-error" role="alert" className="text-sm text-red-500">
                {errors.buyerId.message}
              </p>
            )}
          </div>

          <Input
            label="Broj računa"
            {...register("invoiceNumber")}
            error={errors.invoiceNumber?.message}
          />

          <Input
            label="Datum izdavanja"
            type="date"
            {...register("issueDate")}
            error={errors.issueDate?.message}
          />

          <Input label="Datum dospijeća" type="date" {...register("dueDate")} />

          <Input label="Referenca kupca" {...register("buyerReference")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Stavke</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                description: "",
                quantity: 1,
                unit: "C62",
                unitPrice: 0,
                vatRate: 25,
                vatCategory: "S",
              })
            }
          >
            Dodaj stavku
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="grid gap-4 rounded-md border p-4 md:grid-cols-6">
              <div className="md:col-span-2">
                <Input label="Opis" {...register(`lines.${index}.description`)} />
              </div>
              <Input
                label="Količina"
                type="number"
                step="0.001"
                {...register(`lines.${index}.quantity`, {
                  valueAsNumber: true,
                })}
              />
              <Input
                label="Cijena"
                type="number"
                step="0.01"
                {...register(`lines.${index}.unitPrice`, {
                  valueAsNumber: true,
                })}
              />
              <Input
                label="PDV %"
                type="number"
                {...register(`lines.${index}.vatRate`, {
                  valueAsNumber: true,
                })}
              />
              <div className="flex items-end">
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    Ukloni
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end space-y-1 text-right">
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Neto: {totals.net.toFixed(2)} EUR</p>
              <p className="text-sm text-gray-500">PDV: {totals.vat.toFixed(2)} EUR</p>
              <p className="text-lg font-bold">Ukupno: {totals.total.toFixed(2)} EUR</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? "Spremanje..." : "Spremi kao nacrt"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Odustani
        </Button>
      </div>
    </form>
  )
}
```

**Step 2: Update page to be server component**

Replace `src/app/(dashboard)/e-invoices/new/page.tsx` with:

```tsx
// src/app/(dashboard)/e-invoices/new/page.tsx
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { InvoiceForm } from "./invoice-form"

export default async function NewEInvoicePage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  // Fetch contacts server-side (no client-side fetch)
  const contacts = await db.contact.findMany({
    where: {
      companyId: company.id,
      type: { in: ["CUSTOMER", "BOTH"] },
    },
    select: {
      id: true,
      name: true,
      oib: true,
    },
    orderBy: { name: "asc" },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Novi E-Račun</h1>
      <InvoiceForm contacts={contacts} />
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/e-invoices/new/page.tsx src/app/(dashboard)/e-invoices/new/invoice-form.tsx
git commit -m "perf: convert new invoice page to server-side data fetching

- Split into server component (page) and client component (form)
- Contacts now fetched server-side, eliminating client-side useEffect
- Reduces network round-trips and improves TTFB"
```

---

## Layer 5: Polish & CI

### Task 5.1: Update E-Invoice List Page with Optimized Data

**Files:**

- Modify: `src/app/(dashboard)/e-invoices/page.tsx`

**Step 1: Update to use new getEInvoices return type**

The `getEInvoices` action now returns optimized data. Update any type references if needed. The page should work with the new select fields.

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit any type fixes**

```bash
git add -A
git commit -m "chore: update e-invoice list to use optimized query data"
```

---

### Task 5.2: Fix ESLint Warnings

**Files:**

- Multiple files with unused imports

**Step 1: Run ESLint with fix**

Run: `npm run lint -- --fix`

**Step 2: Manually fix remaining warnings**

Review output and remove unused variables/imports.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: fix ESLint warnings - remove unused imports and variables"
```

---

### Task 5.3: Update Settings Form for Encrypted Keys

**Files:**

- Modify: `src/app/(dashboard)/settings/einvoice-settings-form.tsx`

**Step 1: Update form to handle ActionResult type**

The form needs to check `result.success` instead of `result?.error`. Update the onSubmit handler.

**Step 2: Update company settings page to show masked key status**

Instead of showing the API key value, show whether one is configured: "API ključ konfiguriran" or input field.

**Step 3: Commit**

```bash
git add src/app/(dashboard)/settings/einvoice-settings-form.tsx
git commit -m "feat: update settings form to work with encrypted API keys"
```

---

### Task 5.4: Full Build and Deploy

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no type errors

**Step 2: Run lint**

Run: `npm run lint`
Expected: No errors (warnings OK)

**Step 3: Commit all remaining changes**

```bash
git add -A
git commit -m "chore: final build verification for layered architecture refactor"
```

**Step 4: Push to GitHub**

```bash
git push
```

**Step 5: Deploy to VPS-01**

```bash
ssh admin@vps-01 "cd FiskAI && git pull && docker compose build && docker compose up -d"
```

**Step 6: Apply schema changes**

```bash
ssh admin@vps-01 "cd FiskAI && DATABASE_URL='postgresql://fiskai:fiskai_secret_2025@172.18.0.2:5432/fiskai?schema=public' npx prisma db push --config=prisma.config.ts"
```

---

## Summary of Changes

### Files Created:

- `src/lib/action-result.ts` - Typed ActionResult system
- `src/lib/decimal.ts` - Decimal math utilities
- `src/lib/tenant.ts` - Tenant ownership guards
- `src/lib/index.ts` - Barrel exports
- `src/components/ui/select.tsx` - Accessible select component
- `src/components/ui/index.ts` - UI component exports
- `src/app/(dashboard)/e-invoices/new/invoice-form.tsx` - Client form component

### Files Modified:

- `prisma/schema.prisma` - Renamed eInvoiceApiKey to eInvoiceApiKeyEncrypted
- `src/app/layout.tsx` - Changed lang="en" to lang="hr"
- `src/components/ui/input.tsx` - Added ARIA attributes
- `src/app/actions/company.ts` - Added encryption, ActionResult types
- `src/app/actions/e-invoice.ts` - Added tenant guards, Decimal math, pagination
- `src/app/(dashboard)/e-invoices/page.tsx` - Added table accessibility
- `src/app/(dashboard)/e-invoices/new/page.tsx` - Server-side data fetching
- `src/app/(dashboard)/settings/einvoice-settings-form.tsx` - Encrypted key handling

### Security Fixes:

- Cross-tenant contact disclosure (CRITICAL)
- Plaintext API key storage (CRITICAL)
- Tenant ownership verification on all mutations

### Accessibility Fixes:

- Document language set to Croatian
- ARIA attributes on form inputs
- Table captions and scope attributes
- Role="alert" on error messages

### Performance Fixes:

- Server-side data fetching for invoice form
- Pagination on invoice list query
- Optimized select fields (not loading unused relations)
- Decimal-based money math (no floating point)

---

## Verification Checklist

- [ ] All TypeScript compiles without errors
- [ ] ESLint passes (warnings OK)
- [ ] Build succeeds
- [ ] Database schema synced
- [ ] App runs locally
- [ ] App deployed to production
- [ ] Can create contact (tenant isolated)
- [ ] Can create invoice (buyer verified)
- [ ] Can save API key (encrypted)
- [ ] Can send invoice (decrypts key)
- [ ] Screen reader announces form errors
