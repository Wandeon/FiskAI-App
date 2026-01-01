import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { validateVatId, validateVatIdFormat } from "@/lib/pausalni/vies-validation"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"
import { viesValidateBodySchema } from "@/app/api/pausalni/_schemas"

/**
 * POST /api/pausalni/vies-validate
 * Validate a VAT ID against the EU VIES system
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await getCurrentCompany(user.id!)
    if (!company) {
      return NextResponse.json({ error: "No company selected" }, { status: 400 })
    }

    if (company.legalForm !== "OBRT_PAUSAL") {
      return NextResponse.json({ error: "Not a pausalni obrt" }, { status: 400 })
    }

    // Parse and validate body
    const { vatId } = await parseBody(request, viesValidateBodySchema)

    const formatResult = validateVatIdFormat(vatId)
    if (!formatResult.valid) {
      return NextResponse.json({
        valid: false,
        vatId,
        error: formatResult.error,
      })
    }

    const result = await validateVatId(vatId)

    return NextResponse.json({
      valid: result.valid,
      vatId: `${result.countryCode}${result.vatNumber}`,
      countryCode: result.countryCode,
      vatNumber: result.vatNumber,
      name: result.name,
      address: result.address,
      requestDate: result.requestDate.toISOString(),
      error: result.errorMessage,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error validating VAT ID:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
