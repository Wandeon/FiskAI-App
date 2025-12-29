import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { withApiLogging } from "@/lib/api-logging"
import { updateContext } from "@/lib/context"
import {
  generateDoprinosiSlip,
  generatePdvSlip,
  generateBarcodeDataUrl,
  formatHub3aData,
} from "@/lib/pausalni/payment-slips"
import { DOPRINOSI_2025, PDV_CONFIG, HOK_CONFIG } from "@/lib/pausalni/constants"

/**
 * GET /api/pausalni/payment-slip
 *
 * Generate a single payment slip for a specific obligation type
 *
 * Query params:
 * - type: MIO_I | MIO_II | ZDRAVSTVENO | PDV | HOK
 * - month: number (1-12)
 * - year: number
 * - amount: number (required for PDV)
 */
export const GET = withApiLogging(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    updateContext({ userId: user.id! })

    const company = await getCurrentCompany(user.id!)
    if (!company) {
      return NextResponse.json({ error: "No company selected" }, { status: 400 })
    }

    updateContext({ companyId: company.id })

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get("type") // MIO_I, MIO_II, ZDRAVSTVENO, PDV, HOK
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1))
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()))
    const amount = searchParams.get("amount") ? parseFloat(searchParams.get("amount")!) : undefined

    if (!type) {
      return NextResponse.json({ error: "Type is required" }, { status: 400 })
    }

    const payer = {
      name: company.name,
      address: company.address || "",
      city: company.city || "",
    }

    let slipData

    switch (type) {
      case "MIO_I":
      case "MIO_II":
      case "ZDRAVSTVENO":
        slipData = generateDoprinosiSlip(type, company.oib, payer, month, year)
        break

      case "PDV":
        if (amount === undefined) {
          return NextResponse.json({ error: "Amount is required for PDV" }, { status: 400 })
        }
        slipData = generatePdvSlip(company.oib, amount, payer, month, year)
        break

      case "HOK":
        slipData = {
          payerName: payer.name,
          payerAddress: payer.address,
          payerCity: payer.city,
          recipientName: HOK_CONFIG.recipientName,
          recipientAddress: "Zagreb",
          recipientCity: "10000 Zagreb",
          recipientIban: HOK_CONFIG.iban,
          amount: HOK_CONFIG.quarterlyAmount,
          model: HOK_CONFIG.model,
          reference: `${HOK_CONFIG.referencePrefix}-${company.oib}`,
          purposeCode: "OTHR",
          description: `HOK članarina Q${Math.ceil(month / 3)} ${year}`,
        }
        break

      default:
        return NextResponse.json({ error: "Invalid payment type" }, { status: 400 })
    }

    // Generate barcode
    const barcodeDataUrl = await generateBarcodeDataUrl(slipData)
    const hub3aString = formatHub3aData(slipData)

    return NextResponse.json({
      slip: slipData,
      barcode: barcodeDataUrl,
      hub3aData: hub3aString,
    })
  } catch (error) {
    console.error("Error generating payment slip:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

/**
 * POST /api/pausalni/payment-slip
 *
 * Generate all 3 doprinosi payment slips at once (batch operation)
 *
 * Body:
 * - month: number (1-12)
 * - year: number
 */
export const POST = withApiLogging(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    updateContext({ userId: user.id! })

    const company = await getCurrentCompany(user.id!)
    if (!company) {
      return NextResponse.json({ error: "No company selected" }, { status: 400 })
    }

    updateContext({ companyId: company.id })

    const body = await request.json()
    const { month, year } = body

    if (!month || !year) {
      return NextResponse.json({ error: "Month and year are required" }, { status: 400 })
    }

    const payer = {
      name: company.name,
      address: company.address || "",
      city: company.city || "",
    }

    const slips = []

    // Generate all 3 doprinosi slips
    for (const type of ["MIO_I", "MIO_II", "ZDRAVSTVENO"] as const) {
      const slipData = generateDoprinosiSlip(type, company.oib, payer, month, year)
      const barcodeDataUrl = await generateBarcodeDataUrl(slipData)

      slips.push({
        type,
        slip: slipData,
        barcode: barcodeDataUrl,
      })
    }

    return NextResponse.json({
      slips,
      totalAmount: DOPRINOSI_2025.TOTAL,
    })
  } catch (error) {
    console.error("Error generating batch payment slips:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
