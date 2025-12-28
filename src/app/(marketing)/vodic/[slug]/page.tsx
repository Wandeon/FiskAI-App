// src/app/(marketing)/vodic/[slug]/page.tsx
import { notFound } from "next/navigation"
import Link from "next/link"
import { MDXRemote } from "next-mdx-remote/rsc"
import { getGuideBySlug } from "@/lib/knowledge-hub/mdx"
import { mdxComponents } from "@/components/knowledge-hub/mdx-components"
import { TableOfContents } from "@/components/knowledge-hub/guide/TableOfContents"
import { slugifyHeading } from "@/lib/knowledge-hub/slugify"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { NextSteps } from "@/components/knowledge-hub/NextSteps"
import { AIAnswerBlock } from "@/components/content/ai-answer-block"
import type { Metadata } from "next"

interface Props {
  params: Promise<{ slug: string }>
}

// Temporarily disabled static generation due to MDX/React compatibility issue
// TODO: Re-enable once MDX rendering is fixed
// export async function generateStaticParams() {
//   const slugs = getGuideSlugs()
//   return slugs.map((slug) => ({ slug }))
// }

export const dynamicParams = true
export const dynamic = "force-dynamic"

type TOCItem = { id: string; title: string; level: number }

function getBaseUrl() {
  const env = process.env.NEXT_PUBLIC_APP_URL
  if (env) return env.replace(/\/+$/, "")
  return "http://localhost:3000"
}

function stripMarkdown(value: string) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim()
}

function extractTocItems(mdx: string): TOCItem[] {
  const items: TOCItem[] = []
  const lines = mdx.split(/\r?\n/)
  let inCodeBlock = false

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    const match = /^(##|###)\s+(.+)$/.exec(line)
    if (!match) continue

    const level = match[1].length
    const title = stripMarkdown(match[2].replace(/\s*#+\s*$/, ""))
    if (!title) continue

    items.push({ id: slugifyHeading(title), title, level })
  }

  return items
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const guide = getGuideBySlug(slug)

  if (!guide) return { title: "Vodič nije pronađen" }

  const baseUrl = getBaseUrl()
  const pageUrl = `${baseUrl}/vodic/${slug}`
  const ogImage = `${baseUrl}/og-knowledge-hub.png`

  return {
    title: `${guide.frontmatter.title} | FiskAI`,
    description: guide.frontmatter.description,
    keywords: guide.frontmatter.keywords,
    authors: [{ name: "FiskAI" }],
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: guide.frontmatter.title,
      description: guide.frontmatter.description,
      type: "article",
      url: pageUrl,
      siteName: "FiskAI",
      locale: "hr_HR",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: guide.frontmatter.title,
        },
      ],
      ...(guide.frontmatter.lastUpdated && {
        modifiedTime: new Date(guide.frontmatter.lastUpdated).toISOString(),
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: guide.frontmatter.title,
      description: guide.frontmatter.description,
      images: [ogImage],
    },
  }
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params
  const guide = getGuideBySlug(slug)

  if (!guide) {
    notFound()
  }

  const tocItems = extractTocItems(guide.content)
  const baseUrl = getBaseUrl()
  const pageUrl = `${baseUrl}/vodic/${slug}`

  // Structured data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.frontmatter.title,
    description: guide.frontmatter.description,
    url: pageUrl,
    author: {
      "@type": "Organization",
      name: "FiskAI",
      url: baseUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "FiskAI",
      url: baseUrl,
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/logo.png`,
      },
    },
    ...(guide.frontmatter.lastUpdated && {
      dateModified: new Date(guide.frontmatter.lastUpdated).toISOString(),
      datePublished: new Date(guide.frontmatter.lastUpdated).toISOString(),
    }),
    ...(guide.frontmatter.keywords && {
      keywords: Array.isArray(guide.frontmatter.keywords)
        ? guide.frontmatter.keywords.join(", ")
        : guide.frontmatter.keywords,
    }),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SectionBackground variant="dark" showOrbs={true} showGrid={true}>
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <nav className="mb-6 text-sm text-white/60">
            <Link href="/baza-znanja" className="hover:text-white/90">
              Baza znanja
            </Link>{" "}
            <span className="px-2">/</span>
            <Link href="/vodic" className="hover:text-white/90">
              Vodiči
            </Link>{" "}
            <span className="px-2">/</span>
            <span className="text-white/90">{guide.frontmatter.title}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
            <div>
              <AIAnswerBlock
                answerId={`guide:${slug}:v1`}
                type="procedural"
                confidence="high"
                contentType="guide"
                lastUpdated={
                  guide.frontmatter.lastUpdated || new Date().toISOString().split("T")[0]
                }
                bluf={guide.frontmatter.description}
              >
                <article className="prose prose-invert prose-lg max-w-none prose-headings:text-white prose-p:text-white/80 prose-a:text-cyan-400 prose-strong:text-white">
                  <MDXRemote source={guide.content} components={mdxComponents} />
                </article>
              </AIAnswerBlock>

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
                    title: "PDV prag (60.000€)",
                    description: "Provjerite koliko ste blizu praga i kada postajete PDV obveznik",
                    href: "/alati/pdv-kalkulator",
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
                    title: "Preko praga",
                    description: "Što kada prihod prijeđe 60.000€?",
                    href: "/usporedba/preko-praga",
                  },
                ]}
              />
            </div>
            {tocItems.length > 0 && (
              <aside aria-label="Sadržaj">
                <TableOfContents items={tocItems} />
              </aside>
            )}
          </div>
        </div>
      </SectionBackground>
    </>
  )
}
