import type { JoppdItem, PayrollCalculationResult } from "./types"

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  if (value && typeof value === "object" && "toNumber" in value) {
    return Number((value as { toNumber: () => number }).toNumber())
  }
  return 0
}

type PayoutLineLike = {
  id: string
  employeeName: string
  employeeOib?: string | null
  grossAmount: unknown
  netAmount: unknown
  taxAmount: unknown
}

export function buildJoppdItems(
  periodFrom: Date,
  periodTo: Date,
  lines: PayoutLineLike[],
  calculationByLine: Map<string, PayrollCalculationResult>
): JoppdItem[] {
  return lines.map((line) => {
    const calculated = calculationByLine.get(line.id)

    return {
      employeeOib: line.employeeOib ?? undefined,
      employeeName: line.employeeName,
      periodFrom,
      periodTo,
      grossAmount: toNumber(calculated?.grossAmount ?? line.grossAmount),
      netAmount: toNumber(calculated?.netAmount ?? line.netAmount),
      taxAmount: toNumber(calculated?.taxAmount ?? line.taxAmount),
      employerContributions: calculated?.employerContributions,
      employeeContributions: calculated?.employeeContributions,
    }
  })
}
