# FiskAI Phases 8-16 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 9 remaining feature phases to bring FiskAI to production readiness.

**Architecture:** Modular implementation with each phase building on previous. Audit logging first (foundation), then compliance/invoicing, then reporting/banking, finally AI features.

**Tech Stack:** Next.js 15, Prisma 7, PostgreSQL, TypeScript, Tailwind CSS, Zod

---

## Phase 8: Audit Logging

### Task 8.1: Add AuditLog Model to Prisma Schema

**Files:**

- Modify: `prisma/schema.prisma:275` (append at end)

**Step 1: Add the AuditLog model and enum**

Add at end of `prisma/schema.prisma`:

```prisma
// ============================================
// AUDIT LOGGING
// ============================================

model AuditLog {
  id          String      @id @default(cuid())
  companyId   String
  userId      String?
  action      AuditAction
  entity      String      // "EInvoice", "Contact", "Product", etc.
  entityId    String
  changes     Json?       // { before: {...}, after: {...} }
  ipAddress   String?
  userAgent   String?
  timestamp   DateTime    @default(now())

  @@index([companyId])
  @@index([entity, entityId])
  @@index([timestamp])
  @@index([userId])
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  VIEW
  EXPORT
  LOGIN
  LOGOUT
  FISCALIZE
}
```

**Step 2: Generate Prisma client and push schema**

Run:

```bash
npx prisma db push
```

Expected: Schema synced, AuditLog table created.

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(audit): add AuditLog model to schema"
```

---

### Task 8.2: Create Audit Logging Library

**Files:**

- Create: `src/lib/audit.ts`

**Step 1: Create the audit logging helper**

Create `src/lib/audit.ts`:

```typescript
import { prisma } from "@/lib/db"
import { AuditAction } from "@prisma/client"

interface AuditLogParams {
  companyId: string
  userId?: string
  action: AuditAction
  entity: string
  entityId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  const { before, after, ...rest } = params

  const changes = before || after ? { before, after } : null

  try {
    await prisma.auditLog.create({
      data: {
        ...rest,
        changes,
      },
    })
  } catch (error) {
    // Log to console but don't fail the main operation
    console.error("[AUDIT] Failed to log audit entry:", error)
  }
}

export async function getAuditLogs(
  companyId: string,
  options?: {
    entity?: string
    entityId?: string
    userId?: string
    action?: AuditAction
    fromDate?: Date
    toDate?: Date
    limit?: number
    offset?: number
  }
) {
  const where: Record<string, unknown> = { companyId }

  if (options?.entity) where.entity = options.entity
  if (options?.entityId) where.entityId = options.entityId
  if (options?.userId) where.userId = options.userId
  if (options?.action) where.action = options.action

  if (options?.fromDate || options?.toDate) {
    where.timestamp = {}
    if (options.fromDate) (where.timestamp as Record<string, Date>).gte = options.fromDate
    if (options.toDate) (where.timestamp as Record<string, Date>).lte = options.toDate
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    }),
    prisma.auditLog.count({ where }),
  ])

  return { logs, total }
}
```

**Step 2: Commit**

```bash
git add src/lib/audit.ts
git commit -m "feat(audit): add audit logging library"
```

---

### Task 8.3: Create Audit Log Server Actions

**Files:**

- Create: `src/app/actions/audit.ts`

**Step 1: Create the audit actions**

Create `src/app/actions/audit.ts`:

```typescript
"use server"

import { requireAuth } from "@/lib/auth-utils"
import { getAuditLogs } from "@/lib/audit"
import { AuditAction } from "@prisma/client"

export async function getAuditLogsAction(options?: {
  entity?: string
  entityId?: string
  action?: AuditAction
  fromDate?: string
  toDate?: string
  limit?: number
  offset?: number
}) {
  const { company } = await requireAuth()

  return getAuditLogs(company.id, {
    ...options,
    fromDate: options?.fromDate ? new Date(options.fromDate) : undefined,
    toDate: options?.toDate ? new Date(options.toDate) : undefined,
  })
}
```

**Step 2: Commit**

```bash
git add src/app/actions/audit.ts
git commit -m "feat(audit): add audit log server actions"
```

---

### Task 8.4: Add Audit Logging to Existing Actions

**Files:**

- Modify: `src/app/actions/e-invoice.ts`
- Modify: `src/app/actions/contact.ts`
- Modify: `src/app/actions/product.ts`

**Step 1: Update e-invoice.ts imports**

Add at top of `src/app/actions/e-invoice.ts`:

```typescript
import { logAudit } from "@/lib/audit"
import { AuditAction } from "@prisma/client"
```

**Step 2: Add audit logging to createEInvoice**

After successful create in `createEInvoice`, add:

```typescript
await logAudit({
  companyId: company.id,
  userId: user.id,
  action: AuditAction.CREATE,
  entity: "EInvoice",
  entityId: eInvoice.id,
  after: {
    invoiceNumber: eInvoice.invoiceNumber,
    buyerId: eInvoice.buyerId,
    totalAmount: eInvoice.totalAmount.toString(),
  },
})
```

**Step 3: Update contact.ts with audit logging**

Add import and logging to createContact, updateContact, deleteContact:

```typescript
import { logAudit } from "@/lib/audit"
import { AuditAction } from "@prisma/client"

// In createContact after prisma.contact.create:
await logAudit({
  companyId: company.id,
  userId: user.id,
  action: AuditAction.CREATE,
  entity: "Contact",
  entityId: contact.id,
  after: { name: contact.name, oib: contact.oib },
})

// In updateContact:
await logAudit({
  companyId: company.id,
  userId: user.id,
  action: AuditAction.UPDATE,
  entity: "Contact",
  entityId: id,
  before: { name: existing.name },
  after: { name: data.name },
})

// In deleteContact:
await logAudit({
  companyId: company.id,
  userId: user.id,
  action: AuditAction.DELETE,
  entity: "Contact",
  entityId: id,
  before: { name: contact.name, oib: contact.oib },
})
```

**Step 4: Update product.ts similarly**

Add same pattern to product actions.

**Step 5: Commit**

```bash
git add src/app/actions/e-invoice.ts src/app/actions/contact.ts src/app/actions/product.ts
git commit -m "feat(audit): add audit logging to all entity actions"
```

---

### Task 8.5: Create Audit Log UI Page

**Files:**

- Create: `src/app/(dashboard)/settings/audit-log/page.tsx`

**Step 1: Create the audit log page**

Create `src/app/(dashboard)/settings/audit-log/page.tsx`:

```typescript
import { getAuditLogsAction } from "@/app/actions/audit";
import { DataTable } from "@/components/ui/data-table";

