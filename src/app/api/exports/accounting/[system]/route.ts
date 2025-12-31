import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { createControlSum } from "@/lib/exports/control-sum"
import {
  buildExternalAccountingCsv,
  buildExportValidationReport,
  getExportFilenamePrefix,
  type AccountMappingLookup,
  type ExportLine,
  type ExportTargetSystem,
} from "@/lib/exports/external-accounting"

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
})

const systemSchema = z.enum(["synesis", "pantheon", "minimax"])

function parseDate(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function normalizeSystem(value: string): ExportTargetSystem {
  return value.toUpperCase() as ExportTargetSystem
}

function numberFromDecimal(value: { toString(): string } | number | null): number {
  if (value === null) return 0
  if (typeof value === "number") return value
  return Number(value.toString())
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ system: string }> }
) {
  const { system } = await params
  const systemParse = systemSchema.safeParse(system)
  if (!systemParse.success) {
    return NextResponse.json({ error: "Nepoznat format izvoza" }, { status: 404 })
  }

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: "Neispravan upit" }, { status: 400 })
  }

  const fromDate = parseDate(parsed.data.from)
  const toDate = parseDate(parsed.data.to)

  if (parsed.data.from && !fromDate) {
    return NextResponse.json({ error: "Neispravan datum 'from'" }, { status: 400 })
  }
  if (parsed.data.to && !toDate) {
    return NextResponse.json({ error: "Neispravan datum 'to'" }, { status: 400 })
  }

  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const exportSystem = normalizeSystem(systemParse.data)

  const exportProfile = await db.exportProfile.findFirst({
    where: { companyId: company.id, targetSystem: exportSystem },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  })

  if (!exportProfile) {
    return NextResponse.json(
      { error: "Export profil nije pronađen za traženi sustav" },
      { status: 404 }
    )
  }

  const toDateInclusive = toDate
    ? (() => {
        const d = new Date(toDate)
        d.setHours(23, 59, 59, 999)
        return d
      })()
    : undefined

  const dateFilter =
    fromDate || toDateInclusive
      ? {
          gte: fromDate,
          lte: toDateInclusive,
        }
      : undefined

  const journalEntries = await db.journalEntry.findMany({
    where: {
      companyId: company.id,
      ...(dateFilter ? { entryDate: dateFilter } : {}),
    },
    include: {
      lines: {
        include: {
          account: { select: { code: true, name: true } },
        },
        orderBy: { lineNumber: "asc" },
      },
    },
    orderBy: [{ entryDate: "asc" }, { entryNumber: "asc" }, { id: "asc" }],
  })

  const exportLines: ExportLine[] = journalEntries.flatMap((entry) =>
    entry.lines.map((line) => ({
      entryDate: entry.entryDate,
      entryNumber: entry.entryNumber,
      lineNumber: line.lineNumber,
      description: entry.description ?? "",
      accountId: line.accountId,
      accountCode: line.account.code,
      accountName: line.account.name,
      debit: numberFromDecimal(line.debit),
      credit: numberFromDecimal(line.credit),
    }))
  )

  const mappings = await db.accountMapping.findMany({
    where: { exportProfileId: exportProfile.id },
    select: {
      chartOfAccountsId: true,
      externalAccountCode: true,
      externalAccountName: true,
    },
  })

  const mappingByAccountId = new Map<string, AccountMappingLookup>()
  mappings.forEach((mapping) => {
    mappingByAccountId.set(mapping.chartOfAccountsId, {
      accountId: mapping.chartOfAccountsId,
      externalAccountCode: mapping.externalAccountCode,
      externalAccountName: mapping.externalAccountName,
    })
  })

  const missingMap = new Map<
    string,
    { accountId: string; accountCode: string; accountName: string }
  >()
  exportLines.forEach((line) => {
    if (!mappingByAccountId.has(line.accountId)) {
      missingMap.set(line.accountId, {
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
      })
    }
  })

  const missingMappings = Array.from(missingMap.values())
  const validationReport = buildExportValidationReport(missingMappings)

  if (!validationReport.ok) {
    await db.exportJob.create({
      data: {
        companyId: company.id,
        exportProfileId: exportProfile.id,
        status: "BLOCKED",
        periodFrom: fromDate,
        periodTo: toDate,
        recordCount: exportLines.length,
        validationReport,
      },
    })

    return NextResponse.json(
      {
        error: "Nedostaju mapiranja konta za izvoz",
        validation: validationReport,
      },
      { status: 409 }
    )
  }

  const csv = buildExternalAccountingCsv(exportSystem, exportLines, mappingByAccountId)
  const controlSum = createControlSum(csv)
  const rangeLabel =
    parsed.data.from && parsed.data.to ? `${parsed.data.from}-${parsed.data.to}` : "all"
  const filenamePrefix = getExportFilenamePrefix(exportSystem)
  const filename = `${filenamePrefix}-export-${rangeLabel}.csv`

  await db.exportJob.create({
    data: {
      companyId: company.id,
      exportProfileId: exportProfile.id,
      status: "COMPLETED",
      periodFrom: fromDate,
      periodTo: toDate,
      recordCount: exportLines.length,
      fileName: filename,
      controlSum,
      completedAt: new Date(),
    },
  })

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Export-System": exportSystem,
      "X-Export-Profile-Id": exportProfile.id,
      "X-Export-Control-Sum": controlSum,
    },
  })
}
