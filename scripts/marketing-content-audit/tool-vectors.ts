import { formatCurrency, THRESHOLDS } from "../../src/lib/fiscal-data"
import { calculateContributions } from "../../src/lib/knowledge-hub/calculations"

export type ToolAction =
  | { type: "fill"; selector: string; value: string }
  | { type: "click"; selector: string }
  | { type: "select"; selector: string; value: string }

export interface ToolVector {
  id: string
  route: string
  expectedTexts: string[]
  actions?: ToolAction[]
  expectedAfter?: string[]
  notes?: string
}

const currencyText = (value: number) => formatCurrency(value, { showUnit: false })

const contributionBreakdown = calculateContributions()

export const TOOL_VECTORS: ToolVector[] = [
  {
    id: "pdv-threshold",
    route: "/alati/pdv-kalkulator",
    expectedTexts: [currencyText(THRESHOLDS.pdv.value)],
    notes: "Checks that the PDV threshold value is rendered from fiscal-data.",
  },
  {
    id: "tax-calculator",
    route: "/alati/kalkulator-poreza",
    expectedTexts: [currencyText(THRESHOLDS.pausalni.value)],
    notes: "Ensures pauzalni max threshold appears and matches fiscal-data.",
  },
  {
    id: "contribution-calculator",
    route: "/alati/kalkulator-doprinosa",
    expectedTexts: [
      currencyText(contributionBreakdown.mioI),
      currencyText(contributionBreakdown.hzzo),
      currencyText(contributionBreakdown.total),
    ],
    notes: "Validates monthly contribution outputs rendered from fiscal-data.",
  },
  {
    id: "oib-validator",
    route: "/alati/oib-validator",
    expectedTexts: [],
    actions: [
      { type: "fill", selector: "#oib-input", value: "12345678903" },
      { type: "click", selector: "button:has-text(\"Provjeri\")" },
    ],
    expectedAfter: ["OIB je valjan"],
    notes: "Confirms OIB validator accepts a known valid checksum.",
  },
]
