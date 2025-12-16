import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getGlossaryBySlug, getGlossarySlugs } from "@/lib/knowledge-hub/mdx"
import { GlossaryCard } from "@/components/content/GlossaryCard"
import { FAQ } from "@/components/content/FAQ"
import { Sources } from "@/components/content/Sources"
import { JsonLd } from "@/components/seo/JsonLd"
import { generateDefinedTermSchema, generateBreadcrumbSchema } from "@/lib/schema"

interface Props {
  params: Promise<{ pojam: string }>
}

export async function generateStaticParams() {
  const slugs = getGlossarySlugs()
  return slugs.map((pojam) => ({ pojam }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pojam } = await params
  const term = getGlossaryBySlug(pojam)
  if (!term) return {}

  return {
    title: `${term.frontmatter.term} - Što je? | FiskAI Rječnik`,
    description: term.frontmatter.shortDefinition,
  }
}

export default async function GlossaryTermPage({ params }: Props) {
  const { pojam } = await params
  const term = getGlossaryBySlug(pojam)

  if (!term) notFound()

  const { frontmatter } = term
  const url = `https://fisk.ai/rjecnik/${pojam}`

  const breadcrumbs = [
    { name: "Baza znanja", url: "https://fisk.ai/baza-znanja" },
    { name: "Rječnik", url: "https://fisk.ai/rjecnik" },
    { name: frontmatter.term, url },
  ]

  return (
    <>
      <JsonLd
        schemas={[
          generateBreadcrumbSchema(breadcrumbs),
          generateDefinedTermSchema(frontmatter.term, frontmatter.shortDefinition, url),
        ]}
      />

      <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
        <nav className="mb-6 text-sm text-[var(--muted)]">
          <Link href="/baza-znanja" className="hover:text-[var(--foreground)]">
            Baza znanja
          </Link>{" "}
          <span>/</span>{" "}
          <Link href="/rjecnik" className="hover:text-[var(--foreground)]">
            Rječnik
          </Link>{" "}
          <span>/</span> <span className="text-[var(--foreground)]">{frontmatter.term}</span>
        </nav>

        <Link
          href="/rjecnik"
          className="mb-6 inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Svi pojmovi
        </Link>

        <GlossaryCard
          term={frontmatter.term}
          definition={frontmatter.shortDefinition}
          relatedTerms={frontmatter.relatedTerms}
        />

        {/* Extended content from MDX would go here */}

        {frontmatter.appearsIn && frontmatter.appearsIn.length > 0 && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="mb-3 font-semibold text-slate-900">Gdje se pojavljuje</h3>
            <ul className="list-inside list-disc space-y-1 text-slate-600">
              {frontmatter.appearsIn.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {frontmatter.faq && <FAQ items={frontmatter.faq} />}

        <Sources
          sources={frontmatter.sources}
          lastUpdated={frontmatter.lastUpdated}
          lastReviewed={frontmatter.lastReviewed}
          reviewer={frontmatter.reviewer}
        />
      </div>
    </>
  )
}
