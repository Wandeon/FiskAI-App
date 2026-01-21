import { Prisma } from "@prisma/client"

// Types inlined from removed fiscal-rules module
// These define the shape of rule data fetched from Intelligence API

export interface ContributionsRuleData {
  rates: {
    MIO_I: { rate: number }
    MIO_II: { rate: number }
    HZZO: { rate: number }
  }
}

export interface IncomeTaxRuleData {
  personalAllowance: number
  brackets: Array<{
    min: number
    max: number | null
    rate: number
  }>
}

export interface MunicipalityIncomeTaxData {
  entries: Array<{
    postalCode: string
    municipality: string
    prirezRate: number
  }>
}

const Decimal = Prisma.Decimal

function d(value: number): Prisma.Decimal {
  return new Decimal(value.toString())
}

function money(value: Prisma.Decimal): string {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
}

export function computeDirectorSalaryPayroll(params: {
  grossAmount: string
  postalCode: string
  contributions: ContributionsRuleData
  incomeTax: IncomeTaxRuleData
  municipality: MunicipalityIncomeTaxData
}) {
  const gross = new Decimal(params.grossAmount)

  const mio1 = gross
    .mul(d(params.contributions.rates.MIO_I.rate))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  const mio2 = gross
    .mul(d(params.contributions.rates.MIO_II.rate))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  const hzzo = gross
    .mul(d(params.contributions.rates.HZZO.rate))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  const allowance = d(params.incomeTax.personalAllowance)
  const taxableMonthly = gross.sub(mio1).sub(mio2).sub(allowance)
  const taxableMonthlyClamped = taxableMonthly.greaterThan(0) ? taxableMonthly : new Decimal(0)
  const taxableAnnual = taxableMonthlyClamped.mul(new Decimal("12"))

  const bracket =
    params.incomeTax.brackets.find((b) => {
      const min = d(b.min)
      const max = b.max === null ? null : d(b.max)
      return (
        taxableAnnual.greaterThanOrEqualTo(min) &&
        (max === null || taxableAnnual.lessThanOrEqualTo(max))
      )
    }) ?? null

  if (!bracket) {
    throw new Error("No income tax bracket found")
  }

  const baseTax = taxableMonthlyClamped
    .mul(d(bracket.rate))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  const municipalityEntry =
    params.municipality.entries.find((entry) => entry.postalCode === params.postalCode) ?? null

  if (!municipalityEntry) {
    throw new Error(`Municipality not found for postal code ${params.postalCode}`)
  }

  const surtax = baseTax
    .mul(d(municipalityEntry.prirezRate))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  const totalTax = baseTax.add(surtax).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  const net = gross.sub(mio1).sub(mio2).sub(totalTax).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  return {
    grossAmount: money(gross),
    netAmount: money(net),
    employeeContributions: {
      mio1: money(mio1),
      mio2: money(mio2),
      total: money(mio1.add(mio2)),
    },
    employerContributions: {
      hzzo: money(hzzo),
    },
    incomeTaxBase: money(taxableMonthlyClamped),
    tax: {
      baseTax: money(baseTax),
      surtax: money(surtax),
      totalTax: money(totalTax),
      bracket: {
        min: bracket.min,
        max: bracket.max,
        rate: bracket.rate,
      },
      municipality: {
        postalCode: municipalityEntry.postalCode,
        municipality: municipalityEntry.municipality,
        prirezRate: municipalityEntry.prirezRate,
      },
    },
  }
}
