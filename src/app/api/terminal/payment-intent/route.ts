import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { createTerminalPaymentIntent, processPaymentOnReader } from "@/lib/stripe/terminal"
import { z } from "zod"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

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

    const input = await parseBody(request, createSchema)

    const result = await createTerminalPaymentIntent({
      amount: input.amount,
      companyId: company.id,
      invoiceRef: input.invoiceRef,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Payment intent error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create payment" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const input = await parseBody(request, processSchema)

    // Verify the reader belongs to this company
    if (company.stripeTerminalReaderId !== input.readerId) {
      return NextResponse.json({ error: "Reader not authorized for this company" }, { status: 403 })
    }

    const result = await processPaymentOnReader({
      readerId: input.readerId,
      paymentIntentId: input.paymentIntentId,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Process payment error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process payment" },
      { status: 500 }
    )
  }
}