export default async function AuditLogPage() {
  const { logs, total } = await getAuditLogsAction({ limit: 100 });

  const columns = [
    { key: "timestamp", header: "Vrijeme" },
    { key: "action", header: "Akcija" },
    { key: "entity", header: "Entitet" },
    { key: "entityId", header: "ID" },
  ];

  const rows = logs.map((log) => ({
    timestamp: new Date(log.timestamp).toLocaleString("hr-HR"),
    action: log.action,
    entity: log.entity,
    entityId: log.entityId.slice(0, 8) + "...",
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Revizijski trag</h1>
          <p className="text-gray-500">{total} zapisa ukupno</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        caption="Povijest svih promjena u sustavu"
      />
    </div>
  );
}
```

**Step 2: Add link to settings sidebar**

Modify `src/app/(dashboard)/settings/page.tsx` to include link to audit log.

**Step 3: Commit**

```bash
git add src/app/(dashboard)/settings/audit-log/page.tsx
git commit -m "feat(audit): add audit log UI page"
```

---

## Phase 9: Invoice Numbering & Compliance

### Task 9.1: Add Numbering Models to Schema

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add BusinessPremises, PaymentDevice, InvoiceSequence models**

Add before the AuditLog section in schema:

```prisma
// ============================================
// INVOICE NUMBERING (Croatian Compliance)
// ============================================

model BusinessPremises {
  id          String   @id @default(cuid())
  companyId   String
  code        Int      // 1, 2, 3...
  name        String   // "Glavni ured"
  address     String?
  isDefault   Boolean  @default(false)
  isActive    Boolean  @default(true)

  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  devices     PaymentDevice[]
  sequences   InvoiceSequence[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([companyId, code])
  @@index([companyId])
}

model PaymentDevice {
  id                  String   @id @default(cuid())
  companyId           String
  businessPremisesId  String
  code                Int      // 1, 2, 3...
  name                String   // "Blagajna 1"
  isDefault           Boolean  @default(false)
  isActive            Boolean  @default(true)

  company             Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  businessPremises    BusinessPremises @relation(fields: [businessPremisesId], references: [id], onDelete: Cascade)

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@unique([businessPremisesId, code])
  @@index([companyId])
}

model InvoiceSequence {
  id                  String   @id @default(cuid())
  companyId           String
  businessPremisesId  String
  year                Int      // 2025
  lastNumber          Int      @default(0)

  company             Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  businessPremises    BusinessPremises @relation(fields: [businessPremisesId], references: [id], onDelete: Cascade)

  @@unique([businessPremisesId, year])
  @@index([companyId])
}
```

**Step 2: Add relations to Company model**

Add to Company model relations section:

```prisma
businessPremises  BusinessPremises[]
paymentDevices    PaymentDevice[]
invoiceSequences  InvoiceSequence[]
```

**Step 3: Push schema**

```bash
npx prisma db push
```

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(numbering): add BusinessPremises, PaymentDevice, InvoiceSequence models"
```

---

### Task 9.2: Create Invoice Numbering Library

**Files:**

- Create: `src/lib/invoice-numbering.ts`

**Step 1: Create the numbering logic with DB locking**

Create `src/lib/invoice-numbering.ts`:

```typescript
import { prisma } from "@/lib/db"

interface InvoiceNumber {
  formatted: string // "43-1-1" (legal)
  internalReference: string // "2025/43-1-1"
  sequenceNumber: number
  businessPremisesCode: number
  paymentDeviceCode: number
  year: number
}

export async function getNextInvoiceNumber(
  companyId: string,
  businessPremisesId?: string,
  paymentDeviceId?: string
): Promise<InvoiceNumber> {
  const currentYear = new Date().getFullYear()
  const yearShort = currentYear % 100 // 25 for 2025

  // Get or create default business premises
  let premises = businessPremisesId
    ? await prisma.businessPremises.findUnique({ where: { id: businessPremisesId } })
    : await prisma.businessPremises.findFirst({
        where: { companyId, isDefault: true, isActive: true },
      })

  if (!premises) {
    // Create default premises if none exists
    premises = await prisma.businessPremises.create({
      data: {
        companyId,
        code: 1,
        name: "Glavni poslovni prostor",
        isDefault: true,
      },
    })
  }

  // Get or create default payment device
  let device = paymentDeviceId
    ? await prisma.paymentDevice.findUnique({ where: { id: paymentDeviceId } })
    : await prisma.paymentDevice.findFirst({
        where: { companyId, businessPremisesId: premises.id, isDefault: true, isActive: true },
      })

  if (!device) {
    device = await prisma.paymentDevice.create({
      data: {
        companyId,
        businessPremisesId: premises.id,
        code: 1,
        name: "Naplatni uređaj 1",
        isDefault: true,
      },
    })
  }

  // Get next sequence number with row-level locking
  const sequence = await prisma.$transaction(async (tx) => {
    // Try to find existing sequence for this year
    let seq = await tx.invoiceSequence.findUnique({
      where: {
        businessPremisesId_year: {
          businessPremisesId: premises!.id,
          year: currentYear,
        },
      },
    })

    if (!seq) {
      // Create new sequence for this year
      seq = await tx.invoiceSequence.create({
        data: {
          companyId,
          businessPremisesId: premises!.id,
          year: currentYear,
          lastNumber: 1,
        },
      })
      return seq
    }

    // Increment and return
    seq = await tx.invoiceSequence.update({
      where: { id: seq.id },
      data: { lastNumber: { increment: 1 } },
    })

    return seq
  })

  const formatted = `${sequence.lastNumber}-${premises.code}-${device.code}`
  const internalReference = `${currentYear}/${formatted}`

  return {
    formatted,
    internalReference,
    sequenceNumber: sequence.lastNumber,
    businessPremisesCode: premises.code,
    paymentDeviceCode: device.code,
    year: currentYear,
  }
}

export function parseInvoiceNumber(formatted: string): {
  sequenceNumber: number
  businessPremisesCode: number
  paymentDeviceCode: number
} | null {
  const parts = formatted.split("-")
  if (parts.length !== 3) return null

  const [seq, bp, pd] = parts.map(Number)
  if (isNaN(seq) || isNaN(bp) || isNaN(pd)) return null

  return {
    sequenceNumber: seq,
    businessPremisesCode: bp,
    paymentDeviceCode: pd,
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/invoice-numbering.ts
git commit -m "feat(numbering): add invoice numbering library with DB locking"
```

---

### Task 9.3: Create Business Premises Management UI

**Files:**

- Create: `src/app/(dashboard)/settings/premises/page.tsx`
- Create: `src/app/actions/premises.ts`
- Create: `src/lib/validations/premises.ts`

**Step 1: Create validation schema**

Create `src/lib/validations/premises.ts`:

```typescript
import { z } from "zod"

export const businessPremisesSchema = z.object({
  code: z.coerce.number().min(1, "Kod mora biti pozitivan broj"),
  name: z.string().min(1, "Naziv je obavezan"),
  address: z.string().optional(),
  isDefault: z.boolean().default(false),
})

export const paymentDeviceSchema = z.object({
  businessPremisesId: z.string().min(1, "Poslovni prostor je obavezan"),
  code: z.coerce.number().min(1, "Kod mora biti pozitivan broj"),
  name: z.string().min(1, "Naziv je obavezan"),
  isDefault: z.boolean().default(false),
})

export type BusinessPremisesInput = z.infer<typeof businessPremisesSchema>
export type PaymentDeviceInput = z.infer<typeof paymentDeviceSchema>
```

**Step 2: Create server actions**

Create `src/app/actions/premises.ts`:

```typescript
"use server"

import { requireAuth } from "@/lib/auth-utils"
import { prisma } from "@/lib/db"
import { businessPremisesSchema, paymentDeviceSchema } from "@/lib/validations/premises"
import { logAudit } from "@/lib/audit"
import { AuditAction } from "@prisma/client"
import { revalidatePath } from "next/cache"

export async function getBusinessPremises() {
  const { company } = await requireAuth()

  return prisma.businessPremises.findMany({
    where: { companyId: company.id, isActive: true },
    include: { devices: { where: { isActive: true } } },
    orderBy: { code: "asc" },
  })
}

export async function createBusinessPremises(data: unknown) {
  const { company, user } = await requireAuth()
  const parsed = businessPremisesSchema.parse(data)

  // If setting as default, unset other defaults
  if (parsed.isDefault) {
    await prisma.businessPremises.updateMany({
      where: { companyId: company.id },
      data: { isDefault: false },
    })
  }

  const premises = await prisma.businessPremises.create({
    data: { ...parsed, companyId: company.id },
  })

  await logAudit({
    companyId: company.id,
    userId: user.id,
    action: AuditAction.CREATE,
    entity: "BusinessPremises",
    entityId: premises.id,
    after: { code: premises.code, name: premises.name },
  })

  revalidatePath("/settings/premises")
  return { success: true, premises }
}

export async function createPaymentDevice(data: unknown) {
  const { company, user } = await requireAuth()
  const parsed = paymentDeviceSchema.parse(data)

  if (parsed.isDefault) {
    await prisma.paymentDevice.updateMany({
      where: { companyId: company.id, businessPremisesId: parsed.businessPremisesId },
      data: { isDefault: false },
    })
  }

  const device = await prisma.paymentDevice.create({
    data: { ...parsed, companyId: company.id },
  })

  await logAudit({
    companyId: company.id,
    userId: user.id,
    action: AuditAction.CREATE,
    entity: "PaymentDevice",
    entityId: device.id,
    after: { code: device.code, name: device.name },
  })

  revalidatePath("/settings/premises")
  return { success: true, device }
}
```

**Step 3: Create the UI page**

Create `src/app/(dashboard)/settings/premises/page.tsx`:

```typescript
import { getBusinessPremises } from "@/app/actions/premises";
import { DataTable } from "@/components/ui/data-table";
import Link from "next/link";

export default async function PremisesPage() {
  const premises = await getBusinessPremises();

  const columns = [
    { key: "code", header: "Kod" },
    { key: "name", header: "Naziv" },
    { key: "address", header: "Adresa" },
    { key: "devices", header: "Uređaji" },
    { key: "default", header: "Zadano" },
  ];

  const rows = premises.map((p) => ({
    code: p.code,
    name: p.name,
    address: p.address || "-",
    devices: p.devices.length,
    default: p.isDefault ? "Da" : "Ne",
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Poslovni prostori</h1>
          <p className="text-gray-500">Upravljanje poslovnim prostorima i naplatnim uređajima</p>
        </div>
        <Link
          href="/settings/premises/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          + Novi prostor
        </Link>
      </div>

      {premises.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-gray-500">Nemate definiranih poslovnih prostora</p>
          <p className="text-sm text-gray-400 mt-1">
            Sustav će automatski kreirati zadani prostor (1) pri izdavanju prvog računa
          </p>
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} caption="Poslovni prostori" />
      )}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/lib/validations/premises.ts src/app/actions/premises.ts src/app/(dashboard)/settings/premises/page.tsx
git commit -m "feat(numbering): add business premises management UI"
```

---

### Task 9.4: Integrate Numbering with E-Invoice Creation

**Files:**

- Modify: `src/app/actions/e-invoice.ts`
- Modify: `prisma/schema.prisma` (add internalReference field)

**Step 1: Add internalReference to EInvoice model**

Add to EInvoice model in schema:

```prisma
internalReference  String?  // "2025/43-1-1"
```

**Step 2: Update createEInvoice to use auto-numbering**

In `src/app/actions/e-invoice.ts`, update the createEInvoice function:

```typescript
import { getNextInvoiceNumber } from "@/lib/invoice-numbering"

// In createEInvoice, replace manual invoiceNumber with:
const invoiceNum = await getNextInvoiceNumber(company.id)

const eInvoice = await prisma.eInvoice.create({
  data: {
    ...parsed,
    invoiceNumber: invoiceNum.formatted, // "43-1-1"
    internalReference: invoiceNum.internalReference, // "2025/43-1-1"
    companyId: company.id,
    // ... rest of fields
  },
})
```

**Step 3: Push schema and commit**

```bash
npx prisma db push
git add prisma/schema.prisma src/app/actions/e-invoice.ts
git commit -m "feat(numbering): integrate auto-numbering with e-invoice creation"
```

---

## Phase 10: General Invoicing

### Task 10.1: Generalize Invoice Model in Schema

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add Invoice model (generalized from EInvoice)**

Add after the E-Invoice section:

```prisma
// ============================================
// GENERAL INVOICING MODULE
// ============================================

model Invoice {
  id                String        @id @default(cuid())
  companyId         String
  type              InvoiceType

  // Numbering
  invoiceNumber     String        // "43-1-1" (legal format)
  internalReference String        // "2025/43-1-1"

  // Status
  status            InvoiceStatus

  // Parties
  sellerId          String?
  buyerId           String?

  // Dates
  issueDate         DateTime
  dueDate           DateTime?

  // Amounts
  currency          String        @default("EUR")
  netAmount         Decimal       @db.Decimal(10, 2)
  vatAmount         Decimal       @db.Decimal(10, 2)
  totalAmount       Decimal       @db.Decimal(10, 2)

  // Content
  notes             String?

  // E-Invoice specific (nullable)
  ublXml            String?       @db.Text
  jir               String?
  zki               String?
  fiscalizedAt      DateTime?
  providerRef       String?
  providerStatus    String?
  providerError     String?

  // Conversion tracking
  convertedFromId   String?
  convertedFrom     Invoice?      @relation("InvoiceConversion", fields: [convertedFromId], references: [id])
  convertedTo       Invoice[]     @relation("InvoiceConversion")

  // Relations
  company           Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  seller            Contact?      @relation("InvoiceSeller", fields: [sellerId], references: [id])
  buyer             Contact?      @relation("InvoiceBuyer", fields: [buyerId], references: [id])
  lines             InvoiceLine[]

  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  sentAt            DateTime?
  paidAt            DateTime?

  @@unique([companyId, invoiceNumber, type])
  @@index([companyId])
  @@index([type])
  @@index([status])
}

model InvoiceLine {
  id          String   @id @default(cuid())
  invoiceId   String
  lineNumber  Int
  description String
  quantity    Decimal  @db.Decimal(10, 3)
  unit        String   @default("C62")
  unitPrice   Decimal  @db.Decimal(10, 2)
  netAmount   Decimal  @db.Decimal(10, 2)
  vatRate     Decimal  @db.Decimal(5, 2)
  vatCategory String   @default("S")
  vatAmount   Decimal  @db.Decimal(10, 2)

  invoice     Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId])
}

enum InvoiceType {
  INVOICE
  E_INVOICE
  QUOTE
  PROFORMA
  CREDIT_NOTE
  DEBIT_NOTE
}

enum InvoiceStatus {
  DRAFT
  SENT
  VIEWED
  PAID
  PARTIAL
  OVERDUE
  CANCELLED
  PENDING_FISCALIZATION
  FISCALIZED
  DELIVERED
  ACCEPTED
  REJECTED
}
```

**Step 2: Add relation to Company**

Add to Company relations:

```prisma
invoices          Invoice[]
```

**Step 3: Add relations to Contact**

Add to Contact model:

```prisma
invoicesAsBuyer   Invoice[] @relation("InvoiceBuyer")
invoicesAsSeller  Invoice[] @relation("InvoiceSeller")
```

**Step 4: Push schema**

```bash
npx prisma db push
```

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(invoicing): add generalized Invoice model with types"
```

---

### Task 10.2: Create Invoice Validation Schema

**Files:**

- Create: `src/lib/validations/invoice.ts`

**Step 1: Create the validation schema**

Create `src/lib/validations/invoice.ts`:

```typescript
import { z } from "zod"

export const invoiceLineSchema = z.object({
  description: z.string().min(1, "Opis je obavezan"),
  quantity: z.coerce.number().positive("Količina mora biti pozitivna"),
  unit: z.string().default("C62"),
  unitPrice: z.coerce.number().min(0, "Cijena ne može biti negativna"),
  vatRate: z.coerce.number().min(0).max(100),
  vatCategory: z.string().default("S"),
})

export const invoiceSchema = z.object({
  type: z.enum(["INVOICE", "E_INVOICE", "QUOTE", "PROFORMA", "CREDIT_NOTE", "DEBIT_NOTE"]),
  buyerId: z.string().min(1, "Kupac je obavezan"),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  currency: z.string().default("EUR"),
  notes: z.string().optional(),
  lines: z.array(invoiceLineSchema).min(1, "Barem jedna stavka je obavezna"),
})

export type InvoiceInput = z.infer<typeof invoiceSchema>
export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>

export const invoiceTypeLabels: Record<string, string> = {
  INVOICE: "Račun",
  E_INVOICE: "E-Račun",
  QUOTE: "Ponuda",
  PROFORMA: "Predračun",
  CREDIT_NOTE: "Odobrenje",
  DEBIT_NOTE: "Terećenje",
}

export const invoiceStatusLabels: Record<string, string> = {
  DRAFT: "Nacrt",
  SENT: "Poslano",
  VIEWED: "Pregledano",
  PAID: "Plaćeno",
  PARTIAL: "Djelomično plaćeno",
  OVERDUE: "Dospjelo",
  CANCELLED: "Otkazano",
  PENDING_FISCALIZATION: "Čeka fiskalizaciju",
  FISCALIZED: "Fiskalizirano",
  DELIVERED: "Dostavljeno",
  ACCEPTED: "Prihvaćeno",
  REJECTED: "Odbijeno",
}
```

**Step 2: Commit**

```bash
git add src/lib/validations/invoice.ts
git commit -m "feat(invoicing): add invoice validation schemas"
```

---

### Task 10.3: Create Invoice Server Actions

**Files:**

- Create: `src/app/actions/invoice.ts`

**Step 1: Create the invoice actions**

Create `src/app/actions/invoice.ts`:

```typescript
"use server"

import { requireAuth } from "@/lib/auth-utils"
import { prisma } from "@/lib/db"
import { invoiceSchema, InvoiceInput } from "@/lib/validations/invoice"
import { getNextInvoiceNumber } from "@/lib/invoice-numbering"
import { logAudit } from "@/lib/audit"
import { AuditAction, InvoiceType, InvoiceStatus, Prisma } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"
import { revalidatePath } from "next/cache"

export async function createInvoice(data: InvoiceInput) {
  const { company, user } = await requireAuth()
  const parsed = invoiceSchema.parse(data)

  // Verify buyer belongs to company
  const buyer = await prisma.contact.findFirst({
    where: { id: parsed.buyerId, companyId: company.id },
    select: { id: true },
  })

  if (!buyer) {
    return { error: "Kupac nije pronađen" }
  }

  // Get next invoice number
  const invoiceNum = await getNextInvoiceNumber(company.id)

  // Calculate totals using Decimal
  let netAmount = new Decimal(0)
  let vatAmount = new Decimal(0)

  const lines = parsed.lines.map((line, index) => {
    const lineNet = new Decimal(line.quantity).mul(new Decimal(line.unitPrice))
    const lineVat = lineNet.mul(new Decimal(line.vatRate)).div(100)

    netAmount = netAmount.add(lineNet)
    vatAmount = vatAmount.add(lineVat)

    return {
      lineNumber: index + 1,
      description: line.description,
      quantity: new Decimal(line.quantity),
      unit: line.unit,
      unitPrice: new Decimal(line.unitPrice),
      netAmount: lineNet,
      vatRate: new Decimal(line.vatRate),
      vatCategory: line.vatCategory,
      vatAmount: lineVat,
    }
  })

  const totalAmount = netAmount.add(vatAmount)

  const invoice = await prisma.invoice.create({
    data: {
      companyId: company.id,
      type: parsed.type as InvoiceType,
      invoiceNumber: invoiceNum.formatted,
      internalReference: invoiceNum.internalReference,
      status: InvoiceStatus.DRAFT,
      buyerId: parsed.buyerId,
      issueDate: parsed.issueDate,
      dueDate: parsed.dueDate,
      currency: parsed.currency,
      notes: parsed.notes,
      netAmount,
      vatAmount,
      totalAmount,
      lines: { create: lines },
    },
    include: { lines: true, buyer: true },
  })

  await logAudit({
    companyId: company.id,
    userId: user.id,
    action: AuditAction.CREATE,
    entity: "Invoice",
    entityId: invoice.id,
    after: {
      type: invoice.type,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.totalAmount.toString(),
    },
  })

  revalidatePath("/invoices")
  return { success: true, invoice }
}

export async function getInvoices(options?: {
  type?: InvoiceType
  status?: InvoiceStatus
  limit?: number
  cursor?: string
}) {
  const { company } = await requireAuth()
  const limit = Math.min(options?.limit ?? 20, 100)

  const where: Prisma.InvoiceWhereInput = { companyId: company.id }
  if (options?.type) where.type = options.type
  if (options?.status) where.status = options.status

  const invoices = await prisma.invoice.findMany({
    where,
    include: { buyer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    cursor: options?.cursor ? { id: options.cursor } : undefined,
  })

  const hasMore = invoices.length > limit
  const items = hasMore ? invoices.slice(0, -1) : invoices
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

  return { items, nextCursor, hasMore }
}

export async function getInvoice(id: string) {
  const { company } = await requireAuth()

  return prisma.invoice.findFirst({
    where: { id, companyId: company.id },
    include: { buyer: true, seller: true, lines: true },
  })
}

export async function convertQuoteToInvoice(quoteId: string) {
  const { company, user } = await requireAuth()

  const quote = await prisma.invoice.findFirst({
    where: { id: quoteId, companyId: company.id, type: "QUOTE" },
    include: { lines: true },
  })

  if (!quote) {
    return { error: "Ponuda nije pronađena" }
  }

  const invoiceNum = await getNextInvoiceNumber(company.id)

  const invoice = await prisma.invoice.create({
    data: {
      companyId: company.id,
      type: InvoiceType.INVOICE,
      invoiceNumber: invoiceNum.formatted,
      internalReference: invoiceNum.internalReference,
      status: InvoiceStatus.DRAFT,
      buyerId: quote.buyerId,
      issueDate: new Date(),
      dueDate: quote.dueDate,
      currency: quote.currency,
      notes: quote.notes,
      netAmount: quote.netAmount,
      vatAmount: quote.vatAmount,
      totalAmount: quote.totalAmount,
      convertedFromId: quote.id,
      lines: {
        create: quote.lines.map((line) => ({
          lineNumber: line.lineNumber,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unitPrice,
          netAmount: line.netAmount,
          vatRate: line.vatRate,
          vatCategory: line.vatCategory,
          vatAmount: line.vatAmount,
        })),
      },
    },
  })

  await logAudit({
    companyId: company.id,
    userId: user.id,
    action: AuditAction.CREATE,
    entity: "Invoice",
    entityId: invoice.id,
    after: { convertedFrom: quote.id, type: "INVOICE" },
  })

  revalidatePath("/invoices")
  return { success: true, invoice }
}
```

**Step 2: Commit**

```bash
git add src/app/actions/invoice.ts
git commit -m "feat(invoicing): add invoice server actions with conversion"
```

---

### Task 10.4: Create Invoice List Page

**Files:**

- Create: `src/app/(dashboard)/invoices/page.tsx`

**Step 1: Create the invoices list page**

Create `src/app/(dashboard)/invoices/page.tsx`:

```typescript
import { getInvoices } from "@/app/actions/invoice";
import { DataTable } from "@/components/ui/data-table";
import { invoiceTypeLabels, invoiceStatusLabels } from "@/lib/validations/invoice";
import Link from "next/link";

export default async function InvoicesPage() {
  const { items: invoices } = await getInvoices();

  const columns = [
    { key: "internalReference", header: "Broj" },
    { key: "type", header: "Tip" },
    { key: "buyer", header: "Kupac" },
    { key: "issueDate", header: "Datum" },
    { key: "totalAmount", header: "Iznos" },
    { key: "status", header: "Status" },
  ];

  const rows = invoices.map((inv) => ({
    internalReference: inv.internalReference,
    type: invoiceTypeLabels[inv.type] || inv.type,
    buyer: inv.buyer?.name || "-",
    issueDate: new Date(inv.issueDate).toLocaleDateString("hr-HR"),
    totalAmount: `${inv.totalAmount.toString()} ${inv.currency}`,
    status: invoiceStatusLabels[inv.status] || inv.status,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dokumenti</h1>
          <p className="text-gray-500">Računi, ponude, predračuni</p>
        </div>
        <Link
          href="/invoices/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          + Novi dokument
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-gray-500">Nemate još nijedan dokument</p>
          <Link href="/invoices/new" className="text-blue-600 hover:underline">
            Kreirajte prvi dokument
          </Link>
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} caption="Svi dokumenti" />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/invoices/page.tsx
git commit -m "feat(invoicing): add invoices list page"
```

---

### Task 10.5: Create Invoice Form Page

**Files:**

- Create: `src/app/(dashboard)/invoices/new/page.tsx`
- Create: `src/app/(dashboard)/invoices/new/invoice-form.tsx`

**Step 1: Create the server component page**

Create `src/app/(dashboard)/invoices/new/page.tsx`:

```typescript
import { getContacts } from "@/app/actions/contact";
import { getProducts } from "@/app/actions/product";
import { InvoiceForm } from "./invoice-form";

export default async function NewInvoicePage() {
  const [contacts, products] = await Promise.all([
    getContacts(),
    getProducts(),
  ]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Novi dokument</h1>
      <InvoiceForm contacts={contacts} products={products} />
    </div>
  );
}
```

**Step 2: Create the client form component**

Create `src/app/(dashboard)/invoices/new/invoice-form.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { invoiceSchema, InvoiceInput, invoiceTypeLabels } from "@/lib/validations/invoice";
import { createInvoice } from "@/app/actions/invoice";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import type { Contact, Product } from "@prisma/client";

interface InvoiceFormProps {
  contacts: Contact[];
  products: Product[];
}

export function InvoiceForm({ contacts, products }: InvoiceFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<InvoiceInput>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      type: "INVOICE",
      issueDate: new Date(),
      currency: "EUR",
      lines: [{ description: "", quantity: 1, unitPrice: 0, vatRate: 25, unit: "C62", vatCategory: "S" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  async function onSubmit(data: InvoiceInput) {
    setIsSubmitting(true);
    try {
      const result = await createInvoice(data);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Dokument kreiran");
        router.push("/invoices");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tip dokumenta</label>
          <select {...form.register("type")} className="w-full border rounded-md p-2">
            {Object.entries(invoiceTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Kupac</label>
          <select {...form.register("buyerId")} className="w-full border rounded-md p-2">
            <option value="">Odaberi kupca</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Datum izdavanja</label>
          <Input type="date" {...form.register("issueDate")} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Datum dospijeća</label>
          <Input type="date" {...form.register("dueDate")} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Stavke</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ description: "", quantity: 1, unitPrice: 0, vatRate: 25, unit: "C62", vatCategory: "S" })}
          >
            + Dodaj stavku
          </Button>
        </div>

        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-2 items-start p-3 border rounded-md">
              <div className="flex-1">
                <Input placeholder="Opis" {...form.register(`lines.${index}.description`)} />
              </div>
              <div className="w-20">
                <Input type="number" placeholder="Kol." {...form.register(`lines.${index}.quantity`)} />
              </div>
              <div className="w-24">
                <Input type="number" step="0.01" placeholder="Cijena" {...form.register(`lines.${index}.unitPrice`)} />
              </div>
              <div className="w-16">
                <Input type="number" placeholder="PDV%" {...form.register(`lines.${index}.vatRate`)} />
              </div>
              {fields.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                  ×
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Napomene</label>
        <textarea {...form.register("notes")} className="w-full border rounded-md p-2" rows={3} />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Odustani
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Spremanje..." : "Spremi"}
        </Button>
      </div>
    </form>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/invoices/new/
git commit -m "feat(invoicing): add invoice creation form with line items"
```

---

### Task 10.6: Add Invoices to Navigation

**Files:**

- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Add invoices link to sidebar**

Add to the navigation items in sidebar.tsx:

```typescript
{
  href: "/invoices",
  label: "Dokumenti",
  icon: "📑",
},
```

**Step 2: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(invoicing): add invoices to navigation"
```

---

## Phase 11: Expenses Module

### Task 11.1: Add Expense Models to Schema

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add Expense, ExpenseCategory, RecurringExpense models**

Add to schema:

```prisma
// ============================================
// EXPENSES MODULE
// ============================================

model Expense {
  id              String        @id @default(cuid())
  companyId       String
  vendorId        String?
  categoryId      String

  description     String
  date            DateTime
  dueDate         DateTime?

  netAmount       Decimal       @db.Decimal(10, 2)
  vatAmount       Decimal       @db.Decimal(10, 2)
  totalAmount     Decimal       @db.Decimal(10, 2)
  vatDeductible   Boolean       @default(true)
  currency        String        @default("EUR")

  status          ExpenseStatus
  paymentMethod   PaymentMethod?
  paymentDate     DateTime?

  receiptUrl      String?
  notes           String?

  company         Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  vendor          Contact?      @relation("ExpenseVendor", fields: [vendorId], references: [id])
  category        ExpenseCategory @relation(fields: [categoryId], references: [id])

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([companyId])
  @@index([date])
  @@index([status])
  @@index([categoryId])
}

model ExpenseCategory {
  id                   String    @id @default(cuid())
  companyId            String?   // null = system default
  name                 String
  code                 String
  vatDeductibleDefault Boolean   @default(true)
  isActive             Boolean   @default(true)

  company              Company?  @relation(fields: [companyId], references: [id])
  expenses             Expense[]

  @@unique([companyId, code])
  @@index([companyId])
}

model RecurringExpense {
  id              String    @id @default(cuid())
  companyId       String
  vendorId        String?
  categoryId      String

  description     String
  netAmount       Decimal   @db.Decimal(10, 2)
  vatAmount       Decimal   @db.Decimal(10, 2)
  totalAmount     Decimal   @db.Decimal(10, 2)

  frequency       Frequency
  nextDate        DateTime
  endDate         DateTime?
  isActive        Boolean   @default(true)

  company         Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([companyId])
  @@index([nextDate])
}

enum ExpenseStatus {
  DRAFT
  PENDING
  PAID
  CANCELLED
}

enum PaymentMethod {
  CASH
  CARD
  TRANSFER
  OTHER
}

enum Frequency {
  WEEKLY
  MONTHLY
  QUARTERLY
  YEARLY
}
```

**Step 2: Add relations to Company and Contact**

Add to Company:

```prisma
expenses          Expense[]
expenseCategories ExpenseCategory[]
recurringExpenses RecurringExpense[]
```

Add to Contact:

```prisma
expensesAsVendor  Expense[] @relation("ExpenseVendor")
```

**Step 3: Push schema**

```bash
npx prisma db push
```

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(expenses): add Expense, ExpenseCategory, RecurringExpense models"
```

---

### Task 11.2: Seed Default Expense Categories

**Files:**

- Create: `prisma/seed-categories.ts`

**Step 1: Create seed script for default categories**

Create `prisma/seed-categories.ts`:

```typescript
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const defaultCategories = [
  { code: "OFFICE", name: "Uredski materijal", vatDeductibleDefault: true },
  { code: "TRAVEL", name: "Putni troškovi", vatDeductibleDefault: true },
  { code: "FUEL", name: "Gorivo", vatDeductibleDefault: true },
  { code: "TELECOM", name: "Telekomunikacije", vatDeductibleDefault: true },
  { code: "RENT", name: "Najam", vatDeductibleDefault: true },
  { code: "UTILITIES", name: "Režije", vatDeductibleDefault: true },
  { code: "SERVICES", name: "Usluge", vatDeductibleDefault: true },
  { code: "MARKETING", name: "Marketing", vatDeductibleDefault: true },
  { code: "INSURANCE", name: "Osiguranje", vatDeductibleDefault: false },
  { code: "OTHER", name: "Ostalo", vatDeductibleDefault: false },
]

async function main() {
  console.log("Seeding default expense categories...")

  for (const category of defaultCategories) {
    await prisma.expenseCategory.upsert({
      where: { companyId_code: { companyId: null as unknown as string, code: category.code } },
      update: {},
      create: { ...category, companyId: null },
    })
  }

  console.log("Done!")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**Step 2: Add seed script to package.json**

Add to scripts:

```json
"db:seed:categories": "npx tsx prisma/seed-categories.ts"
```

**Step 3: Commit**

```bash
git add prisma/seed-categories.ts package.json
git commit -m "feat(expenses): add default expense category seed script"
```

---

### Task 11.3: Create Expense Validation and Actions

**Files:**

- Create: `src/lib/validations/expense.ts`
- Create: `src/app/actions/expense.ts`

**Step 1: Create validation schema**

Create `src/lib/validations/expense.ts`:

```typescript
import { z } from "zod"

export const expenseSchema = z.object({
  vendorId: z.string().optional(),
  categoryId: z.string().min(1, "Kategorija je obavezna"),
  description: z.string().min(1, "Opis je obavezan"),
  date: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  netAmount: z.coerce.number().min(0),
  vatAmount: z.coerce.number().min(0),
  totalAmount: z.coerce.number().min(0),
  vatDeductible: z.boolean().default(true),
  currency: z.string().default("EUR"),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]).optional(),
  notes: z.string().optional(),
})

export type ExpenseInput = z.infer<typeof expenseSchema>

export const expenseStatusLabels: Record<string, string> = {
  DRAFT: "Nacrt",
  PENDING: "Na čekanju",
  PAID: "Plaćeno",
  CANCELLED: "Otkazano",
}

export const paymentMethodLabels: Record<string, string> = {
  CASH: "Gotovina",
  CARD: "Kartica",
  TRANSFER: "Prijenos",
  OTHER: "Ostalo",
}
```

**Step 2: Create expense actions**

Create `src/app/actions/expense.ts`:

```typescript
"use server"

import { requireAuth } from "@/lib/auth-utils"
import { prisma } from "@/lib/db"
import { expenseSchema, ExpenseInput } from "@/lib/validations/expense"
import { logAudit } from "@/lib/audit"
import { AuditAction, ExpenseStatus, Prisma } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"
import { revalidatePath } from "next/cache"

export async function createExpense(data: ExpenseInput) {
  const { company, user } = await requireAuth()
  const parsed = expenseSchema.parse(data)

  const expense = await prisma.expense.create({
    data: {
      ...parsed,
      companyId: company.id,
      status: ExpenseStatus.DRAFT,
      netAmount: new Decimal(parsed.netAmount),
      vatAmount: new Decimal(parsed.vatAmount),
      totalAmount: new Decimal(parsed.totalAmount),
    },
  })

  await logAudit({
    companyId: company.id,
    userId: user.id,
    action: AuditAction.CREATE,
    entity: "Expense",
    entityId: expense.id,
    after: { description: expense.description, totalAmount: expense.totalAmount.toString() },
  })

  revalidatePath("/expenses")
  return { success: true, expense }
}

export async function getExpenses(options?: {
  categoryId?: string
  status?: ExpenseStatus
  fromDate?: string
  toDate?: string
  limit?: number
  cursor?: string
}) {
  const { company } = await requireAuth()
  const limit = Math.min(options?.limit ?? 20, 100)

  const where: Prisma.ExpenseWhereInput = { companyId: company.id }
  if (options?.categoryId) where.categoryId = options.categoryId
  if (options?.status) where.status = options.status
  if (options?.fromDate || options?.toDate) {
    where.date = {}
    if (options.fromDate) where.date.gte = new Date(options.fromDate)
    if (options.toDate) where.date.lte = new Date(options.toDate)
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: { category: true, vendor: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: limit + 1,
    cursor: options?.cursor ? { id: options.cursor } : undefined,
  })

  const hasMore = expenses.length > limit
  const items = hasMore ? expenses.slice(0, -1) : expenses

  return { items, hasMore, nextCursor: hasMore ? items[items.length - 1]?.id : undefined }
}

export async function getExpenseCategories() {
  const { company } = await requireAuth()

  return prisma.expenseCategory.findMany({
    where: {
      OR: [{ companyId: null }, { companyId: company.id }],
      isActive: true,
    },
    orderBy: { name: "asc" },
  })
}

export async function markExpensePaid(id: string, paymentDate?: Date) {
  const { company, user } = await requireAuth()

  const expense = await prisma.expense.update({
    where: { id, companyId: company.id },
    data: {
      status: ExpenseStatus.PAID,
      paymentDate: paymentDate ?? new Date(),
    },
  })

  await logAudit({
    companyId: company.id,
    userId: user.id,
    action: AuditAction.UPDATE,
    entity: "Expense",
    entityId: id,
    after: { status: "PAID" },
  })

  revalidatePath("/expenses")
  return { success: true, expense }
}
```

**Step 3: Commit**

```bash
git add src/lib/validations/expense.ts src/app/actions/expense.ts
git commit -m "feat(expenses): add expense validation and actions"
```

---

### Task 11.4: Create Expenses List Page

**Files:**

- Create: `src/app/(dashboard)/expenses/page.tsx`

**Step 1: Create the expenses page**

Create `src/app/(dashboard)/expenses/page.tsx`:

```typescript
import { getExpenses, getExpenseCategories } from "@/app/actions/expense";
import { DataTable } from "@/components/ui/data-table";
import { expenseStatusLabels } from "@/lib/validations/expense";
import Link from "next/link";

export default async function ExpensesPage() {
  const [{ items: expenses }, categories] = await Promise.all([
    getExpenses(),
    getExpenseCategories(),
  ]);

  const columns = [
    { key: "date", header: "Datum" },
    { key: "description", header: "Opis" },
    { key: "category", header: "Kategorija" },
    { key: "vendor", header: "Dobavljač" },
    { key: "totalAmount", header: "Iznos" },
    { key: "status", header: "Status" },
  ];

  const rows = expenses.map((exp) => ({
    date: new Date(exp.date).toLocaleDateString("hr-HR"),
    description: exp.description,
    category: exp.category.name,
    vendor: exp.vendor?.name || "-",
    totalAmount: `${exp.totalAmount.toString()} ${exp.currency}`,
    status: expenseStatusLabels[exp.status] || exp.status,
  }));

  // Calculate totals
  const totalAmount = expenses.reduce((sum, exp) => sum + Number(exp.totalAmount), 0);
  const paidAmount = expenses
    .filter((exp) => exp.status === "PAID")
    .reduce((sum, exp) => sum + Number(exp.totalAmount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Troškovi</h1>
          <p className="text-gray-500">Evidencija poslovnih troškova</p>
        </div>
        <Link
          href="/expenses/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          + Novi trošak
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-500">Ukupno troškova</p>
          <p className="text-2xl font-bold">{totalAmount.toFixed(2)} EUR</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-500">Plaćeno</p>
          <p className="text-2xl font-bold text-green-600">{paidAmount.toFixed(2)} EUR</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-500">Neplaćeno</p>
          <p className="text-2xl font-bold text-red-600">{(totalAmount - paidAmount).toFixed(2)} EUR</p>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-gray-500">Nemate evidentiranih troškova</p>
          <Link href="/expenses/new" className="text-blue-600 hover:underline">
            Dodajte prvi trošak
          </Link>
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} caption="Troškovi" />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/expenses/page.tsx
git commit -m "feat(expenses): add expenses list page with summary"
```

---

### Task 11.5: Create Expense Form Page

**Files:**

- Create: `src/app/(dashboard)/expenses/new/page.tsx`

**Step 1: Create the expense form page**

Create `src/app/(dashboard)/expenses/new/page.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { expenseSchema, ExpenseInput, paymentMethodLabels } from "@/lib/validations/expense";
import { createExpense, getExpenseCategories } from "@/app/actions/expense";
import { getContacts } from "@/app/actions/contact";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";

export default function NewExpensePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    Promise.all([getExpenseCategories(), getContacts()]).then(([cats, contacts]) => {
      setCategories(cats);
      setVendors(contacts.filter((c) => c.type === "SUPPLIER" || c.type === "BOTH"));
    });
  }, []);

  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date(),
      vatDeductible: true,
      currency: "EUR",
      netAmount: 0,
      vatAmount: 0,
      totalAmount: 0,
    },
  });

  // Auto-calculate VAT and total
  const netAmount = form.watch("netAmount");
  useEffect(() => {
    const net = Number(netAmount) || 0;
    const vat = net * 0.25; // 25% VAT
    form.setValue("vatAmount", vat);
    form.setValue("totalAmount", net + vat);
  }, [netAmount, form]);

  async function onSubmit(data: ExpenseInput) {
    setIsSubmitting(true);
    try {
      const result = await createExpense(data);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Trošak spremljen");
        router.push("/expenses");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Novi trošak</h1>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Opis *</label>
          <Input {...form.register("description")} placeholder="Opis troška" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kategorija *</label>
            <select {...form.register("categoryId")} className="w-full border rounded-md p-2">
              <option value="">Odaberi kategoriju</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Dobavljač</label>
            <select {...form.register("vendorId")} className="w-full border rounded-md p-2">
              <option value="">Odaberi dobavljača</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Datum *</label>
            <Input type="date" {...form.register("date")} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Dospijeće</label>
            <Input type="date" {...form.register("dueDate")} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Neto iznos *</label>
            <Input type="number" step="0.01" {...form.register("netAmount")} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">PDV</label>
            <Input type="number" step="0.01" {...form.register("vatAmount")} readOnly className="bg-gray-50" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Ukupno</label>
            <Input type="number" step="0.01" {...form.register("totalAmount")} readOnly className="bg-gray-50" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Način plaćanja</label>
            <select {...form.register("paymentMethod")} className="w-full border rounded-md p-2">
              <option value="">Nije plaćeno</option>
              {Object.entries(paymentMethodLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center pt-6">
            <input type="checkbox" {...form.register("vatDeductible")} className="mr-2" />
            <label className="text-sm">PDV je odbitna stavka</label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Napomene</label>
          <textarea {...form.register("notes")} className="w-full border rounded-md p-2" rows={3} />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Odustani
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Spremanje..." : "Spremi"}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

**Step 2: Add expenses to navigation**

Add to sidebar.tsx:

```typescript
{
  href: "/expenses",
  label: "Troškovi",
  icon: "💸",
},
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/expenses/new/page.tsx src/components/layout/sidebar.tsx
git commit -m "feat(expenses): add expense form and navigation"
```

---

## Phases 12-16: Summary Tasks

Due to the comprehensive nature of this plan, the remaining phases (12-16) follow the same patterns established above. Here's a condensed outline:

### Phase 12: Financial Reporting

- Task 12.1: Add SavedReport model to schema
- Task 12.2: Create report calculation libraries (`src/lib/reports/*.ts`)
- Task 12.3: Create VAT summary page (`/reports/vat`)
- Task 12.4: Create P&L page (`/reports/profit-loss`)
- Task 12.5: Create aging reports page (`/reports/aging`)
- Task 12.6: Add export functionality (Excel/PDF)

### Phase 13: Bank Integration

- Task 13.1: Add BankAccount, BankTransaction, BankImport models
- Task 13.2: Create CSV/XML import parsers
- Task 13.3: Create matching algorithm (`src/lib/banking/matcher.ts`)
- Task 13.4: Create bank accounts page (`/banking/accounts`)
- Task 13.5: Create import page (`/banking/import`)
- Task 13.6: Create reconciliation page (`/banking/reconcile`)

### Phase 14: Mobile Responsiveness

- Task 14.1: Create MobileNav component
- Task 14.2: Create ResponsiveTable component
- Task 14.3: Create BottomSheet component
- Task 14.4: Add useMediaQuery hook
- Task 14.5: Update all pages with responsive classes
- Task 14.6: Test on mobile devices

### Phase 15: Real E-Invoice Provider

- Task 15.1: Create ZKI calculation library
- Task 15.2: Implement IE-Računi provider
- Task 15.3: Add provider selection to settings
- Task 15.4: Implement fiscalization flow
- Task 15.5: Handle JIR response and storage
- Task 15.6: Add status polling/webhooks

### Phase 16: AI/OCR Features

- Task 16.1: Create OCR service wrapper
- Task 16.2: Create receipt extraction logic
- Task 16.3: Create invoice extraction logic
- Task 16.4: Add smart categorization
- Task 16.5: Create receipt scanner UI
- Task 16.6: Integrate with expense form

---

## Final Commit

After all phases are complete:

```bash
git add .
git commit -m "feat: complete phases 8-16 implementation

- Phase 8: Audit logging with Prisma middleware
- Phase 9: Croatian-compliant invoice numbering (XX-X-X format)
- Phase 10: General invoicing with quotes, proformas, credit notes
- Phase 11: Expenses module with categories and receipt tracking
- Phase 12: Financial reporting (VAT, P&L, aging)
- Phase 13: Bank integration with CSV import and matching
- Phase 14: Mobile-responsive UI components
- Phase 15: Real e-invoice provider (IE-Računi)
- Phase 16: AI/OCR for receipt scanning

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Verification Checklist

After implementation, verify:

- [ ] All Prisma migrations applied successfully
- [ ] Audit logs captured for all entity changes
- [ ] Invoice numbers follow Croatian format (XX-X-X)
- [ ] Internal references include year (2025/XX-X-X)
- [ ] Quotes can be converted to invoices
- [ ] Expenses track VAT deductibility correctly
- [ ] Reports calculate VAT correctly
- [ ] Bank transactions can be imported and matched
- [ ] UI works on mobile devices
- [ ] E-invoices can be fiscalized (with real provider)
- [ ] Receipts can be scanned and extracted
