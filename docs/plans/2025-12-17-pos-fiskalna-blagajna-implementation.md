# POS Fiskalna Blagajna - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Point-of-Sale system for Croatian businesses to process in-person card/cash payments and issue fiscalized A4 invoices.

**Architecture:** Next.js server actions handle payment processing and invoice creation. Stripe Terminal SDK manages physical card readers. Existing fiscalization infrastructure (ZKI, FINA pipeline) reused with POS-specific wrapper. A4 PDF receipts via existing template.

**Tech Stack:** Next.js 15, Prisma, Stripe Terminal, @react-pdf/renderer, bwip-js (HUB-3), existing fiscalization libs

---

## Phase 1: Core Infrastructure

### Task 1.1: Database Schema - Add Stripe Terminal Fields

**Files:**

- Modify: `prisma/schema.prisma:68-130` (Company model)
- Run: Prisma migration

**Step 1: Add Terminal fields to Company model**

In `prisma/schema.prisma`, add after line 91 (deviceCode field):

```prisma
  // Stripe Terminal fields for POS
  stripeTerminalLocationId  String?   // Stripe location for reader
  stripeTerminalReaderId    String?   // Connected reader ID
```

**Step 2: Generate and run migration**

Run: `npx prisma migrate dev --name add_stripe_terminal_fields`
Expected: Migration created successfully

**Step 3: Verify schema**

Run: `npx prisma generate`
Expected: Prisma Client generated

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(pos): add Stripe Terminal fields to Company schema"
```

---

### Task 1.2: Create POS Sale Input Types

**Files:**

- Create: `src/types/pos.ts`

**Step 1: Create the types file**

```typescript
// src/types/pos.ts
import { PaymentMethod } from "@prisma/client"

export interface PosLineItem {
  productId?: string // From product grid (optional)
  description: string // Required for all items
  quantity: number
  unitPrice: number // In EUR (not cents)
  vatRate: number // 25, 13, 5, or 0
}

export interface ProcessPosSaleInput {
  items: PosLineItem[]
  paymentMethod: "CASH" | "CARD"
  stripePaymentIntentId?: string // Required if CARD
  buyerId?: string // Optional - anonymous sale OK
}

export interface ProcessPosSaleResult {
  success: boolean
  invoice?: {
    id: string
    invoiceNumber: string
    totalAmount: number
  }
  jir?: string
  zki?: string
  pdfUrl?: string
  error?: string
}
```

**Step 2: Commit**

```bash
git add src/types/pos.ts
git commit -m "feat(pos): add POS sale input types"
```

---

### Task 1.3: Create processPosSale Server Action - Test First

**Files:**

- Create: `src/app/actions/__tests__/pos.test.ts`
- Create: `src/app/actions/pos.ts`

**Step 1: Write the failing test**

```typescript
// src/app/actions/__tests__/pos.test.ts
import { describe, it, beforeEach, mock } from "node:test"
import assert from "node:assert"

// Mock the dependencies
mock.module("@/lib/db", () => ({
  db: {
    eInvoice: {
      create: mock.fn(),
    },
    company: {
      findFirst: mock.fn(),
    },
    businessPremises: {
      findFirst: mock.fn(),
    },
    paymentDevice: {
      findFirst: mock.fn(),
    },
  },
}))

mock.module("@/lib/auth-utils", () => ({
  requireAuth: mock.fn(() => Promise.resolve({ id: "user-1" })),
  requireCompanyWithContext: mock.fn((userId, callback) =>
    callback({
      id: "company-1",
      oib: "12345678901",
      name: "Test Company",
      premisesCode: "1",
      deviceCode: "1",
    })
  ),
}))

describe("processPosSale", () => {
  it("should validate that items array is not empty", async () => {
    const { processPosSale } = await import("../pos")

    const result = await processPosSale({
      items: [],
      paymentMethod: "CASH",
    })

    assert.strictEqual(result.success, false)
    assert.ok(result.error?.includes("stavk"))
  })

  it("should require stripePaymentIntentId for CARD payments", async () => {
    const { processPosSale } = await import("../pos")

    const result = await processPosSale({
      items: [{ description: "Test", quantity: 1, unitPrice: 10, vatRate: 25 }],
      paymentMethod: "CARD",
      // Missing stripePaymentIntentId
    })

    assert.strictEqual(result.success, false)
    assert.ok(result.error?.includes("payment"))
  })
})
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/app/actions/__tests__/pos.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

```typescript
// src/app/actions/pos.ts
"use server"

import { db } from "@/lib/db"
import { requireAuth, requireCompanyWithContext } from "@/lib/auth-utils"
import { getNextInvoiceNumber } from "@/lib/invoice-numbering"
import { canCreateInvoice } from "@/lib/billing/stripe"
import { Prisma, PaymentMethod } from "@prisma/client"
import { revalidatePath } from "next/cache"
import type { ProcessPosSaleInput, ProcessPosSaleResult } from "@/types/pos"

const Decimal = Prisma.Decimal

export async function processPosSale(input: ProcessPosSaleInput): Promise<ProcessPosSaleResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      // Validation
      if (!input.items || input.items.length === 0) {
        return { success: false, error: "Račun mora imati barem jednu stavku" }
      }

      if (input.paymentMethod === "CARD" && !input.stripePaymentIntentId) {
        return { success: false, error: "Payment Intent ID je obavezan za kartično plaćanje" }
      }

      // Check invoice limit
      const canCreate = await canCreateInvoice(company.id)
      if (!canCreate) {
        return { success: false, error: "Dostigli ste mjesečni limit računa" }
      }

      // Get business premises and device
      const premises = await db.businessPremises.findFirst({
        where: { companyId: company.id, isDefault: true, isActive: true },
      })
      if (!premises) {
        return { success: false, error: "Nije konfiguriran poslovni prostor" }
      }

      const device = await db.paymentDevice.findFirst({
        where: { businessPremisesId: premises.id, isDefault: true, isActive: true },
      })
      if (!device) {
        return { success: false, error: "Nije konfiguriran naplatni uređaj" }
      }

      // Generate invoice number
      const numbering = await getNextInvoiceNumber(company.id)

      // Calculate line items
      const lineItems = input.items.map((item, index) => {
        const quantity = new Decimal(item.quantity)
        const unitPrice = new Decimal(item.unitPrice)
        const vatRate = new Decimal(item.vatRate)
        const netAmount = quantity.mul(unitPrice)
        const vatAmount = netAmount.mul(vatRate).div(100)

        return {
          lineNumber: index + 1,
          description: item.description,
          quantity,
          unit: "C62", // Piece
          unitPrice,
          netAmount,
          vatRate,
          vatCategory: "S",
          vatAmount,
        }
      })

      // Calculate totals
      const netAmount = lineItems.reduce((sum, l) => sum.add(l.netAmount), new Decimal(0))
      const vatAmount = lineItems.reduce((sum, l) => sum.add(l.vatAmount), new Decimal(0))
      const totalAmount = netAmount.add(vatAmount)

      // Create invoice
      const invoice = await db.eInvoice.create({
        data: {
          companyId: company.id,
          type: "INVOICE",
          direction: "OUTBOUND",
          invoiceNumber: numbering.invoiceNumber,
          internalReference: numbering.internalReference,
          buyerId: input.buyerId || null,
          issueDate: new Date(),
          currency: "EUR",
          netAmount,
          vatAmount,
          totalAmount,
          status: "PENDING_FISCALIZATION",
          paymentMethod: input.paymentMethod as PaymentMethod,
          lines: { create: lineItems },
        },
        include: { lines: true },
      })

      // TODO: Fiscalize in Task 1.5
      // TODO: Generate PDF URL

      revalidatePath("/invoices")
      revalidatePath("/pos")

      return {
        success: true,
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: Number(invoice.totalAmount),
        },
        pdfUrl: `/api/invoices/${invoice.id}/pdf`,
      }
    })
  } catch (error) {
    console.error("POS sale error:", error)
    return { success: false, error: "Greška pri obradi prodaje" }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/app/actions/__tests__/pos.test.ts`
