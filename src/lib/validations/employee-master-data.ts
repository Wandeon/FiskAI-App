import { z } from "zod"
import {
  AllowanceType,
  DependentRelation,
  EmploymentContractStatus,
  EmploymentType,
  PensionPillarType,
} from "@prisma/client"

// Base schema without refinement for extending (Zod 4 breaking change)
const dateRangeBaseSchema = z.object({
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
})

// Refinement function to apply after extending
function withDateRangeValidation<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.refine(
    (data) => {
      const d = data as { effectiveFrom: Date; effectiveTo?: Date | null }
      return !d.effectiveTo || d.effectiveFrom <= d.effectiveTo
    },
    {
      message: "effectiveFrom must be before or equal to effectiveTo",
      path: ["effectiveTo"],
    }
  )
}

export const employeeRoleSchema = withDateRangeValidation(
  dateRangeBaseSchema.extend({
    title: z.string().min(1, "Role title is required"),
    description: z.string().optional().nullable(),
  })
)

export const dependentSchema = withDateRangeValidation(
  dateRangeBaseSchema.extend({
    fullName: z.string().min(2, "Dependent full name is required"),
    relation: z.nativeEnum(DependentRelation),
    birthDate: z.coerce.date().optional().nullable(),
    oib: z.string().optional().nullable(),
    isDisabled: z.boolean().optional().default(false),
  })
)

export const allowanceSchema = withDateRangeValidation(
  dateRangeBaseSchema.extend({
    type: z.nativeEnum(AllowanceType),
    amount: z.coerce.number().min(0),
    currency: z.string().default("EUR"),
    taxable: z.boolean().optional().default(false),
  })
)

export const pensionPillarSchema = withDateRangeValidation(
  dateRangeBaseSchema.extend({
    pillar: z.nativeEnum(PensionPillarType),
    fundName: z.string().optional().nullable(),
    contributionRate: z.coerce.number().min(0).max(100).optional().nullable(),
  })
)

export const employmentContractVersionSchema = withDateRangeValidation(
  dateRangeBaseSchema.extend({
    version: z.coerce.number().int().min(1),
    roleTitle: z.string().optional().nullable(),
    employmentType: z.nativeEnum(EmploymentType).optional().nullable(),
    hoursPerWeek: z.coerce.number().int().min(1).max(168).optional().nullable(),
    salaryAmount: z.coerce.number().min(0).optional().nullable(),
    salaryCurrency: z.string().default("EUR"),
  })
)

export const employmentContractSchema = z
  .object({
    contractCode: z.string().optional().nullable(),
    startedAt: z.coerce.date(),
    endedAt: z.coerce.date().optional().nullable(),
    status: z.nativeEnum(EmploymentContractStatus).optional(),
    versions: z.array(employmentContractVersionSchema).optional(),
  })
  .refine((data) => !data.endedAt || data.startedAt <= data.endedAt, {
    message: "startedAt must be before or equal to endedAt",
    path: ["endedAt"],
  })

export const employeeMasterDataSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  oib: z.string().optional().nullable(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  roles: z.array(employeeRoleSchema).optional(),
  contracts: z.array(employmentContractSchema).optional(),
  dependents: z.array(dependentSchema).optional(),
  allowances: z.array(allowanceSchema).optional(),
  pensionPillars: z.array(pensionPillarSchema).optional(),
})

export const employeeMasterDataUpdateSchema = employeeMasterDataSchema.partial()

type DateRange = {
  effectiveFrom: Date
  effectiveTo?: Date | null
}

function ensureNoOverlap<T>(items: T[], label: string, range: (item: T) => DateRange) {
  const sorted = [...items].sort(
    (a, b) => range(a).effectiveFrom.getTime() - range(b).effectiveFrom.getTime()
  )

  for (let index = 0; index < sorted.length; index += 1) {
    const current = range(sorted[index])
    if (current.effectiveTo === null || current.effectiveTo === undefined) {
      if (index < sorted.length - 1) {
        throw new Error(`${label} cannot be open-ended before another entry`)
      }
      continue
    }

    const next = sorted[index + 1]
    if (!next) {
      continue
    }

    const nextRange = range(next)
    if (current.effectiveTo >= nextRange.effectiveFrom) {
      throw new Error(`${label} periods cannot overlap`)
    }
  }
}

export function validateEmployeeMasterData(
  input: z.infer<typeof employeeMasterDataSchema> | z.infer<typeof employeeMasterDataUpdateSchema>
) {
  if (input.roles && input.roles.length > 1) {
    ensureNoOverlap(input.roles, "Employee role", (role) => ({
      effectiveFrom: role.effectiveFrom,
      effectiveTo: role.effectiveTo,
    }))
  }

  if (input.contracts && input.contracts.length > 1) {
    ensureNoOverlap(input.contracts, "Employment contract", (contract) => ({
      effectiveFrom: contract.startedAt,
      effectiveTo: contract.endedAt ?? null,
    }))
  }

  if (input.contracts) {
    for (const contract of input.contracts) {
      if (contract.versions && contract.versions.length > 0) {
        ensureNoOverlap(contract.versions, "Contract version", (version) => ({
          effectiveFrom: version.effectiveFrom,
          effectiveTo: version.effectiveTo,
        }))

        for (const version of contract.versions) {
          if (version.effectiveFrom < contract.startedAt) {
            throw new Error("Contract version effectiveFrom must be within contract period")
          }
          if (contract.endedAt && version.effectiveTo && version.effectiveTo > contract.endedAt) {
            throw new Error("Contract version effectiveTo must be within contract period")
          }
        }
      }
    }
  }

  if (input.pensionPillars && input.pensionPillars.length > 1) {
    const grouped = new Map<PensionPillarType, typeof input.pensionPillars>()
    for (const pillar of input.pensionPillars) {
      const list = grouped.get(pillar.pillar) ?? []
      list.push(pillar)
      grouped.set(pillar.pillar, list)
    }

    for (const [pillarType, pillars] of grouped.entries()) {
      if (pillars.length > 1) {
        ensureNoOverlap(pillars, `Pension pillar ${pillarType}`, (pillar) => ({
          effectiveFrom: pillar.effectiveFrom,
          effectiveTo: pillar.effectiveTo,
        }))
      }
    }
  }
}

export type EmployeeMasterDataInput = z.infer<typeof employeeMasterDataSchema>
