import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/auth-utils"
import { getIpFromHeaders, getUserAgentFromHeaders, logAudit } from "@/lib/audit"
import type { ReferenceCategory, ReferenceEntry } from "@prisma/client"

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
  const { tableId } = await params

  try {
    const body = await request.json()
    const { entries, sourceUrl, evidenceId, reason } = body

    if (!Array.isArray(entries)) {
      return NextResponse.json({ error: "Entries array is required" }, { status: 400 })
    }
    const trimmedReason = typeof reason === "string" ? reason.trim() : ""
    if (!trimmedReason) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 })
    }

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
      reason: trimmedReason,
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
    console.error("Admin regulatory table entries update error:", error)
    return NextResponse.json(
      { error: "Failed to update regulatory table entries" },
      { status: 500 }
    )
  }
}