Expected: Tests pass

**Step 5: Commit**

```bash
git add src/app/actions/pos.ts src/app/actions/__tests__/pos.test.ts
git commit -m "feat(pos): add processPosSale server action with validation"
```

---

### Task 1.4: Create fiscalizePosSale Function

**Files:**

- Create: `src/lib/fiscal/pos-fiscalize.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/fiscal/__tests__/pos-fiscalize.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import { fiscalizePosSale, type PosFiscalInput } from "../pos-fiscalize"

describe("fiscalizePosSale", () => {
  const validInput: PosFiscalInput = {
    invoice: {
      id: "inv-1",
      invoiceNumber: "2025-1-1-00001",
      issueDate: new Date("2025-01-15T14:30:00"),
      totalAmount: 125.0,
      paymentMethod: "CASH",
    },
    company: {
      id: "company-1",
      oib: "12345678901",
      fiscalEnabled: false, // Test mode
      premisesCode: "1",
      deviceCode: "1",
    },
  }

  it("should return demo JIR when fiscalization disabled", async () => {
    const result = await fiscalizePosSale(validInput)

    assert.strictEqual(result.success, true)
    assert.ok(result.zki, "ZKI should be defined")
    assert.ok(result.jir?.startsWith("DEMO-"), "JIR should be demo")
  })

  it("should calculate valid ZKI", async () => {
    const result = await fiscalizePosSale(validInput)

    assert.ok(result.zki, "ZKI should be defined")
    assert.strictEqual(result.zki.length, 32, "ZKI should be 32 chars")
    assert.ok(/^[a-f0-9]{32}$/.test(result.zki), "ZKI should be hex")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/fiscal/__tests__/pos-fiscalize.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

```typescript
// src/lib/fiscal/pos-fiscalize.ts
import { calculateZKI, validateZKIInput } from "@/lib/e-invoice/zki"
import { db } from "@/lib/db"

export interface PosFiscalInput {
  invoice: {
    id: string
    invoiceNumber: string
    issueDate: Date
    totalAmount: number
    paymentMethod: "CASH" | "CARD"
  }
  company: {
    id: string
    oib: string
    fiscalEnabled: boolean
    premisesCode: string
    deviceCode: string
  }
}

export interface PosFiscalResult {
  success: boolean
  jir?: string
  zki: string
  error?: string
}

export async function fiscalizePosSale(input: PosFiscalInput): Promise<PosFiscalResult> {
  const { invoice, company } = input

  // Calculate ZKI (always required)
  const totalInCents = Math.round(invoice.totalAmount * 100)

  const zkiInput = {
    oib: company.oib,
    dateTime: invoice.issueDate,
    invoiceNumber: invoice.invoiceNumber,
    premisesCode: company.premisesCode,
    deviceCode: company.deviceCode,
    totalAmount: totalInCents,
  }

  const validation = validateZKIInput(zkiInput)
  if (!validation.valid) {
    return {
      success: false,
      zki: "",
      error: `Nevažeći podaci: ${validation.errors.join(", ")}`,
    }
  }

  const zki = calculateZKI(zkiInput)

  // Check if real fiscalization is enabled
  if (!company.fiscalEnabled) {
    // Demo mode - return mock JIR
    return {
      success: true,
      jir: `DEMO-${Date.now()}`,
      zki,
    }
  }

  // Real fiscalization - check for active certificate
  const certificate = await db.fiscalCertificate.findFirst({
    where: {
      companyId: company.id,
      status: "ACTIVE",
    },
  })

  if (!certificate) {
    // No certificate - queue for retry, but return success with ZKI only
    await queueFiscalRetry(invoice.id)
    return {
      success: true,
      zki,
      error: "Fiskalizacija u čekanju - nema aktivnog certifikata",
    }
  }

  // TODO: Call real FINA API via existing fiscal-pipeline.ts
  // For now, return demo response
  return {
    success: true,
    jir: `DEMO-${Date.now()}`,
    zki,
  }
}

async function queueFiscalRetry(invoiceId: string): Promise<void> {
  // Update invoice to mark it needs fiscalization retry
  await db.eInvoice.update({
    where: { id: invoiceId },
    data: {
      fiscalStatus: "PENDING",
    },
  })
}
```

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/lib/fiscal/__tests__/pos-fiscalize.test.ts`
Expected: Tests pass

**Step 5: Commit**

```bash
git add src/lib/fiscal/pos-fiscalize.ts src/lib/fiscal/__tests__/pos-fiscalize.test.ts
git commit -m "feat(pos): add fiscalizePosSale with ZKI calculation and demo mode"
```

---

### Task 1.5: Integrate Fiscalization into processPosSale

**Files:**

- Modify: `src/app/actions/pos.ts`

**Step 1: Import fiscalization**

Add import at top of `src/app/actions/pos.ts`:

```typescript
import { fiscalizePosSale } from "@/lib/fiscal/pos-fiscalize"
```

**Step 2: Add fiscalization after invoice creation**

After the `db.eInvoice.create()` call, add:

```typescript
// Fiscalize the invoice
const fiscalResult = await fiscalizePosSale({
  invoice: {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    totalAmount: Number(invoice.totalAmount),
    paymentMethod: input.paymentMethod,
  },
  company: {
    id: company.id,
    oib: company.oib,
    fiscalEnabled: company.fiscalEnabled,
    premisesCode: premises.code.toString(),
    deviceCode: device.code.toString(),
  },
})

// Update invoice with fiscal data
if (fiscalResult.success) {
  await db.eInvoice.update({
    where: { id: invoice.id },
    data: {
      zki: fiscalResult.zki,
      jir: fiscalResult.jir,
      fiscalizedAt: fiscalResult.jir ? new Date() : null,
      status: fiscalResult.jir ? "FISCALIZED" : "PENDING_FISCALIZATION",
    },
  })
}
```

