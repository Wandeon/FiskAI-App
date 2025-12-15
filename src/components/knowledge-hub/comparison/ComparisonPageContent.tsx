// src/components/knowledge-hub/comparison/ComparisonPageContent.tsx

import Link from "next/link"
import { MDXRemote } from "next-mdx-remote/rsc"
import { ComparisonContent } from "@/lib/knowledge-hub/mdx"
import { mdxComponents } from "@/components/knowledge-hub/mdx-components"
import { ComparisonTable } from "./ComparisonTable"
import { ComparisonCalculator } from "./ComparisonCalculator"
import { RecommendationCard } from "./RecommendationCard"

interface ComparisonPageContentProps {
  comparison: ComparisonContent
  searchParams: { [key: string]: string | undefined }
}

export function ComparisonPageContent({ comparison, searchParams }: ComparisonPageContentProps) {
  const { frontmatter, content } = comparison
  // Note: These params will be used by child components (ComparisonTable, etc.)
  // They are passed through the MDX context
  const _highlightedType = searchParams.preporuka
  const _revenueLevel = searchParams.prihod

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:text-gray-700">
          Početna
        </Link>
        {" > "}
        <Link href="/baza-znanja" className="hover:text-gray-700">
          Baza znanja
        </Link>
        {" > "}
        <span className="text-gray-900">{frontmatter.title}</span>
      </nav>

      {/* Hero */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{frontmatter.title}</h1>
        <p className="text-lg text-gray-600">{frontmatter.description}</p>
      </header>

      {/* MDX Content (includes ComparisonTable, Calculator, etc.) */}
      <article className="prose prose-gray max-w-none">
        <MDXRemote
          source={content}
          components={{
            ...mdxComponents,
            ComparisonTable,
            ComparisonCalculator,
            RecommendationCard,
          }}
        />
      </article>

      {/* Deep-dive links */}
      <section className="mt-12 border-t pt-8">
        <h2 className="text-xl font-semibold mb-4">Saznajte više</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {frontmatter.compares.map((slug) => (
            <a
              key={slug}
              href={`/vodic/${slug}`}
              className="block p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <span className="font-medium">Vodič: {slug}</span>
              <span className="block text-sm text-gray-500">
                Kompletan vodič sa svim detaljima →
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
