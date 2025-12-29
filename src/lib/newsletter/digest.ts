import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories } from "@/lib/db/schema"
import { eq, desc, and, lte, gte } from "drizzle-orm"
import type { NewsDigestPost } from "@/emails/news-digest"

/**
 * Get news posts published in the last 24 hours for newsletter digest
 */
export async function getRecentNewsForDigest(hoursBack = 24): Promise<NewsDigestPost[]> {
  const sinceDate = new Date()
  sinceDate.setHours(sinceDate.getHours() - hoursBack)

  const posts = await drizzleDb
    .select({
      slug: newsPosts.slug,
      title: newsPosts.title,
      excerpt: newsPosts.excerpt,
      categoryName: newsCategories.nameHr,
      publishedAt: newsPosts.publishedAt,
    })
    .from(newsPosts)
    .leftJoin(newsCategories, eq(newsPosts.categoryId, newsCategories.id))
    .where(
      and(
        eq(newsPosts.status, "published"),
        eq(newsPosts.type, "individual"),
        lte(newsPosts.publishedAt, new Date()),
        gte(newsPosts.publishedAt, sinceDate)
      )
    )
    .orderBy(desc(newsPosts.publishedAt))
    .limit(10)

  return posts
}
