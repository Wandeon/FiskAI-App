import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import { z } from "zod"
import {
  sendEmailToTenant,
  giftModuleToTenant,
  flagTenant,
  exportTenantData,
} from "@/lib/admin/actions"
import { apiError, ApiErrors } from "@/lib/api-error"
import {
  parseParams,
  parseBody,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"
import { tenantParamsSchema } from "@/app/api/admin/_schemas"

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("email"),
    subject: z.string().min(1, "Subject is required"),
    body: z.string().min(1, "Body is required"),
  }),
  z.object({
    action: z.literal("gift-module"),
    moduleKey: z.string().min(1, "Module key required"),
  }),
  z.object({
    action: z.literal("flag"),
    flag: z.string().min(1, "Flag is required"),
    reason: z.string().min(1, "Reason is required"),
    flagAction: z.enum(["add", "remove"]).default("add"),
  }),
  z.object({
    action: z.literal("export"),
  }),
])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const user = await getCurrentUser()

  // Check ADMIN role
  if (!user || user.systemRole !== "ADMIN") {
    return ApiErrors.forbidden("Forbidden: ADMIN role required")
  }

  try {
    const { companyId } = parseParams(await params, tenantParamsSchema)
    const data = await parseBody(request, actionSchema)

    // Route to appropriate action handler
    switch (data.action) {
      case "email": {
        const result = await sendEmailToTenant(companyId, data.subject, data.body)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json({ success: true, message: "Email sent successfully" })
      }

      case "gift-module": {
        const result = await giftModuleToTenant(companyId, data.moduleKey)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json({
          success: true,
          message: `Module ${data.moduleKey} gifted successfully`,
        })
      }

      case "flag": {
        const result = await flagTenant(companyId, data.flag, data.reason, data.flagAction)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json({
          success: true,
          message: `Flag ${data.flag} ${data.flagAction === "add" ? "added" : "removed"} successfully`,
        })
      }

      case "export": {
        const result = await exportTenantData(companyId)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json({ success: true, data: result.data })
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    return apiError(error)
  }
}
