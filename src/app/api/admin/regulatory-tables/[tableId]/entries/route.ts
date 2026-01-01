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
import type { ReferenceCategory, ReferenceEntry } from "@prisma/client"

const updateEntriesSchema = z.object({
  entries: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
      metadata: z.unknown().optional(),
    })
  ),
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

const serializeEntries = (entries: ReferenceEntry[]) =>
  entries.map((entry) => ({
    id: entry.id,
    key: entry.key,
    value: entry.value,
    metadata: entry.metadata,
    createdAt: entry.createdAt.toISOString(),
  }))

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

export async function PUT(request: Request, { params }: { params: Promise<{ tableId: string }> }) {
  const admin = await requireAdmin()

  try {
    const { tableId } = parseParams(await params, regulatoryTableIdSchema)
    const { entries, sourceUrl, evidenceId, reason } = await parseBody(request, updateEntriesSchema)

    const table = await db.referenceTable.findUnique({
      where: { id: tableId },
      include: { entries: true },
    })

    if (!table) {
      return NextResponse.json({ error: "Reference table not found" }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      await tx.referenceEntry.deleteMany({
        where: { tableId },
      })

      if (entries.length > 0) {
        await tx.referenceEntry.createMany({
          data: entries.map((entry: { key: string; value: string; metadata?: unknown }) => ({
            tableId,
            key: entry.key,
            value: entry.value,
            metadata: entry.metadata ?? undefined,
          })),
        })
      }

      await tx.referenceTable.update({
        where: { id: tableId },
        data: {
          sourceUrl: typeof sourceUrl === "undefined" ? undefined : sourceUrl,
          evidenceId: typeof evidenceId === "undefined" ? undefined : evidenceId,
          lastUpdated: new Date(),
        },
      })
    })

    const updatedTable = await db.referenceTable.findUnique({
      where: { id: tableId },
      include: { entries: true },
    })

    if (!updatedTable) {
      return NextResponse.json({ error: "Reference table not found" }, { status: 404 })
    }

    const auditCompanyId = await getAuditCompanyId(admin.id)

    await logAudit({
      companyId: auditCompanyId,
      userId: admin.id,
      action: "UPDATE",
      entity: "ReferenceTableEntries",
      entityId: tableId,
      reason: reason.trim(),
      changes: {
        before: {
          table: serializeTable(table),
          entries: serializeEntries(table.entries),
        },
        after: {
          table: serializeTable(updatedTable),
          entries: serializeEntries(updatedTable.entries),
        },
      },
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    })

    return NextResponse.json({ table: updatedTable })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Admin regulatory table entries update error:", error)
    return NextResponse.json(
      { error: "Failed to update regulatory table entries" },
      { status: 500 }
    )
  }
}
