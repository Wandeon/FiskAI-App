import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { requirePermission } from "@/lib/rbac"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import {
  employeeMasterDataSchema,
  validateEmployeeMasterData,
} from "@/lib/validations/employee-master-data"

function toDecimal(value: number | null | undefined) {
  if (value === null || value === undefined) return null
  return new Prisma.Decimal(value)
}

function serializeEmployee(employee: {
  id: string
  firstName: string
  lastName: string
  oib: string | null
  dateOfBirth: Date | null
  email: string | null
  phone: string | null
  roles: Array<{
    id: string
    title: string
    description: string | null
    effectiveFrom: Date
    effectiveTo: Date | null
  }>
  dependents: Array<{
    id: string
    fullName: string
    relation: string
    birthDate: Date | null
    oib: string | null
    isDisabled: boolean
    effectiveFrom: Date
    effectiveTo: Date | null
  }>
  allowances: Array<{
    id: string
    type: string
    amount: Prisma.Decimal
    currency: string
    taxable: boolean
    effectiveFrom: Date
    effectiveTo: Date | null
  }>
  pensionPillars: Array<{
    id: string
    pillar: string
    fundName: string | null
    contributionRate: Prisma.Decimal | null
    effectiveFrom: Date
    effectiveTo: Date | null
  }>
  employmentContracts: Array<{
    id: string
    contractCode: string | null
    status: string
    startedAt: Date
    endedAt: Date | null
    versions: Array<{
      id: string
      version: number
      effectiveFrom: Date
      effectiveTo: Date | null
      roleTitle: string | null
      employmentType: string | null
      hoursPerWeek: number | null
      salaryAmount: Prisma.Decimal | null
      salaryCurrency: string
    }>
    terminationEvents: Array<{
      id: string
      terminatedAt: Date
      reason: string
      notes: string | null
    }>
  }>
}) {
  return {
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
  }
}

export async function GET() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  await requirePermission(user.id!, company.id, "person:read")

  setTenantContext({ companyId: company.id, userId: user.id! })

  const employees = await db.employee.findMany({
    where: { companyId: company.id },
    include: {
      roles: { orderBy: { effectiveFrom: "desc" } },
      dependents: { orderBy: { effectiveFrom: "desc" } },
      allowances: { orderBy: { effectiveFrom: "desc" } },
      pensionPillars: { orderBy: { effectiveFrom: "desc" } },
      employmentContracts: {
        include: {
          versions: { orderBy: { version: "desc" } },
          terminationEvents: { orderBy: { terminatedAt: "desc" } },
        },
        orderBy: { startedAt: "desc" },
      },
    },
    orderBy: { lastName: "asc" },
  })

  return NextResponse.json({
    success: true,
    employees: employees.map(serializeEmployee),
  })
}

export async function POST(request: Request) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  await requirePermission(user.id!, company.id, "person:update")

  const payload = await request.json()
  const parsed = employeeMasterDataSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.format() },
      { status: 400 }
    )
  }

  try {
    validateEmployeeMasterData(parsed.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid employee master data"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  setTenantContext({ companyId: company.id, userId: user.id! })

  const created = await db.employee.create({
    data: {
      companyId: company.id,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      oib: parsed.data.oib ?? null,
      dateOfBirth: parsed.data.dateOfBirth ?? null,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      roles: parsed.data.roles
        ? {
            create: parsed.data.roles.map((role) => ({
              companyId: company.id,
              title: role.title,
              description: role.description ?? null,
              effectiveFrom: role.effectiveFrom,
              effectiveTo: role.effectiveTo ?? null,
            })),
          }
        : undefined,
      dependents: parsed.data.dependents
        ? {
            create: parsed.data.dependents.map((dependent) => ({
              companyId: company.id,
              fullName: dependent.fullName,
              relation: dependent.relation,
              birthDate: dependent.birthDate ?? null,
              oib: dependent.oib ?? null,
              isDisabled: dependent.isDisabled ?? false,
              effectiveFrom: dependent.effectiveFrom,
              effectiveTo: dependent.effectiveTo ?? null,
            })),
          }
        : undefined,
      allowances: parsed.data.allowances
        ? {
            create: parsed.data.allowances.map((allowance) => ({
              companyId: company.id,
              type: allowance.type,
              amount: toDecimal(allowance.amount),
              currency: allowance.currency,
              taxable: allowance.taxable ?? false,
              effectiveFrom: allowance.effectiveFrom,
              effectiveTo: allowance.effectiveTo ?? null,
            })),
          }
        : undefined,
      pensionPillars: parsed.data.pensionPillars
        ? {
            create: parsed.data.pensionPillars.map((pillar) => ({
              companyId: company.id,
              pillar: pillar.pillar,
              fundName: pillar.fundName ?? null,
              contributionRate: toDecimal(pillar.contributionRate ?? null),
              effectiveFrom: pillar.effectiveFrom,
              effectiveTo: pillar.effectiveTo ?? null,
            })),
          }
        : undefined,
      employmentContracts: parsed.data.contracts
        ? {
            create: parsed.data.contracts.map((contract) => ({
              companyId: company.id,
              contractCode: contract.contractCode ?? null,
              startedAt: contract.startedAt,
              endedAt: contract.endedAt ?? null,
              status: contract.status,
              versions: contract.versions
                ? {
                    create: contract.versions.map((version) => ({
                      companyId: company.id,
                      version: version.version,
                      effectiveFrom: version.effectiveFrom,
                      effectiveTo: version.effectiveTo ?? null,
                      roleTitle: version.roleTitle ?? null,
                      employmentType: version.employmentType ?? null,
                      hoursPerWeek: version.hoursPerWeek ?? null,
                      salaryAmount: toDecimal(version.salaryAmount ?? null),
                      salaryCurrency: version.salaryCurrency,
                    })),
                  }
                : undefined,
            })),
          }
        : undefined,
    },
    include: {
      roles: { orderBy: { effectiveFrom: "desc" } },
      dependents: { orderBy: { effectiveFrom: "desc" } },
      allowances: { orderBy: { effectiveFrom: "desc" } },
      pensionPillars: { orderBy: { effectiveFrom: "desc" } },
      employmentContracts: {
        include: {
          versions: { orderBy: { version: "desc" } },
          terminationEvents: { orderBy: { terminatedAt: "desc" } },
        },
        orderBy: { startedAt: "desc" },
      },
    },
  })

  return NextResponse.json({ success: true, employee: serializeEmployee(created) }, { status: 201 })
}