**Step 3: Update return value**

Update the return statement:

```typescript
return {
  success: true,
  invoice: {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    totalAmount: Number(invoice.totalAmount),
  },
  jir: fiscalResult.jir,
  zki: fiscalResult.zki,
  pdfUrl: `/api/invoices/${invoice.id}/pdf`,
}
```

**Step 4: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/app/actions/pos.ts
git commit -m "feat(pos): integrate fiscalization into processPosSale"
```

---

### Task 1.6: Create HUB-3 Payment QR for POS Receipts

**Files:**

- Modify: `src/lib/knowledge-hub/hub3.ts` (add helper)
- Create: `src/lib/pos/payment-qr.ts`

**Step 1: Create POS payment QR generator**

```typescript
// src/lib/pos/payment-qr.ts
import { generateHub3DataUrl, type Hub3Data } from "@/lib/knowledge-hub/hub3"

export interface PosPaymentQRInput {
  sellerName: string
  sellerAddress: string
  sellerCity: string
  sellerIban: string
  invoiceNumber: string
  amount: number
  buyerName?: string
  buyerAddress?: string
  buyerCity?: string
}

/**
 * Generate HUB-3 payment QR code for POS receipt
 * Croatian bank apps can scan this to initiate payment
 */
export async function generatePosPaymentQR(input: PosPaymentQRInput): Promise<string> {
  const hub3Data: Hub3Data = {
    amount: input.amount,
    payerName: input.buyerName || "Kupac",
    payerAddress: input.buyerAddress || "",
    payerCity: input.buyerCity || "",
    recipientName: input.sellerName.slice(0, 25),
    recipientAddress: input.sellerAddress.slice(0, 25),
    recipientCity: input.sellerCity.slice(0, 27),
    recipientIBAN: input.sellerIban.replace(/\s+/g, ""),
    model: "HR00",
    reference: input.invoiceNumber.replace(/[^0-9-]/g, "").slice(0, 22),
    description: `Račun ${input.invoiceNumber}`.slice(0, 35),
    currency: "EUR",
  }

  return generateHub3DataUrl(hub3Data)
}
```

**Step 2: Commit**

```bash
git add src/lib/pos/payment-qr.ts
git commit -m "feat(pos): add HUB-3 payment QR code generator for receipts"
```

---

## Phase 2: Stripe Terminal Integration

### Task 2.1: Create Stripe Terminal Helper Functions

**Files:**

- Create: `src/lib/stripe/terminal.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/stripe/__tests__/terminal.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import { validateTerminalReaderId, formatAmountForStripe } from "../terminal"

