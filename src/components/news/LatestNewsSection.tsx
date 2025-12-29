import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { hr } from "date-fns/locale"
import { ArrowRight, Newspaper } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger, StaggerItem } from "@/components/motion/Stagger"

interface NewsPost {
  slug: string
  title: string
  excerpt: string | null
  categoryName: string | null
  publishedAt: Date | null
}

interface LatestNewsSectionProps {
  posts: NewsPost[]
}

export function LatestNewsSection({ posts }: LatestNewsSectionProps) {
  if (posts.length === 0) return null

  return (
    <section className="bg-[var(--surface)]">
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <Reveal className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-info-bg px-4 py-1.5 text-sm font-medium text-link mb-4">
            <Newspaper className="h-4 w-4" />
            Porezne vijesti
          </div>
          <h2 className="text-display text-3xl font-semibold">Najnovije vijesti</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--muted)]">
            Pratimo Poreznu upravu, Narodne novine i FINA-u. AI automatski filtrira i sažima vijesti
            relevantne za vaše poslovanje.
          </p>
        </Reveal>

        <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {posts.map((post) => (
            <StaggerItem key={post.slug}>
              <Link href={`/vijesti/${post.slug}`} className="group block h-full">
                <Card className="card h-full transition-all group-hover:shadow-lg group-hover:border-blue-300 group-hover:-translate-y-0.5">
                  <CardHeader className="pb-2">
                    {post.categoryName && (
                      <span className="text-xs font-medium text-link mb-1 block">
                        {post.categoryName}
                      </span>
                    )}
                    <CardTitle className="text-sm leading-tight line-clamp-2">
                      {post.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {post.excerpt && (
                      <p className="text-xs text-[var(--muted)] line-clamp-2 mb-2">
                        {post.excerpt}
                      </p>
                    )}
                    {post.publishedAt && (
                      <time className="text-xs text-[var(--muted)]">
                        {formatDistanceToNow(post.publishedAt, { addSuffix: true, locale: hr })}
                      </time>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>

        <div className="mt-8 text-center">
          <Link
            href="/vijesti"
            className="inline-flex items-center gap-2 text-sm font-semibold text-link hover:underline"
          >
            Sve vijesti <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
