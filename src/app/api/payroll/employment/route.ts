import { NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"

type Period = {
  start: Date
  end: Date
}

function parsePeriod(request: Request): Period {
  const { searchParams } = new URL(request.url)
  const periodStart = searchParams.get("periodStart")
  const periodEnd = searchParams.get("periodEnd")

  if (!periodStart || !periodEnd) {
    throw new Error("periodStart and periodEnd are required")
  }

  const start = new Date(periodStart)
  const end = new Date(periodEnd)

  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    throw new Error("periodStart and periodEnd must be valid dates")
  }

  if (start > end) {
    throw new Error("periodStart must be before or equal to periodEnd")
  }

  return { start, end }
}

function buildOverlapFilter(start: Date, end: Date) {
  return {
    effectiveFrom: { lte: end },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
  }
}

export async function GET(request: Request) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  let period: Period
  try {
    period = parsePeriod(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid period"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const overlapFilter = buildOverlapFilter(period.start, period.end)

  const employees = await db.employee.findMany({
    where: {
      employmentContracts: {
        some: {
          startedAt: { lte: period.end },
          OR: [{ endedAt: null }, { endedAt: { gte: period.start } }],
        },
      },
    },
    include: {
      roles: { where: overlapFilter },
      dependents: { where: overlapFilter },
      allowances: { where: overlapFilter },
      pensionPillars: { where: overlapFilter },
      employmentContracts: {
        where: {
          startedAt: { lte: period.end },
          OR: [{ endedAt: null }, { endedAt: { gte: period.start } }],
        },
        include: {
          versions: {
            where: overlapFilter,
            orderBy: { version: "desc" },
          },
          terminationEvents: {
            where: {
              terminatedAt: {
                gte: period.start,
                lte: period.end,
              },
            },
            orderBy: { terminatedAt: "desc" },
          },
        },
        orderBy: { startedAt: "desc" },
      },
    },
  })

  return NextResponse.json({
    success: true,
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    },
    employees: employees.map((employee) => ({
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      oib: employee.oib,
      dateOfBirth: employee.dateOfBirth?.toISOString() ?? null,
      email: employee.email,
      phone: employee.phone,
      roles: employee.roles.map((role) => ({
        id: role.id,
        title: role.title,
        description: role.description,
        effectiveFrom: role.effectiveFrom.toISOString(),
        effectiveTo: role.effectiveTo?.toISOString() ?? null,
      })),
      dependents: employee.dependents.map((dependent) => ({
        id: dependent.id,
        fullName: dependent.fullName,
        relation: dependent.relation,
        birthDate: dependent.birthDate?.toISOString() ?? null,
        oib: dependent.oib,
        isDisabled: dependent.isDisabled,
        effectiveFrom: dependent.effectiveFrom.toISOString(),
        effectiveTo: dependent.effectiveTo?.toISOString() ?? null,
      })),
      allowances: employee.allowances.map((allowance) => ({
        id: allowance.id,
        type: allowance.type,
        amount: allowance.amount.toString(),
        currency: allowance.currency,
        taxable: allowance.taxable,
        effectiveFrom: allowance.effectiveFrom.toISOString(),
        effectiveTo: allowance.effectiveTo?.toISOString() ?? null,
      })),
      pensionPillars: employee.pensionPillars.map((pillar) => ({
        id: pillar.id,
        pillar: pillar.pillar,
        fundName: pillar.fundName,
        contributionRate: pillar.contributionRate?.toString() ?? null,
        effectiveFrom: pillar.effectiveFrom.toISOString(),
        effectiveTo: pillar.effectiveTo?.toISOString() ?? null,
      })),
      contracts: employee.employmentContracts.map((contract) => ({
        id: contract.id,
        contractCode: contract.contractCode,
        status: contract.status,
        startedAt: contract.startedAt.toISOString(),
        endedAt: contract.endedAt?.toISOString() ?? null,
        versions: contract.versions.map((version) => ({
          id: version.id,
          version: version.version,
          effectiveFrom: version.effectiveFrom.toISOString(),
          effectiveTo: version.effectiveTo?.toISOString() ?? null,
          roleTitle: version.roleTitle,
          employmentType: version.employmentType,
          hoursPerWeek: version.hoursPerWeek,
          salaryAmount: version.salaryAmount?.toString() ?? null,
          salaryCurrency: version.salaryCurrency,
        })),
        terminationEvents: contract.terminationEvents.map((event) => ({
          id: event.id,
          terminatedAt: event.terminatedAt.toISOString(),
          reason: event.reason,
          notes: event.notes,
        })),
      })),
    })),
  })
}
