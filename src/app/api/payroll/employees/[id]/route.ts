import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { requirePermission } from "@/lib/rbac"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import {
  employeeMasterDataUpdateSchema,
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

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  await requirePermission(user.id!, company.id, "person:read")

  const { id } = await context.params

  setTenantContext({ companyId: company.id, userId: user.id! })

  const employee = await db.employee.findFirst({
    where: { id, companyId: company.id },
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

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, employee: serializeEmployee(employee) })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  await requirePermission(user.id!, company.id, "person:update")

  const { id } = await context.params
  const payload = await request.json()
  const parsed = employeeMasterDataUpdateSchema.safeParse(payload)
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

  const employee = await db.$transaction(async (tx) => {
    const existing = await tx.employee.findFirst({
      where: { id, companyId: company.id },
    })

    if (!existing) {
      return null
    }

    if (parsed.data.roles) {
      await tx.employeeRole.deleteMany({
        where: { employeeId: existing.id, companyId: company.id },
      })
      if (parsed.data.roles.length > 0) {
        await tx.employeeRole.createMany({
          data: parsed.data.roles.map((role) => ({
            companyId: company.id,
            employeeId: existing.id,
            title: role.title,
            description: role.description ?? null,
            effectiveFrom: role.effectiveFrom,
            effectiveTo: role.effectiveTo ?? null,
          })),
        })
      }
    }

    if (parsed.data.dependents) {
      await tx.dependent.deleteMany({ where: { employeeId: existing.id, companyId: company.id } })
      if (parsed.data.dependents.length > 0) {
        await tx.dependent.createMany({
          data: parsed.data.dependents.map((dependent) => ({
            companyId: company.id,
            employeeId: existing.id,
            fullName: dependent.fullName,
            relation: dependent.relation,
            birthDate: dependent.birthDate ?? null,
            oib: dependent.oib ?? null,
            isDisabled: dependent.isDisabled ?? false,
            effectiveFrom: dependent.effectiveFrom,
            effectiveTo: dependent.effectiveTo ?? null,
          })),
        })
      }
    }

    if (parsed.data.allowances) {
      await tx.allowance.deleteMany({ where: { employeeId: existing.id, companyId: company.id } })
      if (parsed.data.allowances.length > 0) {
        await tx.allowance.createMany({
          data: parsed.data.allowances.map((allowance) => ({
            companyId: company.id,
            employeeId: existing.id,
            type: allowance.type,
            amount: toDecimal(allowance.amount),
            currency: allowance.currency,
            taxable: allowance.taxable ?? false,
            effectiveFrom: allowance.effectiveFrom,
            effectiveTo: allowance.effectiveTo ?? null,
          })),
        })
      }
    }

    if (parsed.data.pensionPillars) {
      await tx.pensionPillar.deleteMany({
        where: { employeeId: existing.id, companyId: company.id },
      })
      if (parsed.data.pensionPillars.length > 0) {
        await tx.pensionPillar.createMany({
          data: parsed.data.pensionPillars.map((pillar) => ({
            companyId: company.id,
            employeeId: existing.id,
            pillar: pillar.pillar,
            fundName: pillar.fundName ?? null,
            contributionRate: toDecimal(pillar.contributionRate ?? null),
            effectiveFrom: pillar.effectiveFrom,
            effectiveTo: pillar.effectiveTo ?? null,
          })),
        })
      }
    }

    if (parsed.data.contracts) {
      await tx.employmentContract.deleteMany({
        where: { employeeId: existing.id, companyId: company.id },
      })
      if (parsed.data.contracts.length > 0) {
        for (const contract of parsed.data.contracts) {
          const created = await tx.employmentContract.create({
            data: {
              companyId: company.id,
              employeeId: existing.id,
              contractCode: contract.contractCode ?? null,
              startedAt: contract.startedAt,
              endedAt: contract.endedAt ?? null,
              status: contract.status,
            },
          })

          if (contract.versions && contract.versions.length > 0) {
            await tx.employmentContractVersion.createMany({
              data: contract.versions.map((version) => ({
                companyId: company.id,
                contractId: created.id,
                version: version.version,
                effectiveFrom: version.effectiveFrom,
                effectiveTo: version.effectiveTo ?? null,
                roleTitle: version.roleTitle ?? null,
                employmentType: version.employmentType ?? null,
                hoursPerWeek: version.hoursPerWeek ?? null,
                salaryAmount: toDecimal(version.salaryAmount ?? null),
                salaryCurrency: version.salaryCurrency,
              })),
            })
          }
        }
      }
    }

    return tx.employee.update({
      where: { id: existing.id },
      data: {
        firstName: parsed.data.firstName ?? undefined,
        lastName: parsed.data.lastName ?? undefined,
        oib: parsed.data.oib === undefined ? undefined : (parsed.data.oib ?? null),
        dateOfBirth:
          parsed.data.dateOfBirth === undefined ? undefined : (parsed.data.dateOfBirth ?? null),
        email: parsed.data.email === undefined ? undefined : (parsed.data.email ?? null),
        phone: parsed.data.phone === undefined ? undefined : (parsed.data.phone ?? null),
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
  })

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, employee: serializeEmployee(employee) })
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  await requirePermission(user.id!, company.id, "person:delete")

  const { id } = await context.params

  setTenantContext({ companyId: company.id, userId: user.id! })

  const deleted = await db.employee.deleteMany({ where: { id, companyId: company.id } })

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
