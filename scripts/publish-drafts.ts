// scripts/publish-drafts.ts
// Review and publish the 4 draft posts that were created

import { drizzleDb } from "../src/lib/db/drizzle"
import { newsPosts } from "../src/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { reviewArticle } from "../src/lib/news/pipeline/reviewer"
import { rewriteArticle } from "../src/lib/news/pipeline/rewriter"

const DELAY = 3000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  console.log("=".repeat(60))
  console.log("Publishing Draft Posts")
  console.log("=".repeat(60))

  // Get all draft posts
  const drafts = await drizzleDb.select().from(newsPosts).where(eq(newsPosts.status, "draft"))

  console.log(`Found ${drafts.length} draft posts\n`)

  const publishTime = new Date()

  for (let i = 0; i < drafts.length; i++) {
    const post = drafts[i]
    console.log(`\n[${i + 1}/${drafts.length}] ${post.title}`)

    try {
      // PASS 2: Review
      console.log("  Reviewing...")
      const review = await reviewArticle({
        title: post.title,
        content: post.content,
      })
      console.log(`  → Score: ${review.score}/10`)

      await sleep(DELAY)

      let finalTitle = post.title
      let finalContent = post.content
      let finalExcerpt = post.excerpt || ""

      // PASS 3: Rewrite if needed
      if (review.score < 7) {
        console.log("  Rewriting (score < 7)...")
        const rewritten = await rewriteArticle({ title: post.title, content: post.content }, review)
        finalTitle = rewritten.title
        finalContent = rewritten.content
        finalExcerpt = rewritten.excerpt
        await sleep(DELAY)
      }

      // Generate excerpt if missing
      if (!finalExcerpt) {
        finalExcerpt =
          finalContent
            .replace(/[#*_`]/g, "")
            .substring(0, 200)
            .trim() + "..."
      }

      // Update to published
      await drizzleDb
        .update(newsPosts)
        .set({
          title: finalTitle,
          content: finalContent,
          excerpt: finalExcerpt,
          status: "published",
          publishedAt: publishTime,
          aiPasses: sql`COALESCE(ai_passes, '{}'::jsonb) || ${JSON.stringify({
            review: {
              timestamp: new Date().toISOString(),
              score: review.score,
              problems: review.problems,
              suggestions: review.suggestions,
            },
            final: {
              timestamp: new Date().toISOString(),
              wasRewritten: review.score < 7,
            },
          })}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(newsPosts.id, post.id))

      console.log("  ✓ Published!")
    } catch (error) {
      console.error(`  ✗ Error: ${error}`)

      // Still publish even if review/rewrite failed
      const excerpt =
        post.content
          .replace(/[#*_`]/g, "")
          .substring(0, 200)
          .trim() + "..."

      await drizzleDb
        .update(newsPosts)
        .set({
          excerpt: post.excerpt || excerpt,
          status: "published",
          publishedAt: publishTime,
          updatedAt: new Date(),
        })
        .where(eq(newsPosts.id, post.id))

      console.log("  ✓ Published (without review)")
    }
  }

  console.log("\n" + "=".repeat(60))
  console.log("Done!")
  console.log("=".repeat(60))

  // Verify
  const published = await drizzleDb
    .select()
    .from(newsPosts)
    .where(eq(newsPosts.status, "published"))

  console.log(`\nTotal published posts: ${published.length}`)
  for (const p of published) {
    console.log(`  - ${p.slug}`)
  }

  process.exit(0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
