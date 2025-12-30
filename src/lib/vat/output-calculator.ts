import { Prisma, RegulatoryRule } from "@prisma/client"
import { resolveRulePrecedence } from "@/lib/regulatory-truth/agents/arbiter"
import { db } from "@/lib/db"
import { getVatRateFromCategory } from "@/lib/validations/product"

const VAT_CATEGORY_TO_CONCEPT_ID: Record<string, string> = {
  S: "pdv-standard-rate",
  AA: "pdv-reduced-rate",
  E: "pdv-zero-rate",
  Z: "pdv-zero-rate",
  O: "pdv-zero-rate",
}

const Decimal = Prisma.Decimal

function parseVatRate(rule: RegulatoryRule | null, fallbackRate: number): number {
  if (!rule) return fallbackRate
  const parsed = Number(rule.value)
  return Number.isFinite(parsed) ? parsed : fallbackRate
}

export async function resolveVatRuleForCategory(
  vatCategory: string,
  issueDate: Date
): Promise<RegulatoryRule | null> {
  const conceptId = VAT_CATEGORY_TO_CONCEPT_ID[vatCategory]
  if (!conceptId) return null

  const rules = await db.regulatoryRule.findMany({
    where: {
      conceptId,
      status: "PUBLISHED",
      effectiveFrom: { lte: issueDate },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: issueDate } }],
    },
  })

  if (rules.length === 0) return null
  if (rules.length === 1) return rules[0]

  const precedence = await resolveRulePrecedence(rules.map((rule) => rule.id))
  return rules.find((rule) => rule.id === precedence.winningRuleId) ?? rules[0]
}

export async function buildVatLineTotals(
  line: {
    description: string
    quantity: number
    unit: string
    unitPrice: number
    vatRate?: number
    vatCategory?: string
  },
  issueDate: Date
): Promise<{
  lineNumber?: number
  description: string
  quantity: Prisma.Decimal
  unit: string
  unitPrice: Prisma.Decimal
  netAmount: Prisma.Decimal
  vatRate: Prisma.Decimal
  vatCategory: string
  vatAmount: Prisma.Decimal
  vatRuleId?: string | null
}> {
  const vatCategory = line.vatCategory || "S"
  const fallbackRate = line.vatRate ?? getVatRateFromCategory(vatCategory)
  const rule = await resolveVatRuleForCategory(vatCategory, issueDate)
  const resolvedRate = parseVatRate(rule, fallbackRate)

  const quantity = new Decimal(line.quantity)
  const unitPrice = new Decimal(line.unitPrice)
  const vatRate = new Decimal(resolvedRate)
  const netAmount = quantity.mul(unitPrice)
  const vatAmount = netAmount.mul(vatRate).div(100)

  return {
    description: line.description,
    quantity,
    unit: line.unit,
    unitPrice,
    netAmount,
    vatRate,
    vatCategory,
    vatAmount,
    vatRuleId: rule?.id ?? null,
  }
}
