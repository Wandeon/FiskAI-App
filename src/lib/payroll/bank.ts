import type { BankPaymentInstruction, PayrollCalculationResult } from "./types"

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
  employeeIban?: string | null
  netAmount: unknown
  currency: string
}

export function buildBankInstructions(
  lines: PayoutLineLike[],
  calculationByLine: Map<string, PayrollCalculationResult>
): BankPaymentInstruction[] {
  return lines.map((line) => {
    const calculated = calculationByLine.get(line.id)
    const netAmount = calculated?.netAmount ?? line.netAmount

    return {
      recipientName: line.employeeName,
      recipientIban: line.employeeIban ?? undefined,
      amount: toNumber(netAmount),
      currency: line.currency,
      description: "Payroll payout",
    }
  })
}
