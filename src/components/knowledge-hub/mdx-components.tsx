// src/components/knowledge-hub/mdx-components.tsx
import { PersonalizedSection } from "./guide/PersonalizedSection"
import { FAQ } from "./guide/FAQ"
import { ContributionCalculator } from "./calculators/ContributionCalculator"
import { TaxCalculator } from "./calculators/TaxCalculator"
import { PaymentSlipGenerator } from "./calculators/PaymentSlipGenerator"

// Comparison components (Phase 1)
import { ComparisonTable } from "./comparison/ComparisonTable"
import { ComparisonCalculator } from "./comparison/ComparisonCalculator"
import { RecommendationCard } from "./comparison/RecommendationCard"

// Guide components (Phase 2)
import { VariantTabs, TabPanel } from "./guide/VariantTabs"
import { PDVCallout } from "./guide/PDVCallout"
import { QuickStatsBar } from "./guide/QuickStatsBar"
import { TableOfContents } from "./guide/TableOfContents"

// HTML element overrides
function H1(props: any) {
  return <h1 className="text-3xl font-bold mb-6" {...props} />
}

function H2(props: any) {
  return <h2 className="text-2xl font-semibold mt-8 mb-4" {...props} />
}

function H3(props: any) {
  return <h3 className="text-xl font-medium mt-6 mb-3" {...props} />
}

function Table(props: any) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full border-collapse" {...props} />
    </div>
  )
}

function Th(props: any) {
  return (
    <th className="border border-gray-300 bg-gray-50 px-4 py-2 text-left font-medium" {...props} />
  )
}

function Td(props: any) {
  return <td className="border border-gray-300 px-4 py-2" {...props} />
}

export const mdxComponents = {
  PersonalizedSection,
  FAQ,
  ContributionCalculator,
  TaxCalculator,
  PaymentSlipGenerator,

  // Comparison components
  ComparisonTable,
  ComparisonCalculator,
  RecommendationCard,

  // Guide components
  VariantTabs,
  TabPanel,
  PDVCallout,
  QuickStatsBar,
  TableOfContents,

  h1: H1,
  h2: H2,
  h3: H3,
  table: Table,
  th: Th,
  td: Td,
}
