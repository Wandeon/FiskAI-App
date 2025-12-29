import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories } from "@/lib/db/schema"
import { eq, desc, and, lte } from "drizzle-orm"

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"
const FEED_TITLE = "FiskAI Porezne Vijesti"
const FEED_DESCRIPTION =
  "Najnovije vijesti iz Porezne uprave, Narodnih novina i FINA-e za hrvatske poduzetnike. Automatizirani sazeci relevantni za vase poslovanje."

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function toRfc822Date(date: Date): string {
  return date.toUTCString()
}

export async function GET() {
  const posts = await drizzleDb
    .select({
      id: newsPosts.id,
      slug: newsPosts.slug,
      title: newsPosts.title,
      excerpt: newsPosts.excerpt,
      content: newsPosts.content,
      categoryName: newsCategories.nameHr,
      publishedAt: newsPosts.publishedAt,
    })
    .from(newsPosts)
    .leftJoin(newsCategories, eq(newsPosts.categoryId, newsCategories.id))
    .where(
      and(
        eq(newsPosts.status, "published"),
        eq(newsPosts.type, "individual"),
        lte(newsPosts.publishedAt, new Date())
      )
    )
    .orderBy(desc(newsPosts.publishedAt))
    .limit(50)

  const lastBuildDate = posts[0]?.publishedAt
    ? toRfc822Date(posts[0].publishedAt)
    : toRfc822Date(new Date())

  const items = posts
    .map((post) => {
      const link = `${SITE_URL}/vijesti/${post.slug}`
      const description = post.excerpt || post.content?.slice(0, 300) || ""
      const pubDate = post.publishedAt ? toRfc822Date(post.publishedAt) : ""
      const category = post.categoryName || "Vijesti"

      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(description)}</description>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(category)}</category>
    </item>`
    })
    .join("\n")

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${SITE_URL}/vijesti</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>hr</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  })
}
