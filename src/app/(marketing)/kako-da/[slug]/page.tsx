import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getHowToBySlug, getHowToSlugs } from "@/lib/knowledge-hub/mdx"
import { FAQ } from "@/components/content/FAQ"
import { Sources } from "@/components/content/Sources"
import { JsonLd } from "@/components/seo/JsonLd"
import { generateBreadcrumbSchema } from "@/lib/schema"
import { MDXRemote } from "next-mdx-remote/rsc"
import { mdxComponents } from "@/components/knowledge-hub/mdx-components"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { NextSteps } from "@/components/knowledge-hub/NextSteps"
import { AIAnswerBlock } from "@/components/content/ai-answer-block"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = getHowToSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const howto = getHowToBySlug(slug)
  if (!howto) return {}

  return {
    title: `${howto.frontmatter.title} | FiskAI`,
    description: howto.frontmatter.description,
    alternates: {
      canonical: `${BASE_URL}/kako-da/${slug}`,
    },
  }
}

export default async function HowToPage({ params }: Props) {
  const { slug } = await params
  const howto = getHowToBySlug(slug)

  if (!howto) notFound()

  const { frontmatter, content } = howto
  const url = `https://fiskai.hr/kako-da/${slug}`

  const breadcrumbs = [
    { name: "Baza znanja", url: "https://fiskai.hr/baza-znanja" },
    { name: "Kako da...", url: "https://fiskai.hr/kako-da" },
    { name: frontmatter.title, url },
  ]

  return (
    <>
      <JsonLd schemas={[generateBreadcrumbSchema(breadcrumbs)]} />

      <SectionBackground variant="hero" showGrid showOrbs>
        <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
          <nav className="mb-6 text-sm text-white/60">
            <Link href="/baza-znanja" className="hover:text-white/90">
              Baza znanja
            </Link>{" "}
            <span>/</span>{" "}
            <Link href="/kako-da" className="hover:text-white/90">
              Kako da...
            </Link>{" "}
            <span>/</span> <span className="text-white/90">{frontmatter.title}</span>
          </nav>

          <Link
            href="/kako-da"
            className="mb-6 inline-flex items-center gap-2 text-sm text-primary hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Svi vodiči
          </Link>

          <header className="mb-8">
            <h1 className="text-3xl font-bold text-white md:text-4xl">{frontmatter.title}</h1>
            <p className="mt-3 text-lg text-white/60">{frontmatter.description}</p>
            {frontmatter.totalTime && (
              <p className="mt-2 text-sm text-white/60">
                Potrebno vrijeme: {frontmatter.totalTime.replace("PT", "").replace("M", " minuta")}
              </p>
            )}
          </header>

          {frontmatter.prerequisites && frontmatter.prerequisites.length > 0 && (
            <div className="mb-8 rounded-xl border border-warning/30 bg-warning-bg0/10 backdrop-blur-sm p-5">
              <h2 className="mb-2 font-semibold text-warning-text">Prije nego počnete</h2>
              <ul className="list-inside list-disc space-y-1 text-warning-text/80">
                {frontmatter.prerequisites.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <AIAnswerBlock
            answerId={`howto:${slug}:v1`}
            type="procedural"
            confidence="high"
            contentType="howto"
            lastUpdated={frontmatter.lastUpdated || new Date().toISOString().split("T")[0]}
            bluf={frontmatter.description}
          >
            <article className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-white/80 prose-a:text-primary prose-strong:text-white prose-code:text-primary prose-pre:bg-surface/5 prose-pre:border prose-pre:border-white/10">
              <MDXRemote source={content} components={mdxComponents} />
            </article>
          </AIAnswerBlock>

          {frontmatter.faq && <FAQ items={frontmatter.faq} />}

          <NextSteps
            tools={[
              {
                title: "Kalkulator doprinosa",
                description: "Izračunajte mjesečne doprinose za MIO i HZZO",
                href: "/alati/kalkulator-doprinosa",
              },
              {
                title: "Kalkulator poreza",
                description: "Izračunajte paušalni porez na temelju prihoda",
                href: "/alati/kalkulator-poreza",
              },
              {
                title: "Generator uplatnica",
                description: "Generirajte HUB3 barkod za uplate doprinosa i poreza",
                href: "/alati/uplatnice",
              },
              {
                title: "Kalendar rokova",
                description: "Podsjetnik za važne rokove prijava i uplata",
                href: "/alati/kalendar",
              },
            ]}
            comparisons={[
              {
                title: "Počinjem solo",
                description: "Usporedba paušalnog obrta, obrta na dohodak i d.o.o.",
                href: "/usporedba/pocinjem-solo",
              },
              {
                title: "Dodatni prihod",
                description: "Kako zaraditi uz redovan posao?",
                href: "/usporedba/dodatni-prihod",
              },
            ]}
          />

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
