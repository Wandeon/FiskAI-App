// src/app/(marketing)/vodic/[slug]/page.tsx
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { MDXRemote } from "next-mdx-remote/rsc"
import { getGuideBySlug, getGuideSlugs } from "@/lib/knowledge-hub/mdx"
import { mdxComponents } from "@/components/knowledge-hub/mdx-components"
import type { Metadata } from "next"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = getGuideSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const guide = getGuideBySlug(slug)

  if (!guide) return { title: "Vodič nije pronađen" }

  return {
    title: `${guide.frontmatter.title} | FiskAI`,
    description: guide.frontmatter.description,
    keywords: guide.frontmatter.keywords,
    openGraph: {
      title: guide.frontmatter.title,
      description: guide.frontmatter.description,
      type: "article",
    },
  }
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params
  const guide = getGuideBySlug(slug)

  if (!guide) {
    notFound()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <article className="prose prose-lg max-w-none">
        <Suspense fallback={<div>Učitavanje...</div>}>
          <MDXRemote source={guide.content} components={mdxComponents} />
        </Suspense>
      </article>
    </div>
  )
}
