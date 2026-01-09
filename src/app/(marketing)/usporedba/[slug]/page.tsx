import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getComparisonBySlug, getAllComparisonSlugs } from "@/lib/knowledge-hub/mdx"
import { ComparisonPageContent } from "@/components/knowledge-hub/comparison/ComparisonPageContent"

interface PageProps {
  params: Promise<{ slug: string }>
  // searchParams removed for static export compatibility
  // User preferences now handled client-side via URL params in ComparisonPageContent
}

export async function generateStaticParams() {
  const slugs = await getAllComparisonSlugs()
  return slugs.map((slug) => ({ slug }))
}

// Prevent runtime dynamic routes - all slugs must be known at build time
export const dynamicParams = false

function getBaseUrl() {
  const env = process.env.NEXT_PUBLIC_APP_URL
  if (env) return env.replace(/\/+$/, "")
  return "http://localhost:3000"
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const comparison = await getComparisonBySlug(slug)

  if (!comparison) {
    return { title: "Usporedba nije pronađena" }
  }

  const baseUrl = getBaseUrl()
  const pageUrl = `${baseUrl}/usporedba/${slug}`
  const ogImage = `${baseUrl}/og-knowledge-hub.png`

  return {
    title: `${comparison.frontmatter.title} | FiskAI`,
    description: comparison.frontmatter.description,
    authors: [{ name: "FiskAI" }],
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: comparison.frontmatter.title,
      description: comparison.frontmatter.description,
      type: "article",
      url: pageUrl,
      siteName: "FiskAI",
      locale: "hr_HR",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: comparison.frontmatter.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: comparison.frontmatter.title,
      description: comparison.frontmatter.description,
      images: [ogImage],
    },
  }
}

export default async function ComparisonPage({ params }: PageProps) {
  const { slug } = await params
  // For static export, searchParams are handled client-side via useSearchParams
  const comparison = await getComparisonBySlug(slug)

  if (!comparison) {
    notFound()
  }

  const baseUrl = getBaseUrl()
  const pageUrl = `${baseUrl}/usporedba/${slug}`

  // Structured data for SEO - optimized for comparison/decision pages
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: comparison.frontmatter.title,
    description: comparison.frontmatter.description,
    url: pageUrl,
    author: {
      "@type": "Organization",
      name: "FiskAI",
      url: baseUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "FiskAI",
      url: "https://fiskai.hr",
      logo: {
        "@type": "ImageObject",
        url: "https://fiskai.hr/logo.png",
      },
    },
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    articleSection: "Comparison",
    ...(comparison.frontmatter.compares && {
      about: comparison.frontmatter.compares.map((item: string) => ({
        "@type": "Thing",
        name: item,
      })),
    }),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ComparisonPageContent comparison={comparison} searchParams={{}} />
    </>
  )
}
