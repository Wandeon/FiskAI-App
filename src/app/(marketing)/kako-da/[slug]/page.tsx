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
  }
}

export default async function HowToPage({ params }: Props) {
  const { slug } = await params
  const howto = getHowToBySlug(slug)

  if (!howto) notFound()

  const { frontmatter, content } = howto
  const url = `https://fisk.ai/kako-da/${slug}`

  const breadcrumbs = [
    { name: "Baza znanja", url: "https://fisk.ai/baza-znanja" },
    { name: "Kako da...", url: "https://fisk.ai/kako-da" },
    { name: frontmatter.title, url },
  ]

  return (
    <>
      <JsonLd schemas={[generateBreadcrumbSchema(breadcrumbs)]} />

      <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
        <nav className="mb-6 text-sm text-[var(--muted)]">
          <Link href="/baza-znanja" className="hover:text-[var(--foreground)]">
            Baza znanja
          </Link>{" "}
          <span>/</span>{" "}
          <Link href="/kako-da" className="hover:text-[var(--foreground)]">
            Kako da...
          </Link>{" "}
          <span>/</span> <span className="text-[var(--foreground)]">{frontmatter.title}</span>
        </nav>

        <Link
          href="/kako-da"
          className="mb-6 inline-flex items-center gap-2 text-sm text-green-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Svi vodiči
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">{frontmatter.title}</h1>
          <p className="mt-3 text-lg text-slate-600">{frontmatter.description}</p>
          {frontmatter.totalTime && (
            <p className="mt-2 text-sm text-slate-500">
              Potrebno vrijeme: {frontmatter.totalTime.replace("PT", "").replace("M", " minuta")}
            </p>
          )}
        </header>

        {frontmatter.prerequisites && frontmatter.prerequisites.length > 0 && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="mb-2 font-semibold text-amber-800">Prije nego počnete</h2>
            <ul className="list-inside list-disc space-y-1 text-amber-700">
              {frontmatter.prerequisites.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <article className="prose prose-slate max-w-none">
          <MDXRemote source={content} components={mdxComponents} />
        </article>

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
