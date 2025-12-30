export type TravelRuleReference = {
  ruleVersionId: string
  rateAmount: number
  capAmount: number
  currency: string
}

export type TravelRuleApplication = {
  ruleVersionId: string
  rateAmount: number
  capAmount: number
  quantity: number
  calculatedAmount: number
  cappedAmount: number
  capApplied: boolean
  currency: string
}

type RuleInput = {
  quantity: number
  rule: TravelRuleReference
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

export function applyTravelRule({ quantity, rule }: RuleInput): TravelRuleApplication {
  const calculatedAmount = roundCurrency(quantity * rule.rateAmount)
  const cappedAmount = roundCurrency(Math.min(calculatedAmount, rule.capAmount))

  return {
    ruleVersionId: rule.ruleVersionId,
    rateAmount: rule.rateAmount,
    capAmount: rule.capAmount,
    quantity,
    calculatedAmount,
    cappedAmount,
    capApplied: cappedAmount !== calculatedAmount,
    currency: rule.currency,
  }
}
