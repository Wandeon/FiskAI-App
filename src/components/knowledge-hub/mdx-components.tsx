// src/components/knowledge-hub/mdx-components.tsx
import { isValidElement, type ReactNode } from "react"
import { slugifyHeading } from "@/lib/knowledge-hub/slugify"
import { PersonalizedSection } from "./guide/PersonalizedSection"
import { FAQ } from "./guide/FAQ"
import { ContributionCalculator } from "./calculators/ContributionCalculator"
import { TaxCalculator } from "./calculators/TaxCalculator"
import { PaymentSlipGenerator } from "./calculators/PaymentSlipGenerator"

// Comparison components (Phase 1)
import { ComparisonTable } from "./comparison/ComparisonTable"
import { ComparisonCalculator } from "./comparison/ComparisonCalculator"
import { RecommendationCard } from "./comparison/RecommendationCard"
import { ComparisonCell } from "./comparison/ComparisonCell"
import { ComparisonRow } from "./comparison/ComparisonRow"

// Guide components (Phase 2)
import { VariantTabs, TabPanel } from "./guide/VariantTabs"
import { PDVCallout } from "./guide/PDVCallout"
import { QuickStatsBar } from "./guide/QuickStatsBar"
import { TableOfContents } from "./guide/TableOfContents"
import { ProsCons } from "./guide/ProsCons"

// New interactive components (Phase 3)
import { QuickDecisionQuiz } from "./comparison/QuickDecisionQuiz"
import { AccordionFAQ, Accordion } from "./guide/AccordionFAQ"
import { TLDRBox, QuickAnswer } from "./guide/TLDRBox"
import { ToolUpsellCard } from "./guide/ToolUpsellCard"
import { GuideUpsellSection } from "./guide/GuideUpsellSection"

// Content strategy components (Phase 3)
import { HowToSteps } from "@/components/content/HowToSteps"
import { Sources } from "@/components/content/Sources"
import { GlossaryCard } from "@/components/content/GlossaryCard"

// HTML element overrides
function H1(props: any) {
  return <h1 className="text-3xl font-bold mb-6" {...props} />
}

function nodeToText(node: ReactNode): string {
  if (node == null) return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(nodeToText).join("")
  if (isValidElement(node)) return nodeToText(node.props?.children)
  return ""
}

function H2(props: any) {
  const { children, id, ...rest } = props
  const resolvedId = id ?? slugifyHeading(nodeToText(children))
  return (
    <h2 id={resolvedId} className="scroll-mt-28 text-2xl font-semibold mt-8 mb-4" {...rest}>
      {children}
    </h2>
  )
}

function H3(props: any) {
  const { children, id, ...rest } = props
  const resolvedId = id ?? slugifyHeading(nodeToText(children))
  return (
    <h3 id={resolvedId} className="scroll-mt-28 text-xl font-medium mt-6 mb-3" {...rest}>
      {children}
    </h3>
  )
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
    <th
      className="border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2 text-left font-medium text-[var(--foreground)]"
      {...props}
    />
  )
}

function Td(props: any) {
  return (
    <td
      className="border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[var(--foreground)]"
      {...props}
    />
  )
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
  ComparisonCell,
  ComparisonRow,

  // Guide components
  VariantTabs,
  TabPanel,
  PDVCallout,
  QuickStatsBar,
  TableOfContents,
  ProsCons,

  // Interactive components (Phase 3)
  QuickDecisionQuiz,
  AccordionFAQ,
  Accordion,
  TLDRBox,
  QuickAnswer,
  ToolUpsellCard,
  GuideUpsellSection,

  // Content strategy components
  HowToSteps,
  Sources,
  GlossaryCard,

  h1: H1,
  h2: H2,
  h3: H3,
  table: Table,
  th: Th,
  td: Td,
}
