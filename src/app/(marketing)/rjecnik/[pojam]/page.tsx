import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getGlossaryBySlug, getGlossarySlugs } from "@/lib/knowledge-hub/mdx"
import { AIAnswerBlock } from "@/components/content/ai-answer-block"
import { FAQ } from "@/components/content/FAQ"
import { Sources } from "@/components/content/Sources"
import { JsonLd } from "@/components/seo/JsonLd"
import { generateDefinedTermSchema, generateBreadcrumbSchema } from "@/lib/schema"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

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
    alternates: {
      canonical: `${BASE_URL}/rjecnik/${pojam}`,
    },
  }
}

export default async function GlossaryTermPage({ params }: Props) {
  const { pojam } = await params
  const term = getGlossaryBySlug(pojam)

  if (!term) notFound()

  const { frontmatter } = term
  const url = `https://fiskai.hr/rjecnik/${pojam}`

  const breadcrumbs = [
    { name: "Baza znanja", url: "https://fiskai.hr/baza-znanja" },
    { name: "Rječnik", url: "https://fiskai.hr/rjecnik" },
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

      <SectionBackground variant="gradient">
        <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
          <nav className="mb-6 text-sm text-white/60">
            <Link href="/baza-znanja" className="hover:text-white">
              Baza znanja
            </Link>{" "}
            <span>/</span>{" "}
            <Link href="/rjecnik" className="hover:text-white">
              Rječnik
            </Link>{" "}
            <span>/</span> <span className="text-white">{frontmatter.term}</span>
          </nav>

          <Link
            href="/rjecnik"
            className="mb-6 inline-flex items-center gap-2 text-sm text-cyan-400 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Svi pojmovi
          </Link>

          <h1 className="text-3xl font-bold text-white mb-6 md:text-4xl">{frontmatter.term}</h1>

          <AIAnswerBlock
            answerId={`glossary:${pojam}:v1`}
            type="definitional"
            confidence="high"
            contentType="glossary"
            lastUpdated={frontmatter.lastUpdated || new Date().toISOString().split("T")[0]}
            bluf={frontmatter.shortDefinition}
          >
            {/* Extended definition content */}
            {frontmatter.appearsIn && frontmatter.appearsIn.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold">Gdje se pojavljuje</h3>
                <ul className="list-inside list-disc space-y-1 mt-2">
                  {frontmatter.appearsIn.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {frontmatter.relatedTerms && frontmatter.relatedTerms.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold">Povezani pojmovi</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {frontmatter.relatedTerms.map((related: string, i: number) => (
                    <Link
                      key={i}
                      href={`/rjecnik/${related}`}
                      className="rounded-full bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
                    >
                      {related}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </AIAnswerBlock>

          {frontmatter.faq && <FAQ items={frontmatter.faq} />}

          <Sources
            sources={frontmatter.sources}
            lastUpdated={frontmatter.lastUpdated}
            lastReviewed={frontmatter.lastReviewed}
            reviewer={frontmatter.reviewer}
          />
        </div>
      </SectionBackground>
    </>
  )
}
