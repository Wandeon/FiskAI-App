import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getAllCategorySlugs, getPostsByCategory, getAllCategories } from "@/lib/content/news"
import Link from "next/link"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export async function generateStaticParams() {
  const slugs = await getAllCategorySlugs()
  return slugs.map((slug) => ({ slug }))
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const categories = await getAllCategories()
  const category = categories.find((c) => c.slug === slug)
  return {
    title: category ? `${category.name} | Vijesti | FiskAI` : "Kategorija | FiskAI",
    alternates: { canonical: `${BASE_URL}/vijesti/kategorija/${slug}` },
  }
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params
  const [categories, posts] = await Promise.all([getAllCategories(), getPostsByCategory(slug, 20)])

  const category = categories.find((c) => c.slug === slug)
  if (!category) notFound()

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/vijesti" className="hover:text-foreground">
          Vijesti
        </Link>
        <span className="mx-2">/</span>
        <span>{category.name}</span>
      </nav>

      <h1 className="mb-8 text-4xl font-bold">{category.name}</h1>

      {posts.length > 0 ? (
        <div className="space-y-6">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/vijesti/${post.slug}`}
              className="block rounded-lg border border-white/10 bg-surface/5 p-6 hover:bg-surface/10"
            >
              <h2 className="text-xl font-semibold text-white">{post.title}</h2>
              <p className="mt-2 text-white/60">{post.excerpt}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-white/60">Nema vijesti u ovoj kategoriji.</p>
      )}
    </div>
  )
}