describe("Stripe Terminal Helpers", () => {
  describe("formatAmountForStripe", () => {
    it("should convert EUR to cents", () => {
      assert.strictEqual(formatAmountForStripe(10.0), 1000)
      assert.strictEqual(formatAmountForStripe(125.5), 12550)
      assert.strictEqual(formatAmountForStripe(0.01), 1)
    })

    it("should round to nearest cent", () => {
      assert.strictEqual(formatAmountForStripe(10.999), 1100)
      assert.strictEqual(formatAmountForStripe(10.001), 1000)
    })
  })

  describe("validateTerminalReaderId", () => {
    it("should accept valid reader IDs", () => {
      assert.strictEqual(validateTerminalReaderId("tmr_FooBar123"), true)
    })

    it("should reject invalid reader IDs", () => {
      assert.strictEqual(validateTerminalReaderId("invalid"), false)
      assert.strictEqual(validateTerminalReaderId(""), false)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/stripe/__tests__/terminal.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/lib/stripe/terminal.ts
import Stripe from "stripe"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

let stripeInstance: Stripe | null = null

function getStripe(): Stripe {
  if (!stripeInstance) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured")
    }
    stripeInstance = new Stripe(apiKey, {
      apiVersion: "2025-11-17.clover",
      typescript: true,
    })
  }
  return stripeInstance
}

/**
 * Convert EUR amount to cents for Stripe
 */
export function formatAmountForStripe(amount: number): number {
  return Math.round(amount * 100)
}

/**
 * Validate Stripe Terminal reader ID format
 */
export function validateTerminalReaderId(readerId: string): boolean {
  return /^tmr_[a-zA-Z0-9]+$/.test(readerId)
}

/**
 * Create connection token for Terminal SDK
 * Called by frontend to authenticate with Stripe Terminal
 */
export async function createConnectionToken(companyId: string): Promise<string> {
  const stripe = getStripe()

  const company = await db.company.findUniqueOrThrow({
    where: { id: companyId },
  })

  if (!company.stripeTerminalLocationId) {
    throw new Error("Terminal location not configured")
  }

  const token = await stripe.terminal.connectionTokens.create({
    location: company.stripeTerminalLocationId,
  })

  return token.secret
}

/**
 * Create a PaymentIntent for Terminal payment
 */
export async function createTerminalPaymentIntent(input: {
  amount: number // In EUR
  companyId: string
  invoiceRef?: string
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = getStripe()

  const company = await db.company.findUniqueOrThrow({
    where: { id: input.companyId },
  })

  const paymentIntent = await stripe.paymentIntents.create({
    amount: formatAmountForStripe(input.amount),
    currency: "eur",
    payment_method_types: ["card_present"],
    capture_method: "automatic",
    metadata: {
      companyId: input.companyId,
      invoiceRef: input.invoiceRef || "",
    },
  })

  logger.info(
    { companyId: input.companyId, amount: input.amount, paymentIntentId: paymentIntent.id },
    "Terminal payment intent created"
  )

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  }
}

/**
 * Process payment on a specific reader
 */
export async function processPaymentOnReader(input: {
  readerId: string
  paymentIntentId: string
}): Promise<{ success: boolean; error?: string }> {
  const stripe = getStripe()

  try {
    const reader = await stripe.terminal.readers.processPaymentIntent(input.readerId, {
      payment_intent: input.paymentIntentId,
    })

    if (reader.action?.status === "failed") {
      return {
        success: false,
        error: reader.action.failure_message || "Payment failed",
      }
    }

    return { success: true }
  } catch (error) {
    logger.error({ error, readerId: input.readerId }, "Terminal payment failed")
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Cancel a payment on reader
 */
export async function cancelReaderPayment(readerId: string): Promise<void> {
  const stripe = getStripe()
  await stripe.terminal.readers.cancelAction(readerId)
}

/**
 * Get reader status
 */
export async function getReaderStatus(readerId: string): Promise<{
  online: boolean
  label: string
  status: string
}> {
  const stripe = getStripe()

  try {
    const reader = await stripe.terminal.readers.retrieve(readerId)
    return {
      online: reader.status === "online",
      label: reader.label || readerId,
      status: reader.status || "unknown",
    }
  } catch {
    return {
      online: false,
      label: readerId,
      status: "error",
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/lib/stripe/__tests__/terminal.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/stripe/terminal.ts src/lib/stripe/__tests__/terminal.test.ts
git commit -m "feat(pos): add Stripe Terminal helper functions"
```

---

### Task 2.2: Create Terminal API Routes

**Files:**

- Create: `src/app/api/terminal/connection-token/route.ts`
- Create: `src/app/api/terminal/payment-intent/route.ts`
- Create: `src/app/api/terminal/reader-status/route.ts`

**Step 1: Create connection token endpoint**

```typescript
// src/app/api/terminal/connection-token/route.ts
import { NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { createConnectionToken } from "@/lib/stripe/terminal"

export async function POST() {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const secret = await createConnectionToken(company.id)

    return NextResponse.json({ secret })
  } catch (error) {
    console.error("Connection token error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create token" },
      { status: 500 }
    )
  }
}
```

**Step 2: Create payment intent endpoint**

```typescript
// src/app/api/terminal/payment-intent/route.ts
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { createTerminalPaymentIntent, processPaymentOnReader } from "@/lib/stripe/terminal"
import { z } from "zod"

const createSchema = z.object({
  amount: z.number().positive(),
  invoiceRef: z.string().optional(),
})

const processSchema = z.object({
  readerId: z.string().startsWith("tmr_"),
  paymentIntentId: z.string().startsWith("pi_"),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)
    const body = await request.json()

    const input = createSchema.parse(body)

    const result = await createTerminalPaymentIntent({
      amount: input.amount,
      companyId: company.id,
      invoiceRef: input.invoiceRef,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Payment intent error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create payment" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()

    const input = processSchema.parse(body)

    const result = await processPaymentOnReader({
      readerId: input.readerId,
      paymentIntentId: input.paymentIntentId,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Process payment error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process payment" },
      { status: 500 }
    )
  }
}
```

**Step 3: Create reader status endpoint**

```typescript
// src/app/api/terminal/reader-status/route.ts
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { getReaderStatus } from "@/lib/stripe/terminal"

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    if (!company.stripeTerminalReaderId) {
      return NextResponse.json({ online: false, status: "not_configured" })
    }

    const status = await getReaderStatus(company.stripeTerminalReaderId)

    return NextResponse.json(status)
  } catch (error) {
    console.error("Reader status error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get status" },
      { status: 500 }
    )
  }
}
```

**Step 4: Commit**

```bash
git add src/app/api/terminal/
git commit -m "feat(pos): add Terminal API routes for connection, payment, and status"
```

---

### Task 2.3: Add Terminal Settings to Company Settings Page

**Files:**

- Modify: `src/app/(dashboard)/settings/page.tsx`
- Create: `src/app/(dashboard)/settings/terminal/page.tsx`
- Create: `src/app/actions/terminal.ts`

**Step 1: Create terminal settings action**

```typescript
// src/app/actions/terminal.ts
"use server"

import { db } from "@/lib/db"
import { requireAuth, requireCompanyWithContext } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const updateSchema = z.object({
  stripeTerminalLocationId: z.string().optional().nullable(),
  stripeTerminalReaderId: z.string().startsWith("tmr_").optional().nullable(),
})

export async function updateTerminalSettings(input: z.infer<typeof updateSchema>) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async (company) => {
    const validated = updateSchema.parse(input)

    await db.company.update({
      where: { id: company.id },
      data: {
        stripeTerminalLocationId: validated.stripeTerminalLocationId,
        stripeTerminalReaderId: validated.stripeTerminalReaderId,
      },
    })

    revalidatePath("/settings")
    revalidatePath("/settings/terminal")
    revalidatePath("/pos")

    return { success: true }
  })
}

export async function getTerminalSettings() {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async (company) => {
    return {
      stripeTerminalLocationId: company.stripeTerminalLocationId,
      stripeTerminalReaderId: company.stripeTerminalReaderId,
    }
  })
}
```

**Step 2: Create terminal settings page**

```typescript
// src/app/(dashboard)/settings/terminal/page.tsx
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TerminalSettingsForm } from "./terminal-settings-form"

export default async function TerminalSettingsPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stripe Terminal</h1>
        <p className="text-gray-500">Konfiguracija fizičkog čitača kartica za POS</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Terminal postavke</CardTitle>
        </CardHeader>
        <CardContent>
          <TerminalSettingsForm
            initialData={{
              locationId: company.stripeTerminalLocationId || "",
              readerId: company.stripeTerminalReaderId || "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 3: Create terminal settings form**

```typescript
// src/app/(dashboard)/settings/terminal/terminal-settings-form.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateTerminalSettings } from "@/app/actions/terminal"
import { toast } from "sonner"

interface Props {
  initialData: {
    locationId: string
    readerId: string
  }
}

export function TerminalSettingsForm({ initialData }: Props) {
  const [locationId, setLocationId] = useState(initialData.locationId)
  const [readerId, setReaderId] = useState(initialData.readerId)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const result = await updateTerminalSettings({
        stripeTerminalLocationId: locationId || null,
        stripeTerminalReaderId: readerId || null,
      })

      if (result.success) {
        toast.success("Postavke spremljene")
      }
    } catch (error) {
      toast.error("Greška pri spremanju")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Terminal Location ID
        </label>
        <Input
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          placeholder="tml_..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Pronađite u Stripe Dashboard → Terminal → Locations
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Reader ID
        </label>
        <Input
          value={readerId}
          onChange={(e) => setReaderId(e.target.value)}
          placeholder="tmr_..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Pronađite u Stripe Dashboard → Terminal → Readers
        </p>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Spremanje..." : "Spremi"}
      </Button>
    </form>
  )
}
```

**Step 4: Commit**

```bash
git add src/app/actions/terminal.ts src/app/(dashboard)/settings/terminal/
git commit -m "feat(pos): add Terminal settings page and actions"
```

---

## Phase 3: UI Components

### Task 3.1: Create POS Page Layout

**Files:**

- Create: `src/app/(dashboard)/pos/layout.tsx`
- Create: `src/app/(dashboard)/pos/page.tsx`

**Step 1: Create POS layout (full-width, no sidebar)**

```typescript
// src/app/(dashboard)/pos/layout.tsx
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      {children}
    </div>
  )
}
```

**Step 2: Create POS page shell**

```typescript
// src/app/(dashboard)/pos/page.tsx
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { PosClient } from "./pos-client"

export default async function PosPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({ companyId: company.id, userId: user.id! })

  // Fetch products for the product grid
  const products = await db.product.findMany({
    where: { companyId: company.id, isActive: true },
    orderBy: { name: "asc" },
  })

  return (
    <PosClient
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        vatRate: Number(p.vatRate),
        sku: p.sku,
      }))}
      companyIban={company.iban}
      terminalReaderId={company.stripeTerminalReaderId}
    />
  )
}
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/pos/
git commit -m "feat(pos): add POS page layout and server component"
```

---

### Task 3.2: Create POS Client Component Shell

**Files:**

- Create: `src/app/(dashboard)/pos/pos-client.tsx`
- Create: `src/app/(dashboard)/pos/types.ts`

**Step 1: Create POS types**

```typescript
// src/app/(dashboard)/pos/types.ts
export interface PosProduct {
  id: string
  name: string
  price: number
  vatRate: number
  sku?: string | null
}

export interface CartItem {
  id: string // Unique cart item ID
  productId?: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
}

export interface CartState {
  items: CartItem[]
  addItem: (item: Omit<CartItem, "id">) => void
  updateQuantity: (id: string, quantity: number) => void
  removeItem: (id: string) => void
  clear: () => void
}
```

**Step 2: Create main POS client component**

```typescript
// src/app/(dashboard)/pos/pos-client.tsx
"use client"

import { useState, useCallback } from "react"
import { ProductGrid } from "./components/product-grid"
import { Cart } from "./components/cart"
import { PaymentBar } from "./components/payment-bar"
import { CashModal } from "./components/cash-modal"
import { CardPaymentModal } from "./components/card-payment-modal"
import { ReceiptModal } from "./components/receipt-modal"
import type { PosProduct, CartItem } from "./types"
import type { ProcessPosSaleResult } from "@/types/pos"

interface Props {
  products: PosProduct[]
  companyIban?: string | null
  terminalReaderId?: string | null
}

export function PosClient({ products, companyIban, terminalReaderId }: Props) {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [showCashModal, setShowCashModal] = useState(false)
  const [showCardModal, setShowCardModal] = useState(false)
  const [saleResult, setSaleResult] = useState<ProcessPosSaleResult | null>(null)

  const addToCart = useCallback((product: PosProduct) => {
    setCartItems((items) => {
      const existing = items.find((i) => i.productId === product.id)
      if (existing) {
        return items.map((i) =>
          i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...items,
        {
          id: crypto.randomUUID(),
          productId: product.id,
          description: product.name,
          quantity: 1,
          unitPrice: product.price,
          vatRate: product.vatRate,
        },
      ]
    })
  }, [])

  const addCustomItem = useCallback(
    (item: { description: string; unitPrice: number; vatRate: number }) => {
      setCartItems((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          description: item.description,
          quantity: 1,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
        },
      ])
    },
    []
  )

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setCartItems((items) => items.filter((i) => i.id !== id))
    } else {
      setCartItems((items) =>
        items.map((i) => (i.id === id ? { ...i, quantity } : i))
      )
    }
  }, [])

  const removeItem = useCallback((id: string) => {
    setCartItems((items) => items.filter((i) => i.id !== id))
  }, [])

  const clearCart = useCallback(() => {
    setCartItems([])
  }, [])

  const total = cartItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity * (1 + item.vatRate / 100),
    0
  )

  const handleSaleComplete = (result: ProcessPosSaleResult) => {
    setSaleResult(result)
    setShowCashModal(false)
    setShowCardModal(false)
  }

  const handleNewSale = () => {
    clearCart()
    setSaleResult(null)
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Blagajna</h1>
        <div className="flex items-center gap-2">
          {terminalReaderId ? (
            <span className="text-xs text-green-600">● Terminal povezan</span>
          ) : (
            <span className="text-xs text-gray-400">● Nema terminala</span>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Product Grid */}
        <div className="flex-1 overflow-auto p-4">
          <ProductGrid
            products={products}
            onProductClick={addToCart}
            onCustomItem={addCustomItem}
          />
        </div>

        {/* Cart */}
        <div className="w-96 bg-white border-l flex flex-col">
          <Cart
            items={cartItems}
            onUpdateQuantity={updateQuantity}
            onRemove={removeItem}
          />
        </div>
      </div>

      {/* Payment Bar */}
      <PaymentBar
        total={total}
        disabled={cartItems.length === 0}
        hasTerminal={!!terminalReaderId}
        onCash={() => setShowCashModal(true)}
        onCard={() => setShowCardModal(true)}
        onClear={clearCart}
      />

      {/* Modals */}
      {showCashModal && (
        <CashModal
          items={cartItems}
          total={total}
          onClose={() => setShowCashModal(false)}
          onComplete={handleSaleComplete}
        />
      )}

      {showCardModal && terminalReaderId && (
        <CardPaymentModal
          items={cartItems}
          total={total}
          readerId={terminalReaderId}
          onClose={() => setShowCardModal(false)}
          onComplete={handleSaleComplete}
        />
      )}

      {saleResult && (
        <ReceiptModal
          result={saleResult}
          onNewSale={handleNewSale}
          onClose={() => setSaleResult(null)}
        />
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/pos/pos-client.tsx src/app/(dashboard)/pos/types.ts
git commit -m "feat(pos): add POS client component with cart state management"
```

---

### Task 3.3: Create ProductGrid Component

**Files:**

- Create: `src/app/(dashboard)/pos/components/product-grid.tsx`
- Create: `src/app/(dashboard)/pos/components/custom-item-modal.tsx`

**Step 1: Create ProductGrid**

```typescript
// src/app/(dashboard)/pos/components/product-grid.tsx
"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CustomItemModal } from "./custom-item-modal"
import type { PosProduct } from "../types"

interface Props {
  products: PosProduct[]
  onProductClick: (product: PosProduct) => void
  onCustomItem: (item: { description: string; unitPrice: number; vatRate: number }) => void
}

export function ProductGrid({ products, onProductClick, onCustomItem }: Props) {
  const [search, setSearch] = useState("")
  const [showCustomModal, setShowCustomModal] = useState(false)

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
    )
  }, [products, search])

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: "EUR",
    }).format(price)

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <Input
          type="search"
          placeholder="Pretraži proizvode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Button variant="outline" onClick={() => setShowCustomModal(true)}>
          + Prilagođena stavka
        </Button>
      </div>

      {/* Product Grid */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          {search ? "Nema rezultata" : "Nema proizvoda"}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((product) => (
            <button
              key={product.id}
              onClick={() => onProductClick(product)}
              className="p-4 bg-white rounded-lg border hover:border-blue-500 hover:shadow-md transition-all text-left"
            >
              <div className="font-medium truncate">{product.name}</div>
              {product.sku && (
                <div className="text-xs text-gray-400">{product.sku}</div>
              )}
              <div className="mt-2 text-lg font-bold text-blue-600">
                {formatPrice(product.price)}
              </div>
              <div className="text-xs text-gray-500">
                PDV {product.vatRate}%
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Custom Item Modal */}
      {showCustomModal && (
        <CustomItemModal
          onClose={() => setShowCustomModal(false)}
          onAdd={(item) => {
            onCustomItem(item)
            setShowCustomModal(false)
          }}
        />
      )}
    </div>
  )
}
```

**Step 2: Create CustomItemModal**

```typescript
// src/app/(dashboard)/pos/components/custom-item-modal.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"

interface Props {
  onClose: () => void
  onAdd: (item: { description: string; unitPrice: number; vatRate: number }) => void
}

const VAT_RATES = [
  { value: 25, label: "25% (standard)" },
  { value: 13, label: "13% (sniženi)" },
  { value: 5, label: "5% (sniženi)" },
  { value: 0, label: "0% (oslobođeno)" },
]

export function CustomItemModal({ onClose, onAdd }: Props) {
  const [description, setDescription] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [vatRate, setVatRate] = useState(25)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const price = parseFloat(unitPrice)
    if (!description.trim() || isNaN(price) || price <= 0) return

    onAdd({
      description: description.trim(),
      unitPrice: price,
      vatRate,
    })
  }

  return (
    <Modal title="Prilagođena stavka" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Opis</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Npr. Konzultacije"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Cijena (EUR)</label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">PDV stopa</label>
          <select
            value={vatRate}
            onChange={(e) => setVatRate(Number(e.target.value))}
            className="w-full border rounded-md px-3 py-2"
          >
            {VAT_RATES.map((rate) => (
              <option key={rate.value} value={rate.value}>
                {rate.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Odustani
          </Button>
          <Button type="submit" disabled={!description.trim() || !unitPrice}>
            Dodaj
          </Button>
        </div>
      </form>
    </Modal>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/pos/components/product-grid.tsx src/app/(dashboard)/pos/components/custom-item-modal.tsx
git commit -m "feat(pos): add ProductGrid and CustomItemModal components"
```

---

### Task 3.4: Create Cart Component

**Files:**

- Create: `src/app/(dashboard)/pos/components/cart.tsx`

**Step 1: Create Cart component**

```typescript
// src/app/(dashboard)/pos/components/cart.tsx
"use client"

import { Button } from "@/components/ui/button"
import type { CartItem } from "../types"

interface Props {
  items: CartItem[]
  onUpdateQuantity: (id: string, quantity: number) => void
  onRemove: (id: string) => void
}

export function Cart({ items, onUpdateQuantity, onRemove }: Props) {
  const formatPrice = (price: number) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: "EUR",
    }).format(price)

  // Calculate totals
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  )

  // Group VAT by rate
  const vatByRate = items.reduce(
    (acc, item) => {
      const net = item.unitPrice * item.quantity
      const vat = net * (item.vatRate / 100)
      acc[item.vatRate] = (acc[item.vatRate] || 0) + vat
      return acc
    },
    {} as Record<number, number>
  )

  const totalVat = Object.values(vatByRate).reduce((sum, v) => sum + v, 0)
  const total = subtotal + totalVat

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="font-bold">Košarica</h2>
        <p className="text-sm text-gray-500">{items.length} stavki</p>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Košarica je prazna</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.description}</p>
                  <p className="text-sm text-gray-500">
                    {formatPrice(item.unitPrice)} × {item.quantity}
                  </p>
                </div>
                <p className="font-bold">
                  {formatPrice(item.unitPrice * item.quantity)}
                </p>
              </div>

              {/* Quantity controls */}
              <div className="flex items-center gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                >
                  -
                </Button>
                <span className="w-8 text-center">{item.quantity}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                >
                  +
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-red-500"
                  onClick={() => onRemove(item.id)}
                >
                  ×
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Totals */}
      <div className="p-4 border-t bg-gray-50 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Osnovica:</span>
          <span>{formatPrice(subtotal)}</span>
        </div>

        {Object.entries(vatByRate).map(([rate, amount]) => (
          <div key={rate} className="flex justify-between text-sm">
            <span className="text-gray-500">PDV {rate}%:</span>
            <span>{formatPrice(amount)}</span>
          </div>
        ))}

        <div className="flex justify-between text-lg font-bold pt-2 border-t">
          <span>Ukupno:</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/pos/components/cart.tsx
git commit -m "feat(pos): add Cart component with quantity controls and VAT breakdown"
```

---

### Task 3.5: Create PaymentBar Component

**Files:**

- Create: `src/app/(dashboard)/pos/components/payment-bar.tsx`

**Step 1: Create PaymentBar**

```typescript
// src/app/(dashboard)/pos/components/payment-bar.tsx
"use client"

import { Button } from "@/components/ui/button"

interface Props {
  total: number
  disabled: boolean
  hasTerminal: boolean
  onCash: () => void
  onCard: () => void
  onClear: () => void
}

export function PaymentBar({
  total,
  disabled,
  hasTerminal,
  onCash,
  onCard,
  onClear,
}: Props) {
  const formatPrice = (price: number) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: "EUR",
    }).format(price)

  return (
    <div className="bg-white border-t p-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        {/* Clear button */}
        <Button
          variant="ghost"
          onClick={onClear}
          disabled={disabled}
          className="text-gray-500"
        >
          Očisti
        </Button>

        {/* Total */}
        <div className="text-center">
          <p className="text-sm text-gray-500">Za platiti</p>
          <p className="text-3xl font-bold">{formatPrice(total)}</p>
        </div>

        {/* Payment buttons */}
        <div className="flex gap-2">
          <Button
            size="lg"
            variant="outline"
            onClick={onCash}
            disabled={disabled}
            className="min-w-[120px]"
          >
            Gotovina
          </Button>
          <Button
            size="lg"
            onClick={onCard}
            disabled={disabled || !hasTerminal}
            className="min-w-[120px]"
            title={!hasTerminal ? "Terminal nije konfiguriran" : undefined}
          >
            Kartica
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/pos/components/payment-bar.tsx
git commit -m "feat(pos): add PaymentBar component"
```

---

### Task 3.6: Create CashModal Component

**Files:**

- Create: `src/app/(dashboard)/pos/components/cash-modal.tsx`

**Step 1: Create CashModal**

```typescript
// src/app/(dashboard)/pos/components/cash-modal.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { processPosSale } from "@/app/actions/pos"
import { toast } from "sonner"
import type { CartItem } from "../types"
import type { ProcessPosSaleResult } from "@/types/pos"

interface Props {
  items: CartItem[]
  total: number
  onClose: () => void
  onComplete: (result: ProcessPosSaleResult) => void
}

export function CashModal({ items, total, onClose, onComplete }: Props) {
  const [received, setReceived] = useState("")
  const [processing, setProcessing] = useState(false)

  const receivedAmount = parseFloat(received) || 0
  const change = receivedAmount - total

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: "EUR",
    }).format(price)

  // Quick amount buttons
  const quickAmounts = [10, 20, 50, 100].filter((a) => a >= total)

  async function handleSubmit() {
    if (receivedAmount < total) {
      toast.error("Primljeni iznos je manji od ukupnog")
      return
    }

    setProcessing(true)

    try {
      const result = await processPosSale({
        items: items.map((item) => ({
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
        })),
        paymentMethod: "CASH",
      })

      if (result.success) {
        onComplete(result)
      } else {
        toast.error(result.error || "Greška pri obradi")
      }
    } catch (error) {
      toast.error("Greška pri obradi prodaje")
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Modal title="Gotovinska uplata" onClose={onClose}>
      <div className="space-y-6">
        {/* Total due */}
        <div className="text-center">
          <p className="text-sm text-gray-500">Za platiti</p>
          <p className="text-4xl font-bold">{formatPrice(total)}</p>
        </div>

        {/* Quick amounts */}
        {quickAmounts.length > 0 && (
          <div className="flex justify-center gap-2">
            {quickAmounts.map((amount) => (
              <Button
                key={amount}
                variant="outline"
                onClick={() => setReceived(amount.toString())}
              >
                {amount} €
              </Button>
            ))}
          </div>
        )}

        {/* Amount received */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Primljeno (EUR)
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            placeholder="0.00"
            className="text-2xl text-center"
            autoFocus
          />
        </div>

        {/* Change */}
        {receivedAmount >= total && (
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600">Vraćeno kupcu</p>
            <p className="text-3xl font-bold text-green-700">
              {formatPrice(change)}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Odustani
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={receivedAmount < total || processing}
          >
            {processing ? "Obrada..." : "Završi prodaju"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/pos/components/cash-modal.tsx
git commit -m "feat(pos): add CashModal component with change calculation"
```

---

### Task 3.7: Create CardPaymentModal Component

**Files:**

- Create: `src/app/(dashboard)/pos/components/card-payment-modal.tsx`

**Step 1: Create CardPaymentModal**

```typescript
// src/app/(dashboard)/pos/components/card-payment-modal.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { processPosSale } from "@/app/actions/pos"
import { toast } from "sonner"
import type { CartItem } from "../types"
import type { ProcessPosSaleResult } from "@/types/pos"

interface Props {
  items: CartItem[]
  total: number
  readerId: string
  onClose: () => void
  onComplete: (result: ProcessPosSaleResult) => void
}

type PaymentState =
  | "creating"
  | "waiting_for_card"
  | "processing"
  | "success"
  | "error"

export function CardPaymentModal({
  items,
  total,
  readerId,
  onClose,
  onComplete,
}: Props) {
  const [state, setState] = useState<PaymentState>("creating")
  const [error, setError] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: "EUR",
    }).format(price)

  useEffect(() => {
    startPayment()
  }, [])

  async function startPayment() {
    try {
      setState("creating")

      // Create payment intent
      const intentRes = await fetch("/api/terminal/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total }),
      })

      if (!intentRes.ok) {
        throw new Error("Failed to create payment intent")
      }

      const { paymentIntentId: piId } = await intentRes.json()
      setPaymentIntentId(piId)

      // Process on reader
      setState("waiting_for_card")

      const processRes = await fetch("/api/terminal/payment-intent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readerId, paymentIntentId: piId }),
      })

      const processResult = await processRes.json()

      if (!processResult.success) {
        throw new Error(processResult.error || "Payment failed")
      }

      // Payment succeeded, create invoice
      setState("processing")

      const saleResult = await processPosSale({
        items: items.map((item) => ({
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
        })),
        paymentMethod: "CARD",
        stripePaymentIntentId: piId,
      })

      if (saleResult.success) {
        setState("success")
        onComplete(saleResult)
      } else {
        throw new Error(saleResult.error || "Failed to create invoice")
      }
    } catch (err) {
      setState("error")
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }

  async function handleCancel() {
    // Cancel payment on reader if in progress
    if (paymentIntentId && state === "waiting_for_card") {
      try {
        await fetch(`/api/terminal/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ readerId }),
        })
      } catch {
        // Ignore cancel errors
      }
    }
    onClose()
  }

  return (
    <Modal title="Kartično plaćanje" onClose={handleCancel}>
      <div className="text-center space-y-6 py-4">
        {/* Total */}
        <div>
          <p className="text-sm text-gray-500">Za platiti</p>
          <p className="text-4xl font-bold">{formatPrice(total)}</p>
        </div>

        {/* Status */}
        {state === "creating" && (
          <div className="py-8">
            <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-gray-500">Priprema plaćanja...</p>
          </div>
        )}

        {state === "waiting_for_card" && (
          <div className="py-8">
            <div className="text-6xl mb-4">💳</div>
            <p className="text-lg font-medium">Prislonite ili umetnite karticu</p>
            <p className="text-sm text-gray-500 mt-2">
              Čekanje na terminal...
            </p>
          </div>
        )}

        {state === "processing" && (
          <div className="py-8">
            <div className="animate-spin h-12 w-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-gray-500">Obrada plaćanja...</p>
          </div>
        )}

        {state === "error" && (
          <div className="py-4">
            <div className="text-6xl mb-4">❌</div>
            <p className="text-lg font-medium text-red-600">Plaćanje nije uspjelo</p>
            <p className="text-sm text-gray-500 mt-2">{error}</p>
            <div className="flex justify-center gap-2 mt-6">
              <Button variant="outline" onClick={handleCancel}>
                Odustani
              </Button>
              <Button onClick={startPayment}>Pokušaj ponovno</Button>
            </div>
          </div>
        )}

        {state !== "error" && (
          <Button variant="ghost" onClick={handleCancel}>
            Odustani
          </Button>
        )}
      </div>
    </Modal>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/pos/components/card-payment-modal.tsx
git commit -m "feat(pos): add CardPaymentModal with Terminal integration"
```

---

### Task 3.8: Create ReceiptModal Component

**Files:**

- Create: `src/app/(dashboard)/pos/components/receipt-modal.tsx`

**Step 1: Create ReceiptModal**

```typescript
// src/app/(dashboard)/pos/components/receipt-modal.tsx
"use client"

import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import type { ProcessPosSaleResult } from "@/types/pos"

interface Props {
  result: ProcessPosSaleResult
  onNewSale: () => void
  onClose: () => void
}

export function ReceiptModal({ result, onNewSale, onClose }: Props) {
  const formatPrice = (price: number) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: "EUR",
    }).format(price)

  function handlePrint() {
    if (result.pdfUrl) {
      window.open(result.pdfUrl, "_blank")
    }
  }

  return (
    <Modal title="Prodaja završena" onClose={onClose}>
      <div className="text-center space-y-6 py-4">
        {/* Success icon */}
        <div className="text-6xl text-green-500">✓</div>

        {/* Invoice info */}
        <div>
          <p className="text-sm text-gray-500">Broj računa</p>
          <p className="text-xl font-mono font-bold">
            {result.invoice?.invoiceNumber}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-500">Ukupno</p>
          <p className="text-3xl font-bold">
            {formatPrice(result.invoice?.totalAmount || 0)}
          </p>
        </div>

        {/* Fiscal codes */}
        <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2">
          {result.jir && (
            <div>
              <span className="text-xs text-gray-500">JIR: </span>
              <span className="font-mono text-sm">{result.jir}</span>
            </div>
          )}
          {result.zki && (
            <div>
              <span className="text-xs text-gray-500">ZKI: </span>
              <span className="font-mono text-sm break-all">{result.zki}</span>
            </div>
          )}
          {!result.jir && (
            <p className="text-sm text-amber-600">
              Fiskalizacija u tijeku...
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint}>
            Ispiši račun
          </Button>
          <Button onClick={onNewSale}>Nova prodaja</Button>
        </div>
      </div>
    </Modal>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/pos/components/receipt-modal.tsx
git commit -m "feat(pos): add ReceiptModal component with fiscal codes display"
```

---

## Phase 4: Polish & Integration

### Task 4.1: Add POS Link to Navigation

**Files:**

- Modify: `src/lib/navigation.ts` (if exists) or wherever nav is defined

**Step 1: Find navigation config**

Run: `grep -r "Blagajna\|/pos" src/`
Expected: Find where navigation items are defined

**Step 2: Add POS link**

Add to navigation items:

```typescript
{
  name: "Blagajna",
  href: "/pos",
  icon: ShoppingCart, // from lucide-react
}
```

**Step 3: Commit**

```bash
git add src/lib/navigation.ts # or wherever
git commit -m "feat(pos): add POS link to navigation"
```

---

### Task 4.2: Add Keyboard Shortcuts

**Files:**

- Modify: `src/app/(dashboard)/pos/pos-client.tsx`

**Step 1: Add keyboard event handler**

Add to PosClient component:

```typescript
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    // F1 = Cash payment
    if (e.key === "F1" && cartItems.length > 0) {
      e.preventDefault()
      setShowCashModal(true)
    }
    // F2 = Card payment
    if (e.key === "F2" && cartItems.length > 0 && terminalReaderId) {
      e.preventDefault()
      setShowCardModal(true)
    }
    // Escape = Close modals
    if (e.key === "Escape") {
      setShowCashModal(false)
      setShowCardModal(false)
    }
    // Delete = Clear cart
    if (e.key === "Delete" && e.ctrlKey) {
      e.preventDefault()
      clearCart()
    }
  }

  window.addEventListener("keydown", handleKeyDown)
  return () => window.removeEventListener("keydown", handleKeyDown)
}, [cartItems.length, terminalReaderId])
```

**Step 2: Add shortcuts hint to PaymentBar**

Add small hint text below payment buttons.

**Step 3: Commit**

```bash
git add src/app/(dashboard)/pos/
git commit -m "feat(pos): add keyboard shortcuts (F1=Cash, F2=Card, Ctrl+Del=Clear)"
```

---

### Task 4.3: Run Full Test Suite

**Files:**

- Run all tests

**Step 1: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Manual test checklist**

- [ ] Navigate to /pos
- [ ] Add product to cart
- [ ] Adjust quantity
- [ ] Add custom item
- [ ] Process cash sale
- [ ] Verify PDF download
- [ ] Check fiscalization codes

---

### Task 4.4: Final Commit and PR

**Step 1: Ensure all changes are committed**

Run: `git status`
Expected: Clean working directory

**Step 2: Push branch**

Run: `git push -u origin feature/pos-fiskalna-blagajna`

**Step 3: Create PR**

Run:

```bash
gh pr create --title "feat: POS Fiskalna Blagajna" --body "$(cat <<'EOF'
## Summary
- Add Point-of-Sale system for in-person card/cash payments
- Integrate Stripe Terminal for physical card reader
- Fiscalize invoices with ZKI/JIR (demo mode by default)
- Generate HUB-3 QR codes for bank app payments
- Full Quick Sale UI with product grid and cart

