import { NextRequest, NextResponse } from "next/server"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsPostSources, newsItems } from "@/lib/db/schema/news"
import { eq } from "drizzle-orm"
import { cookies } from "next/headers"
import { classifyNewsItem, writeArticle, reviewArticle, rewriteArticle } from "@/lib/news/pipeline"

const ADMIN_COOKIE = "fiskai_admin_auth"

async function isAdminAuthenticated() {
  // TODO: Replace with proper auth when available
  const cookieStore = await cookies()
  return cookieStore.get(ADMIN_COOKIE)?.value === "authenticated"
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Check admin auth
  const isAuth = await isAdminAuthenticated()
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await request.json()
    const { pass } = body

    if (!pass || ![1, 2, 3].includes(pass)) {
      return NextResponse.json(
        { error: "Invalid pass number. Must be 1, 2, or 3" },
        { status: 400 }
      )
    }

    // Fetch post
    const posts = await drizzleDb.select().from(newsPosts).where(eq(newsPosts.id, id)).limit(1)

    if (posts.length === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    const post = posts[0]
    const aiPasses = (post.aiPasses as any) || {}

    // Fetch source items
    const sources = await drizzleDb
      .select({
        newsItem: newsItems,
      })
      .from(newsPostSources)
      .innerJoin(newsItems, eq(newsPostSources.newsItemId, newsItems.id))
      .where(eq(newsPostSources.postId, id))

    if (sources.length === 0) {
      return NextResponse.json({ error: "No source items found for this post" }, { status: 400 })
    }

    const sourceItem = sources[0].newsItem

    // Re-run the specified pass
    if (pass === 1) {
      // Pass 1: Classify & Write
      const classification = await classifyNewsItem({
        id: sourceItem.id,
        title: sourceItem.originalTitle,
        content: sourceItem.originalContent || "",
        sourceUrl: sourceItem.sourceUrl,
      })

      const article = await writeArticle({
        item: sourceItem,
        impact: classification.impact as "high" | "medium" | "low",
      })

      aiPasses.pass1 = {
        timestamp: new Date().toISOString(),
        classification,
        content: article.content,
        title: article.title,
      }

      // Update post content
      await drizzleDb
        .update(newsPosts)
        .set({
          aiPasses: aiPasses,
          title: article.title,
          content: article.content,
          impactLevel: classification.impact,
          updatedAt: new Date(),
        })
        .where(eq(newsPosts.id, id))
    } else if (pass === 2) {
      // Pass 2: Review
      if (!aiPasses.pass1) {
        return NextResponse.json({ error: "Cannot run Pass 2 without Pass 1" }, { status: 400 })
      }

      const review = await reviewArticle({
        id: post.id,
        title: post.title,
        content: post.content,
      })

      aiPasses.pass2 = {
        timestamp: new Date().toISOString(),
        ...review,
      }

      await drizzleDb
        .update(newsPosts)
        .set({
          aiPasses: aiPasses,
          updatedAt: new Date(),
        })
        .where(eq(newsPosts.id, id))
    } else if (pass === 3) {
      // Pass 3: Rewrite
      if (!aiPasses.pass1 || !aiPasses.pass2) {
        return NextResponse.json(
          { error: "Cannot run Pass 3 without Pass 1 and Pass 2" },
          { status: 400 }
        )
      }

      const rewrite = await rewriteArticle({
        id: post.id,
        draft: {
          title: aiPasses.pass1.title,
          content: aiPasses.pass1.content,
          excerpt: post.excerpt || "",
        },
        feedback: aiPasses.pass2,
      })

      aiPasses.pass3 = {
        timestamp: new Date().toISOString(),
        content: rewrite.content,
      }

      // Update post with rewritten content
      await drizzleDb
        .update(newsPosts)
        .set({
          aiPasses: aiPasses,
          content: rewrite.content,
          updatedAt: new Date(),
        })
        .where(eq(newsPosts.id, id))
    }

    // Fetch updated post
    const updatedPosts = await drizzleDb
      .select()
      .from(newsPosts)
      .where(eq(newsPosts.id, id))
      .limit(1)

    return NextResponse.json({ post: updatedPosts[0], pass })
  } catch (error) {
    console.error(`Error re-running pass:`, error)
    return NextResponse.json(
      {
        error: `Failed to re-run pass: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    )
  }
}
