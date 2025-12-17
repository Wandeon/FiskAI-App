#!/usr/bin/env tsx
/**
 * Bulk rewrite existing /vijesti posts using the 3-pass pipeline.
 *
 * Usage:
 *   npm -C FiskAI run db:rewrite-news -- --limit 10
 *   npm -C FiskAI run db:rewrite-news -- --status published --min-score 8
 *   npm -C FiskAI run db:rewrite-news -- --force --dry-run
 */

import { drizzleDb } from "../src/lib/db/drizzle"
import { newsItems, newsPosts, newsPostSources } from "../src/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { needsRewrite, reviewArticle, rewriteArticle } from "../src/lib/news/pipeline"

type Args = {
  status: "draft" | "reviewing" | "published"
  limit: number
  minScore?: number
  force: boolean
  dryRun: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    status: "published",
    limit: 10,
    force: false,
    dryRun: false,
  }

  const takeValue = (flag: string) => {
    const index = argv.indexOf(flag)
    if (index === -1) return null
    return argv[index + 1] ?? null
  }

  const status = takeValue("--status")
  if (status && (status === "draft" || status === "reviewing" || status === "published")) {
    args.status = status
  }

  const limitValue = takeValue("--limit")
  if (limitValue && Number.isFinite(Number(limitValue))) {
    args.limit = Math.max(1, Math.min(200, Number(limitValue)))
  }

  const minScoreValue = takeValue("--min-score")
  if (minScoreValue && Number.isFinite(Number(minScoreValue))) {
    args.minScore = Math.max(1, Math.min(10, Number(minScoreValue)))
  }

  args.force = argv.includes("--force")
  args.dryRun = argv.includes("--dry-run")

  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  console.log("=".repeat(60))
  console.log("FiskAI /vijesti bulk rewrite")
  console.log("=".repeat(60))
  console.log(`Status: ${args.status}`)
  console.log(`Limit: ${args.limit}`)
  console.log(`Min score: ${args.minScore ?? "(default policy)"}`)
  console.log(`Force: ${args.force ? "yes" : "no"}`)
  console.log(`Dry run: ${args.dryRun ? "yes" : "no"}`)
  console.log("")

  const posts = await drizzleDb
    .select()
    .from(newsPosts)
    .where(eq(newsPosts.status, args.status))
    .orderBy(desc(newsPosts.publishedAt), desc(newsPosts.createdAt))
    .limit(args.limit)

  if (posts.length === 0) {
    console.log("No posts found.")
    process.exit(0)
  }

  let reviewed = 0
  let rewritten = 0
  let skipped = 0
  let failed = 0

  for (const post of posts) {
    try {
      console.log("-".repeat(60))
      console.log(`${post.title} (${post.slug})`)

      const sourceRows = await drizzleDb
        .select({
          title: newsItems.originalTitle,
          content: newsItems.originalContent,
          url: newsItems.sourceUrl,
        })
        .from(newsPostSources)
        .innerJoin(newsItems, eq(newsPostSources.newsItemId, newsItems.id))
        .where(eq(newsPostSources.postId, post.id))
        .limit(1)

      const source = sourceRows[0]
        ? {
            title: sourceRows[0].title,
            content: sourceRows[0].content || "",
            url: sourceRows[0].url,
          }
        : undefined

      const feedback = await reviewArticle({ title: post.title, content: post.content }, source)
      reviewed++

      console.log(`Score: ${feedback.score}/10`)
      if (feedback.factual_issues.length > 0) {
        console.log(`Factual issues: ${feedback.factual_issues.length}`)
      }
      if (feedback.rewrite_focus) {
        console.log(`Focus: ${feedback.rewrite_focus}`)
      }

      const shouldRewriteByScore = args.minScore ? feedback.score < args.minScore : false
      const shouldRewrite = args.force || needsRewrite(feedback) || shouldRewriteByScore

      if (!shouldRewrite) {
        console.log("Skipped (meets quality bar).")
        skipped++
        continue
      }

      const rewrittenPost = await rewriteArticle(
        { title: post.title, content: post.content },
        feedback,
        source
      )

      rewritten++

      if (args.dryRun) {
        console.log("Dry run: not updating DB.")
        continue
      }

      const existingAiPasses =
        typeof post.aiPasses === "object" && post.aiPasses !== null
          ? (post.aiPasses as Record<string, any>)
          : {}

      await drizzleDb
        .update(newsPosts)
        .set({
          title: rewrittenPost.title,
          content: rewrittenPost.content,
          excerpt: rewrittenPost.excerpt,
          status: post.status,
          aiPasses: {
            ...existingAiPasses,
            review: {
              timestamp: new Date().toISOString(),
              score: feedback.score,
              factual_issues: feedback.factual_issues,
              problems: feedback.problems,
              suggestions: feedback.suggestions,
              rewrite_focus: feedback.rewrite_focus,
            },
            final: {
              timestamp: new Date().toISOString(),
              title: rewrittenPost.title,
              content: rewrittenPost.content,
              excerpt: rewrittenPost.excerpt,
              wasRewritten: true,
              reviewScore: feedback.score,
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(newsPosts.id, post.id))

      console.log("Updated.")
    } catch (error) {
      failed++
      console.error("Failed:", error instanceof Error ? error.message : String(error))
    }
  }

  console.log("")
  console.log("=".repeat(60))
  console.log("Done")
  console.log("=".repeat(60))
  console.log(`Reviewed: ${reviewed}`)
  console.log(`Rewritten: ${rewritten}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Failed: ${failed}`)
}

main().catch((error) => {
  console.error("Fatal:", error)
  process.exit(1)
})
