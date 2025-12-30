import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/auth-utils"
import { getIpFromHeaders, getUserAgentFromHeaders, logAudit } from "@/lib/audit"
import type { ReferenceCategory } from "@prisma/client"

const serializeTable = (table: {
  id: string
  category: ReferenceCategory
  name: string
  jurisdiction: string
  keyColumn: string
  valueColumn: string
  sourceUrl: string | null
  evidenceId: string | null
  lastUpdated: Date
  createdAt: Date
  updatedAt: Date
}) => ({
  id: table.id,
  category: table.category,
  name: table.name,
  jurisdiction: table.jurisdiction,
  keyColumn: table.keyColumn,
  valueColumn: table.valueColumn,
  sourceUrl: table.sourceUrl,
  evidenceId: table.evidenceId,
  lastUpdated: table.lastUpdated.toISOString(),
  createdAt: table.createdAt.toISOString(),
  updatedAt: table.updatedAt.toISOString(),
})

const getAuditCompanyId = async (userId: string) => {
  const defaultCompany = await db.companyUser.findFirst({
    where: { userId, isDefault: true },
    select: { companyId: true },
  })

  if (defaultCompany) {
    return defaultCompany.companyId
  }

  const anyCompany = await db.companyUser.findFirst({
    where: { userId },
    select: { companyId: true },
  })

  if (anyCompany) {
    return anyCompany.companyId
  }

  const fallback = await db.company.findFirst({
    select: { id: true },
  })

  if (!fallback) {
    throw new Error("No company available for audit logging")
  }

  return fallback.id
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const admin = await requireAdmin()
  const { tableId } = await params

  try {
    const body = await request.json()
    const { name, category, jurisdiction, keyColumn, valueColumn, sourceUrl, evidenceId, reason } =
      body
    const trimmedReason = typeof reason === "string" ? reason.trim() : ""
    if (!trimmedReason) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 })
    }

    const table = await db.referenceTable.findUnique({
      where: { id: tableId },
    })

    if (!table) {
      return NextResponse.json({ error: "Reference table not found" }, { status: 404 })
    }

    const updatedTable = await db.referenceTable.update({
      where: { id: tableId },
      data: {
        name: name ?? undefined,
        category: category ?? undefined,
        jurisdiction: jurisdiction ?? undefined,
        keyColumn: keyColumn ?? undefined,
        valueColumn: valueColumn ?? undefined,
        sourceUrl: typeof sourceUrl === "undefined" ? undefined : sourceUrl,
        evidenceId: typeof evidenceId === "undefined" ? undefined : evidenceId,
        lastUpdated: new Date(),
      },
    })

    const auditCompanyId = await getAuditCompanyId(admin.id)

    await logAudit({
      companyId: auditCompanyId,
      userId: admin.id,
      action: "UPDATE",
      entity: "ReferenceTable",
      entityId: table.id,
      reason: trimmedReason,
      changes: {
        before: serializeTable(table),
        after: serializeTable(updatedTable),
      },
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    })

    return NextResponse.json({ table: updatedTable })
  } catch (error) {
    console.error("Admin regulatory table update error:", error)
    return NextResponse.json({ error: "Failed to update regulatory table" }, { status: 500 })
  }
}