## Test plan
- [ ] Run `npm test` - all tests pass
- [ ] Navigate to /pos and complete cash sale
- [ ] Verify PDF receipt downloads correctly
- [ ] Verify fiscal codes (JIR/ZKI) on receipt

Closes #58

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## File Summary

### New Files Created

- `src/types/pos.ts` - POS input/output types
- `src/app/actions/pos.ts` - processPosSale server action
- `src/app/actions/__tests__/pos.test.ts` - Server action tests
- `src/lib/fiscal/pos-fiscalize.ts` - POS fiscalization wrapper
- `src/lib/fiscal/__tests__/pos-fiscalize.test.ts` - Fiscalization tests
- `src/lib/pos/payment-qr.ts` - HUB-3 QR generator for POS
- `src/lib/stripe/terminal.ts` - Stripe Terminal helpers
- `src/lib/stripe/__tests__/terminal.test.ts` - Terminal tests
- `src/app/api/terminal/connection-token/route.ts`
- `src/app/api/terminal/payment-intent/route.ts`
- `src/app/api/terminal/reader-status/route.ts`
- `src/app/actions/terminal.ts` - Terminal settings actions
- `src/app/(dashboard)/settings/terminal/page.tsx`
- `src/app/(dashboard)/settings/terminal/terminal-settings-form.tsx`
- `src/app/(dashboard)/pos/layout.tsx`
- `src/app/(dashboard)/pos/page.tsx`
- `src/app/(dashboard)/pos/pos-client.tsx`
- `src/app/(dashboard)/pos/types.ts`
- `src/app/(dashboard)/pos/components/product-grid.tsx`
- `src/app/(dashboard)/pos/components/custom-item-modal.tsx`
- `src/app/(dashboard)/pos/components/cart.tsx`
- `src/app/(dashboard)/pos/components/payment-bar.tsx`
- `src/app/(dashboard)/pos/components/cash-modal.tsx`
- `src/app/(dashboard)/pos/components/card-payment-modal.tsx`
- `src/app/(dashboard)/pos/components/receipt-modal.tsx`

### Modified Files

- `prisma/schema.prisma` - Add Terminal fields to Company

### Dependencies (already installed)

- `stripe` - Stripe SDK
- `@react-pdf/renderer` - PDF generation
- `bwip-js` - HUB-3 barcode generation
