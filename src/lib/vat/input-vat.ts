import type { Company, Expense, ExpenseCategory, ExpenseLine } from "@prisma/client"
import type { TransactionClient } from "@/lib/db"
import { parseAppliesWhen, evaluateAppliesWhen } from "@/lib/regulatory-truth/dsl/applies-when"

type VatInputRuleReference = {
  id: string
  conceptSlug: string
  titleHr: string | null
}

type VatInputRuleResult = {
  references: VatInputRuleReference[]
}

const VAT_INPUT_RULE_PREFIXES = ["vat-input", "vat-deductibility"]

function mapCompanyEntityType(legalForm?: string | null): {
  type: "OBRT" | "DOO" | "JDOO" | "UDRUGA" | "OTHER"
  obrtSubtype?: "PAUSALNI" | "DOHODAS" | "DOBITAS"
} {
  if (!legalForm) return { type: "OTHER" }

  if (legalForm.startsWith("OBRT")) {
    if (legalForm.includes("PAUSAL")) return { type: "OBRT", obrtSubtype: "PAUSALNI" }
    if (legalForm.includes("VAT")) return { type: "OBRT", obrtSubtype: "DOHODAS" }
    if (legalForm.includes("REAL")) return { type: "OBRT", obrtSubtype: "DOHODAS" }
    return { type: "OBRT" }
  }

  if (legalForm === "JDOO") return { type: "JDOO" }
  if (legalForm === "DOO") return { type: "DOO" }

  return { type: "OTHER" }
}

function buildVatInputContext(
  company: Company,
  expense: Expense,
  line: ExpenseLine,
  category?: ExpenseCategory | null
) {
  const entity = mapCompanyEntityType(company.legalForm)
  return {
    asOf: expense.date.toISOString(),
    entity: {
      type: entity.type,
      obrtSubtype: entity.obrtSubtype,
      vat: { status: company.isVatPayer ? ("IN_VAT" as const) : ("OUTSIDE_VAT" as const) },
      location: { country: "HR" as const },
    },
    txn: {
      kind: "PURCHASE" as const,
      amount: Number(line.totalAmount),
      currency: expense.currency === "EUR" ? ("EUR" as const) : undefined,
      itemCategory: category?.code ?? category?.name ?? expense.categoryId,
      date: expense.date.toISOString(),
    },
  }
}

export async function evaluateVatInputRules(
  tx: TransactionClient,
  company: Company,
  expense: Expense,
  line: ExpenseLine,
  category?: ExpenseCategory | null
): Promise<VatInputRuleResult> {
  const rules = await tx.regulatoryRule.findMany({
    where: {
      status: "PUBLISHED",
      OR: VAT_INPUT_RULE_PREFIXES.map((prefix) => ({ conceptSlug: { startsWith: prefix } })),
    },
    select: {
      id: true,
      conceptSlug: true,
      titleHr: true,
      appliesWhen: true,
      effectiveFrom: true,
      effectiveUntil: true,
    },
  })

  const context = buildVatInputContext(company, expense, line, category)
  const asOfDate = new Date(context.asOf)
  const references: VatInputRuleReference[] = []

  for (const rule of rules) {
    const from = new Date(rule.effectiveFrom)
    const until = rule.effectiveUntil ? new Date(rule.effectiveUntil) : null
    if (from > asOfDate || (until && until < asOfDate)) continue

    try {
      const predicate = parseAppliesWhen(rule.appliesWhen)
      if (evaluateAppliesWhen(predicate, context)) {
        references.push({
          id: rule.id,
          conceptSlug: rule.conceptSlug,
          titleHr: rule.titleHr,
        })
      }
    } catch (error) {
      console.warn(`[vat-input] Invalid appliesWhen for rule ${rule.id}:`, error)
    }
  }

  return { references }
}

export function calculateVatInputAmounts(
  expense: Expense,
  line: ExpenseLine,
  references: VatInputRuleReference[] = []
) {
  const vatAmount = Number(line.vatAmount)

  if (!expense.vatDeductible) {
    return {
      deductibleVatAmount: 0,
      nonDeductibleVatAmount: vatAmount,
    }
  }

  // Check for partial deduction rules
  const has50PercentRule = references.some(
    (r) => r.conceptSlug.includes("50-percent") || r.conceptSlug.includes("deductibility-50")
  )

  if (has50PercentRule) {
    const deductible = vatAmount * 0.5
    const nonDeductible = vatAmount - deductible
    return {
      deductibleVatAmount: deductible,
      nonDeductibleVatAmount: nonDeductible,
    }
  }

  return {
    deductibleVatAmount: vatAmount,
    nonDeductibleVatAmount: 0,
  }
}
