// apps/web/src/app/api/oib/lookup/route.ts
import { NextRequest, NextResponse } from "next/server"
import { lookupOib, type OibLookupResult } from "@/lib/oib-lookup"

export async function POST(request: NextRequest): Promise<NextResponse<OibLookupResult>> {
  try {
    const body = await request.json()
    const { oib } = body

    if (!oib || typeof oib !== "string") {
      return NextResponse.json(
        { success: false, error: "OIB je obavezan" },
        { status: 400 }
      )
    }

    // Clean OIB - remove any whitespace
    const cleanOib = oib.trim().replace(/\s/g, "")

    const result = await lookupOib(cleanOib)
    return NextResponse.json(result)
  } catch (error) {
    console.error("OIB lookup error:", error)
    return NextResponse.json(
      { success: false, error: "Greška pri pretrazi" },
      { status: 500 }
    )
  }
}
