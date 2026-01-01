import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/auth-utils"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

export async function GET() {
  await requireAdmin()

  try {
    const tables = await db.referenceTable.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { entries: true },
        },
      },
    })

    return NextResponse.json({
      tables: tables.map((table) => ({
        id: table.id,
        category: table.category,
        name: table.name,
        jurisdiction: table.jurisdiction,
        keyColumn: table.keyColumn,
        valueColumn: table.valueColumn,
        sourceUrl: table.sourceUrl,
        evidenceId: table.evidenceId,
        lastUpdated: table.lastUpdated,
        updatedAt: table.updatedAt,
        entryCount: table._count.entries,
      })),
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Admin regulatory tables error:", error)
    return NextResponse.json({ error: "Failed to fetch regulatory tables" }, { status: 500 })
  }
}
