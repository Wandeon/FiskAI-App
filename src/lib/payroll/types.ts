export type EmploymentSnapshot = {
  id: string
  employeeName: string
  employeeOib?: string
  employeeIban?: string
  contractType?: string
  baseGrossAmount?: number
  metadata?: Record<string, unknown>
}

export type PayrollRulesEngineSnapshot = {
  rulesetId: string
  evaluatedAt: string
  version?: string
  metadata?: Record<string, unknown>
}

export type PayrollCalculationInput = {
  payoutId: string
  payoutLineId?: string
  periodFrom: Date
  periodTo: Date
  currency: string
  employment: EmploymentSnapshot
  overrides?: Record<string, unknown>
}

export type PayrollCalculationResult = {
  grossAmount: number
  netAmount: number
  taxAmount: number
  employerContributions?: number
  employeeContributions?: number
  lineItems?: Array<{ code: string; label: string; amount: number }>
}

export type JoppdItem = {
  employeeOib?: string
  employeeName: string
  periodFrom: Date
  periodTo: Date
  grossAmount: number
  netAmount: number
  taxAmount: number
  employerContributions?: number
  employeeContributions?: number
}

export type BankPaymentInstruction = {
  recipientName: string
  recipientIban?: string
  amount: number
  currency: string
  reference?: string
  description?: string
}
