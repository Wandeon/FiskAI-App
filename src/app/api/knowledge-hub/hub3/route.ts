import { NextResponse } from "next/server"
import { z } from "zod"
import { generateHub3DataUrl } from "@/lib/knowledge-hub/hub3"
import { PAYMENT_IBANS, PAYMENT_MODEL } from "@/lib/knowledge-hub/constants"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

export const runtime = "nodejs"

function validateOIB(oib: string): boolean {
  if (!/^\d{11}$/.test(oib)) return false

  let a = 10
  for (let i = 0; i < 10; i++) {
    a = (a + parseInt(oib[i], 10)) % 10
    if (a === 0) a = 10
    a = (a * 2) % 11
  }

  const controlDigit = (11 - a) % 10
  return controlDigit === parseInt(oib[10], 10)
}

const hub3RequestSchema = z.object({
  oib: z.string().refine(validateOIB, { message: "Neispravan OIB." }),
  paymentType: z.enum(["MIO_I", "MIO_II", "HZZO", "HOK"]),
  amount: z.number().positive({ message: "Neispravan iznos." }),
  payerName: z.string().optional(),
  payerAddress: z.string().optional(),
  payerCity: z.string().optional(),
})

type PaymentType = z.infer<typeof hub3RequestSchema>["paymentType"]

interface PaymentRecipient {
  iban: string
  recipientName: string
  recipientAddress: string
  recipientCity: string
  description: string
}

function buildReference(oib: string) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `${oib}-${year}${month}`
}

function getRecipient(paymentType: PaymentType): PaymentRecipient {
  switch (paymentType) {
    case "MIO_I":
      return {
        iban: PAYMENT_IBANS.STATE_BUDGET,
        recipientName: "DRŽAVNI PRORAČUN RH",
        recipientAddress: "",
        recipientCity: "ZAGREB",
        description: "MIO I. stup",
      }
    case "MIO_II":
      return {
        iban: PAYMENT_IBANS.MIO_II,
        recipientName: "OBVEZNI MIROVINSKI FONDOVI",
        recipientAddress: "",
        recipientCity: "ZAGREB",
        description: "MIO II. stup",
      }
    case "HZZO":
      return {
        iban: PAYMENT_IBANS.HZZO,
        recipientName: "HZZO",
        recipientAddress: "",
        recipientCity: "ZAGREB",
        description: "Zdravstveno osiguranje",
      }
    case "HOK":
      return {
        iban: PAYMENT_IBANS.HOK,
        recipientName: "HRVATSKA OBRTNIČKA KOMORA",
        recipientAddress: "",
        recipientCity: "ZAGREB",
        description: "HOK članarina",
      }
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, hub3RequestSchema)

    const recipient = getRecipient(body.paymentType)
    const reference = buildReference(body.oib)

    const dataUrl = await generateHub3DataUrl({
      amount: body.amount,
      payerName: body.payerName?.trim() || body.oib,
      payerAddress: body.payerAddress?.trim() || "",
      payerCity: body.payerCity?.trim() || "",
      recipientName: recipient.recipientName,
      recipientAddress: recipient.recipientAddress,
      recipientCity: recipient.recipientCity,
      recipientIBAN: recipient.iban,
      model: PAYMENT_MODEL,
      reference,
      description: recipient.description,
    })

    return NextResponse.json({
      dataUrl,
      reference,
      iban: recipient.iban,
      model: PAYMENT_MODEL,
      amount: body.amount,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Hub3 generation error:", error)
    return NextResponse.json({ error: "Greška prilikom generiranja barkoda." }, { status: 500 })
  }
}
