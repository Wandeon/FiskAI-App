import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/auth-utils"
import { getIpFromHeaders, getUserAgentFromHeaders, logAudit } from "@/lib/audit"
import {
  parseParams,
  parseBody,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"
import { regulatoryTableIdSchema } from "@/app/api/admin/_schemas"
import { z } from "zod"
import { ReferenceCategory } from "@prisma/client"

const updateRegulatoryTableSchema = z.object({
  name: z.string().optional(),
  category: z.nativeEnum(ReferenceCategory).optional(),
  jurisdiction: z.string().optional(),
  keyColumn: z.string().optional(),
  valueColumn: z.string().optional(),
  sourceUrl: z.string().nullable().optional(),
  evidenceId: z.string().nullable().optional(),
  reason: z.string().min(1, "Reason is required"),
})

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

  try {
    const { tableId } = parseParams(await params, regulatoryTableIdSchema)
    const { name, category, jurisdiction, keyColumn, valueColumn, sourceUrl, evidenceId, reason } =
      await parseBody(request, updateRegulatoryTableSchema)

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
      reason: reason.trim(),
      changes: {
        before: serializeTable(table),
        after: serializeTable(updatedTable),
      },
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    })

    return NextResponse.json({ table: updatedTable })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Admin regulatory table update error:", error)
    return NextResponse.json({ error: "Failed to update regulatory table" }, { status: 500 })
  }
}
