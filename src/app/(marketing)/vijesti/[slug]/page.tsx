import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getAllPostSlugs, getPostBySlug, getRelatedPosts } from "@/lib/content/news"
import { format } from "date-fns"
import { hr } from "date-fns/locale"
import Link from "next/link"
import { Calendar, Tag } from "lucide-react"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export async function generateStaticParams() {
  const slugs = await getAllPostSlugs()
  return slugs.map((slug) => ({ slug }))
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) return { title: "Vijest nije pronađena | FiskAI" }
  return {
    title: post.title,
    description: post.excerpt || undefined,
    alternates: { canonical: `${BASE_URL}/vijesti/${slug}` },
  }
}

export default async function PostDetailPage({ params }: PageProps) {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) notFound()

  const relatedPosts = await getRelatedPosts(post.categorySlug, post.slug, 3)

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/vijesti" className="hover:text-foreground">
          Vijesti
        </Link>
        {post.categoryName && (
          <>
            <span className="mx-2">/</span>
            <Link
              href={`/vijesti/kategorija/${post.categorySlug}`}
              className="hover:text-foreground"
            >
              {post.categoryName}
            </Link>
          </>
        )}
      </nav>

      <article>
        {post.categoryName && (
          <Link
            href={`/vijesti/kategorija/${post.categorySlug}`}
            className="mb-4 inline-block rounded-full bg-info-bg px-3 py-1 text-sm font-medium text-info-text"
          >
            {post.categoryName}
          </Link>
        )}

        <h1 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">{post.title}</h1>

        <div className="mb-8 flex flex-wrap items-center gap-4 text-sm text-muted">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <time dateTime={post.publishedAt}>
              {post.publishedAt &&
                format(new Date(post.publishedAt), "d. MMMM yyyy.", { locale: hr })}
            </time>
          </div>
          {post.impactLevel && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                post.impactLevel === "high"
                  ? "bg-danger-bg text-danger-text"
                  : post.impactLevel === "medium"
                    ? "bg-warning-bg text-warning-text"
                    : "bg-success-bg text-success-text"
              }`}
            >
              {post.impactLevel === "high"
                ? "Visok utjecaj"
                : post.impactLevel === "medium"
                  ? "Srednji utjecaj"
                  : "Nizak utjecaj"}
            </span>
          )}
        </div>

        {post.tags.length > 0 && (
          <div className="my-8 flex flex-wrap items-center gap-2">
            <Tag className="h-4 w-4 text-muted" />
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-info-bg px-3 py-1 text-sm font-medium text-info-text"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {post.tldr && (
          <div className="my-8 rounded-xl border border-info-border bg-info-bg p-6">
            <h2 className="mb-3 text-lg font-semibold">TL;DR</h2>
            <p className="text-sm">{post.tldr}</p>
          </div>
        )}

        <div
          className="prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {post.actionItems && post.actionItems.length > 0 && (
          <div className="my-8 rounded-xl border border-success-border/20 bg-success-bg/10 p-6">
            <h2 className="mb-4 text-lg font-semibold text-success-text">Što napraviti</h2>
            <ul className="space-y-2">
              {post.actionItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm">
                  <span className="text-success-text">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>

      {relatedPosts.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-bold text-foreground">Srodne vijesti</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {relatedPosts.map((related) => (
              <Link
                key={related.id}
                href={`/vijesti/${related.slug}`}
                className="block rounded-lg border border-white/10 bg-surface/5 p-4 hover:bg-surface/10"
              >
                <p className="font-medium text-white line-clamp-2">{related.title}</p>
                <p className="mt-2 text-sm text-white/60 line-clamp-2">{related.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
