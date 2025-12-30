export type RuleTableKey =
  | "VAT"
  | "MUNICIPALITY_INCOME_TAX"
  | "CONTRIBUTIONS"
  | "PER_DIEM"
  | "MILEAGE"
  | "JOPPD_CODEBOOK"

export interface VatRuleData {
  year: number
  lastVerified: string
  source: string
  standard: {
    rate: number
    label: string
    description?: string
  }
  reduced: Array<{
    rate: number
    label: string
    description?: string
  }>
}

export interface MunicipalityIncomeTaxEntry {
  postalCode: string
  city: string
  municipality: string
  county: string
  prirezRate: number
}

export interface MunicipalityIncomeTaxData {
  year: number
  lastVerified: string
  source: string
  entries: MunicipalityIncomeTaxEntry[]
}

export interface ContributionsRuleData {
  year: number
  lastVerified: string
  source: string
  rates: {
    MIO_I: {
      rate: number
      name: string
      nameLong?: string
      iban: string
      model: string
      pozivNaBroj: string
    }
    MIO_II: {
      rate: number
      name: string
      nameLong?: string
      iban: string
      model: string
      pozivNaBroj: string
    }
    HZZO: {
      rate: number
      name: string
      nameLong?: string
      iban: string
      model: string
      pozivNaBroj: string
    }
  }
  base: {
    minimum: number
    maximum: number
    description?: string
  }
  monthly: {
    mioI: number
    mioII: number
    hzzo: number
    total: number
  }
}

export interface PerDiemRuleData {
  year: number
  lastVerified: string
  source: string
  domestic: {
    rate: number
    unit: string
  }
  foreign: {
    rate: number | null
    unit: string
    note?: string
  }
}

export interface MileageRuleData {
  year: number
  lastVerified: string
  source: string
  rate: number
  unit: string
}

export interface JoppdCodebookEntry {
  code: string
  label: string
  maxAmount: number | null
  unit: string
  note?: string
}

export interface JoppdCodebookData {
  year: number
  lastVerified: string
  source: string
  entries: JoppdCodebookEntry[]
}

export type RuleDataByTableKey =
  | VatRuleData
  | MunicipalityIncomeTaxData
  | ContributionsRuleData
  | PerDiemRuleData
  | MileageRuleData
  | JoppdCodebookData

export type CalculationInputByTableKey =
  | {
      tableKey: "VAT"
      netAmount?: number
      rate?: number
      rateLabel?: string
    }
  | {
      tableKey: "MUNICIPALITY_INCOME_TAX"
      baseTax: number
      postalCode?: string
      municipality?: string
    }
  | {
      tableKey: "CONTRIBUTIONS"
      base?: number
    }
  | {
      tableKey: "PER_DIEM"
      days: number
      type?: "domestic" | "foreign"
    }
  | {
      tableKey: "MILEAGE"
      kilometers: number
    }
  | {
      tableKey: "JOPPD_CODEBOOK"
      code?: string
    }

export type CalculationRequest = CalculationInputByTableKey & {
  referenceDate?: string | Date
  ruleVersionId?: string
}

export interface CalculationResponse<T> {
  ruleVersionId: string
  ruleTableKey: RuleTableKey
  ruleVersion: {
    id: string
    version: string
    effectiveFrom: string
    effectiveUntil: string | null
    dataHash: string
  }
  result: T
}
