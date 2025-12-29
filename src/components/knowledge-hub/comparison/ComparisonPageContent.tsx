// src/components/knowledge-hub/comparison/ComparisonPageContent.tsx

import Link from "next/link"
import { MDXRemote } from "next-mdx-remote/rsc"
import { ComparisonContent, getGuideBySlug } from "@/lib/knowledge-hub/mdx"
import { mdxComponents } from "@/components/knowledge-hub/mdx-components"
import { ComparisonTable } from "./ComparisonTable"
import { ComparisonCalculator } from "./ComparisonCalculator"
import { RecommendationCard } from "./RecommendationCard"
import { GetStartedCTA } from "./GetStartedCTA"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { HoverScale } from "@/components/ui/motion/HoverScale"
import type { ComponentProps } from "react"

interface ComparisonPageContentProps {
  comparison: ComparisonContent
  searchParams: { [key: string]: string | undefined }
}

function inferHighlightedColumn({
  comparisonSlug,
  compareIds,
  searchParams,
}: {
  comparisonSlug: string
  compareIds: string[]
  searchParams: { [key: string]: string | undefined }
}): string | undefined {
  const manual =
    searchParams.preporuka ??
    searchParams.highlight ??
    searchParams.recommend ??
    searchParams.preporuceno

  if (manual && compareIds.includes(manual)) return manual

  if (comparisonSlug === "pocinjem-solo") {
    const prihod = searchParams.prihod
    const djelatnost = searchParams.djelatnost

    if (djelatnost === "it" && compareIds.includes("freelancer")) return "freelancer"
    if (prihod === "low") {
      return compareIds.find((id) => id === "pausalni" || id.startsWith("pausalni-"))
    }
    if (prihod === "medium" && compareIds.includes("obrt-dohodak")) return "obrt-dohodak"
  }

  if (comparisonSlug === "firma") {
    const tip = searchParams.tip
    if (tip === "viseclano" && compareIds.includes("doo")) return "doo"
  }

  if (comparisonSlug === "dodatni-prihod") {
    const djelatnost = searchParams.djelatnost
    if (djelatnost === "kreativa" && compareIds.includes("autorski")) return "autorski"
  }

  return undefined
}

function mapCompareToGuideSlug(compareId: string): string | null {
  if (compareId === "pausalni" || compareId.startsWith("pausalni-")) return "pausalni-obrt"
  if (compareId === "obrt-dohodak") return "obrt-dohodak"
  if (compareId === "jdoo" || compareId === "doo") return "doo"
  if (compareId === "freelancer") return "freelancer"
  return null
}

export function ComparisonPageContent({ comparison, searchParams }: ComparisonPageContentProps) {
  const { frontmatter, content } = comparison
  const guideSlugs = Array.from(
    new Set(frontmatter.compares.map(mapCompareToGuideSlug).filter((s): s is string => !!s))
  )
  const guides = guideSlugs.map((slug) => getGuideBySlug(slug)).filter(Boolean)
  const missingDeepDiveCount = frontmatter.compares.filter(
    (id) => !mapCompareToGuideSlug(id)
  ).length

  const highlightedColumn = inferHighlightedColumn({
    comparisonSlug: comparison.slug,
    compareIds: frontmatter.compares,
    searchParams,
  })
  const ComparisonTableWithColumns = (props: ComponentProps<typeof ComparisonTable>) => (
    <ComparisonTable
      {...props}
      compareIds={frontmatter.compares}
      highlightedColumn={highlightedColumn}
    />
  )

  return (
    <SectionBackground>
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-white/60 mb-6">
          <Link href="/" className="hover:text-white/90">
            Početna
          </Link>
          <span className="px-2">/</span>
          <Link href="/baza-znanja" className="hover:text-white/90">
            Baza znanja
          </Link>
          <span className="px-2">/</span>
          <span className="text-white/90">{frontmatter.title}</span>
        </nav>

        {/* Hero */}
        <header className="mb-8">
          <h1 className="text-display text-4xl font-semibold md:text-5xl">{frontmatter.title}</h1>
          <p className="mt-4 text-lg text-white/60">{frontmatter.description}</p>
        </header>

        {/* MDX Content (includes ComparisonTable, Calculator, etc.) */}
        <article className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-white/80 prose-a:text-accent prose-strong:text-white">
          <MDXRemote
            source={content}
            components={{
              ...mdxComponents,
              ComparisonTable: ComparisonTableWithColumns,
              ComparisonCalculator,
              RecommendationCard,
            }}
          />
        </article>

        {/* Deep-dive links */}
        <section className="mt-12 border-t border-white/10 pt-8">
          <h2 className="text-xl font-semibold mb-4">Saznajte više</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {guides.map((guide) => (
              <HoverScale key={guide!.slug}>
                <Link href={`/vodic/${guide!.slug}`} className="block h-full">
                  <GlassCard className="h-full p-4">
                    <span className="font-medium">{guide!.frontmatter.title}</span>
                    <span className="block text-sm text-white/60">
                      {guide!.frontmatter.description}
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-accent">
                      Otvori vodič →
                    </span>
                  </GlassCard>
                </Link>
              </HoverScale>
            ))}
            {missingDeepDiveCount > 0 && (
              <HoverScale>
                <Link href="/wizard" className="block h-full">
                  <GlassCard className="h-full p-4 border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10">
                    <span className="font-medium">Ne možete naći svoj slučaj?</span>
                    <span className="block text-sm text-white/60">
                      Pokrenite čarobnjak i dobijte personaliziranu preporuku.
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-accent">
                      Pokreni čarobnjak →
                    </span>
                  </GlassCard>
                </Link>
              </HoverScale>
            )}
          </div>
        </section>

        {/* CTA to get started */}
        <GetStartedCTA />
      </div>
    </SectionBackground>
  )
}
