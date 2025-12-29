// src/app/api/receipts/view/route.ts
// Receipt image retrieval from R2 storage with cryptographic tenant isolation

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireCompany } from "@/lib/auth-utils"
import { downloadFromR2, verifyTenantSignature } from "@/lib/r2-client"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await requireCompany(session.user.id)

    const key = request.nextUrl.searchParams.get("key")
    if (!key) {
      return NextResponse.json({ error: "No key provided" }, { status: 400 })
    }

    // Security Layer 1: Verify the key path belongs to this company
    // Keys are formatted as: attachments/{companyId}/{year}/{month}/{sig}_{hash}.{ext}
    const keyParts = key.split("/")
    if (keyParts[0] !== "attachments" || keyParts[1] !== company.id) {
      logger.warn(
        { companyId: company.id, requestedKey: key },
        "Unauthorized receipt access attempt - company ID mismatch"
      )
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Security Layer 2: Verify cryptographic signature binds key to tenant
    // This prevents access even if an attacker guesses a valid key path
    if (!verifyTenantSignature(key, company.id)) {
      logger.warn(
        { companyId: company.id, requestedKey: key },
        "Unauthorized receipt access attempt - invalid tenant signature"
      )
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Download from R2
    const buffer = await downloadFromR2(key)

    // Determine content type from extension
    const ext = key.split(".").pop()?.toLowerCase()
    const contentTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      heic: "image/heic",
      pdf: "application/pdf",
    }
    const contentType = contentTypes[ext || ""] || "application/octet-stream"

    logger.info({ companyId: company.id, key }, "Receipt downloaded")

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${key.split("/").pop()}"`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error) {
    logger.error({ error }, "Receipt download failed")
    return NextResponse.json({ error: "Failed to retrieve receipt" }, { status: 500 })
  }
}
