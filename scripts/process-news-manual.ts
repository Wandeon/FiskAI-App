// scripts/process-news-manual.ts
// Manual script to process news from the last 24 hours through the 3-pass AI pipeline

import { drizzleDb } from "../src/lib/db/drizzle"
import { newsItems, newsPosts, newsPostSources, newsCategories } from "../src/lib/db/schema"
import { eq, and, gte, isNull, sql } from "drizzle-orm"
import { classifyNewsItem, type ClassificationResult } from "../src/lib/news/pipeline/classifier"
import { writeArticle } from "../src/lib/news/pipeline/writer"
import { reviewArticle, needsRewrite } from "../src/lib/news/pipeline/reviewer"
import { rewriteArticle } from "../src/lib/news/pipeline/rewriter"
import { assembleDigest } from "../src/lib/news/pipeline/digest-assembler"

const BATCH_SIZE = 10 // Process in smaller batches to avoid rate limits
const DELAY_BETWEEN_ITEMS = 2000 // 2 seconds between API calls

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[čć]/g, "c")
    .replace(/[šś]/g, "s")
    .replace(/[žź]/g, "z")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100)
}

async function main() {
  console.log("=".repeat(60))
  console.log("FiskAI News Processing - Manual Run")
  console.log("=".repeat(60))
  console.log(`Started at: ${new Date().toISOString()}\n`)

  // Get items from last 24 hours only
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const pendingItems = await drizzleDb
    .select()
    .from(newsItems)
    .where(and(eq(newsItems.status, "pending"), gte(newsItems.publishedAt, yesterday)))
    .limit(50) // Limit to 50 items for this run

  console.log(`Found ${pendingItems.length} pending items from last 24 hours\n`)

  if (pendingItems.length === 0) {
    console.log("No items to process. Exiting.")
    process.exit(0)
  }

  // Get categories for assignment
  const categories = await drizzleDb.select().from(newsCategories)
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // Stats
  const stats = {
    classified: 0,
    highImpact: 0,
    mediumImpact: 0,
    lowImpact: 0,
    postsCreated: 0,
    postsReviewed: 0,
    postsRewritten: 0,
    postsPublished: 0,
    errors: [] as string[],
  }

  // ============================================
  // PASS 1: CLASSIFY & WRITE
  // ============================================
  console.log("-".repeat(60))
  console.log("PASS 1: Classifying and Writing Articles")
  console.log("-".repeat(60))

  const highImpactItems: Array<{
    item: (typeof pendingItems)[0]
    classification: ClassificationResult
  }> = []
  const mediumImpactItems: Array<{
    item: (typeof pendingItems)[0]
    classification: ClassificationResult
  }> = []

  for (let i = 0; i < pendingItems.length; i++) {
    const item = pendingItems[i]
    console.log(`\n[${i + 1}/${pendingItems.length}] ${item.originalTitle.substring(0, 50)}...`)

    try {
      // Classify
      const classification = await classifyNewsItem({
        id: item.id,
        originalTitle: item.originalTitle,
        originalContent: item.originalContent || "",
        sourceUrl: item.sourceUrl,
        publishedAt: item.publishedAt,
      } as any)

      console.log(`  → Impact: ${classification.impact.toUpperCase()}`)
      console.log(
        `  → Category: ${classification.suggestedCategory}${classification.suggestedSubcategory ? ` / ${classification.suggestedSubcategory}` : ""}`
      )
      if (classification.keyDates?.length) {
        console.log(`  → Key dates: ${classification.keyDates.join(", ")}`)
      }
      stats.classified++

      // Update item with classification
      await drizzleDb
        .update(newsItems)
        .set({
          impactLevel: classification.impact,
          status: "processed",
          updatedAt: new Date(),
        })
        .where(eq(newsItems.id, item.id))

      if (classification.impact === "high") {
        stats.highImpact++
        highImpactItems.push({ item, classification })
      } else if (classification.impact === "medium") {
        stats.mediumImpact++
        mediumImpactItems.push({ item, classification })
      } else {
        stats.lowImpact++
      }

      await sleep(DELAY_BETWEEN_ITEMS)
    } catch (error) {
      const msg = `Error classifying ${item.id}: ${error}`
      console.error(`  ✗ ${msg}`)
      stats.errors.push(msg)
    }
  }

  console.log(`\nClassification complete:`)
  console.log(`  High impact: ${stats.highImpact}`)
  console.log(`  Medium impact: ${stats.mediumImpact}`)
  console.log(`  Low impact: ${stats.lowImpact}`)

  // Generate articles for high-impact items
  console.log(`\nGenerating articles for ${highImpactItems.length} high-impact items...`)

  const draftPosts: {
    id: string
    title: string
    content: string
    source: { title: string; content: string; url: string }
  }[] = []

  for (let i = 0; i < highImpactItems.length; i++) {
    const { item, classification } = highImpactItems[i]
    console.log(
      `\n[${i + 1}/${highImpactItems.length}] Writing: ${item.originalTitle.substring(0, 40)}...`
    )

    try {
      const article = await writeArticle(
        {
          id: item.id,
          originalTitle: item.originalTitle,
          originalContent: item.originalContent || "",
          sourceUrl: item.sourceUrl,
          publishedAt: item.publishedAt,
        } as any,
        "high"
      )

      // Use AI-suggested category instead of hardcoded
      const categoryId = classification.suggestedCategory || "poslovanje"

      // Create draft post
      const slug = generateSlug(article.title) + "-" + Date.now().toString(36)

      const [newPost] = await drizzleDb
        .insert(newsPosts)
        .values({
          slug,
          type: "individual",
          title: article.title,
          content: article.content,
          excerpt: article.excerpt,
          categoryId,
          impactLevel: "high",
          featuredImageUrl: item.imageUrl,
          featuredImageSource: item.imageSource,
          status: "draft",
          aiPasses: {
            write: {
              timestamp: new Date().toISOString(),
              title: article.title,
              content: article.content,
              excerpt: article.excerpt,
            },
            classification: {
              timestamp: new Date().toISOString(),
              suggestedCategory: classification.suggestedCategory,
              suggestedSubcategory: classification.suggestedSubcategory,
              keyDates: classification.keyDates,
              keyNumbers: classification.keyNumbers,
            },
          },
        })
        .returning()

      // Link post to source item
      await drizzleDb.insert(newsPostSources).values({
        postId: newPost.id,
        newsItemId: item.id,
      })

      // Update item
      await drizzleDb
        .update(newsItems)
        .set({ assignedToPostId: newPost.id })
        .where(eq(newsItems.id, item.id))

      // Store source data for review pass
      draftPosts.push({
        id: newPost.id,
        title: article.title,
        content: article.content,
        source: {
          title: item.originalTitle,
          content: item.originalContent || "",
          url: item.sourceUrl,
        },
      })
      stats.postsCreated++
      console.log(`  ✓ Created draft post: ${slug} (category: ${categoryId})`)

      await sleep(DELAY_BETWEEN_ITEMS)
    } catch (error) {
      const msg = `Error writing article for ${item.id}: ${error}`
      console.error(`  ✗ ${msg}`)
      stats.errors.push(msg)
    }
  }

  // ============================================
  // PASS 2: REVIEW
  // ============================================
  console.log("\n" + "-".repeat(60))
  console.log("PASS 2: Reviewing Articles")
  console.log("-".repeat(60))

  const reviewedPosts: {
    id: string
    title: string
    content: string
    score: number
    feedback: any
    source: { title: string; content: string; url: string }
  }[] = []

  for (let i = 0; i < draftPosts.length; i++) {
    const post = draftPosts[i]
    console.log(`\n[${i + 1}/${draftPosts.length}] Reviewing: ${post.title.substring(0, 40)}...`)

    try {
      // Pass source content for fact-checking
      const review = await reviewArticle({ title: post.title, content: post.content }, post.source)

      console.log(`  → Score: ${review.score}/10`)
      if (review.factual_issues && review.factual_issues.length > 0) {
        console.log(`  ⚠ Factual issues: ${review.factual_issues.length}`)
        review.factual_issues.forEach((issue, idx) => {
          console.log(`    ${idx + 1}. ${issue.substring(0, 60)}...`)
        })
      }
      if (review.problems.length > 0) {
        console.log(`  → Problems: ${review.problems.join(", ").substring(0, 60)}...`)
      }

      // Update post with review (including factual issues)
      await drizzleDb
        .update(newsPosts)
        .set({
          status: "reviewing",
          aiPasses: sql`ai_passes || ${JSON.stringify({
            review: {
              timestamp: new Date().toISOString(),
              score: review.score,
              factual_issues: review.factual_issues,
              problems: review.problems,
              suggestions: review.suggestions,
              rewrite_focus: review.rewrite_focus,
            },
          })}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(newsPosts.id, post.id))

      reviewedPosts.push({ ...post, score: review.score, feedback: review, source: post.source })
      stats.postsReviewed++

      await sleep(DELAY_BETWEEN_ITEMS)
    } catch (error) {
      const msg = `Error reviewing ${post.id}: ${error}`
      console.error(`  ✗ ${msg}`)
      stats.errors.push(msg)
    }
  }

  // ============================================
  // PASS 3: REWRITE & PUBLISH
  // ============================================
  console.log("\n" + "-".repeat(60))
  console.log("PASS 3: Rewriting (if needed) & Publishing")
  console.log("-".repeat(60))

  const publishTime = new Date()
  publishTime.setHours(6, 0, 0, 0)
  if (publishTime < new Date()) {
    publishTime.setDate(publishTime.getDate() + 1)
  }

  for (let i = 0; i < reviewedPosts.length; i++) {
    const post = reviewedPosts[i]
    console.log(`\n[${i + 1}/${reviewedPosts.length}] ${post.title.substring(0, 40)}...`)

    try {
      let finalTitle = post.title
      let finalContent = post.content
      let finalExcerpt = ""

      // Rewrite if score < 7 OR has factual issues
      const shouldRewrite = needsRewrite(post.feedback)
      if (shouldRewrite) {
        const reason =
          post.feedback.factual_issues?.length > 0
            ? `factual issues: ${post.feedback.factual_issues.length}`
            : `score: ${post.score}`
        console.log(`  → Rewriting (${reason})...`)

        // Pass source content for fact-checking during rewrite
        const rewritten = await rewriteArticle(
          { title: post.title, content: post.content },
          post.feedback,
          post.source
        )
        finalTitle = rewritten.title
        finalContent = rewritten.content
        finalExcerpt = rewritten.excerpt
        stats.postsRewritten++
        await sleep(DELAY_BETWEEN_ITEMS)
      } else {
        console.log(`  ✓ No rewrite needed (score: ${post.score}, no factual issues)`)
      }

      // Generate excerpt if not present
      if (!finalExcerpt) {
        finalExcerpt =
          finalContent
            .replace(/[#*_`]/g, "")
            .substring(0, 200)
            .trim() + "..."
      }

      // Publish
      await drizzleDb
        .update(newsPosts)
        .set({
          title: finalTitle,
          content: finalContent,
          excerpt: finalExcerpt,
          status: "published",
          publishedAt: publishTime,
          aiPasses: sql`ai_passes || ${JSON.stringify({
            final: {
              timestamp: new Date().toISOString(),
              title: finalTitle,
              content: finalContent,
              excerpt: finalExcerpt,
              wasRewritten: post.score < 7,
            },
          })}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(newsPosts.id, post.id))

      stats.postsPublished++
      console.log(`  ✓ Published!`)
    } catch (error) {
      const msg = `Error publishing ${post.id}: ${error}`
      console.error(`  ✗ ${msg}`)
      stats.errors.push(msg)
    }
  }

  // ============================================
  // ASSEMBLE DIGEST
  // ============================================
  if (mediumImpactItems.length > 0) {
    console.log("\n" + "-".repeat(60))
    console.log("Creating Daily Digest")
    console.log("-".repeat(60))
    console.log(`\nAssembling digest from ${mediumImpactItems.length} medium-impact items...`)

    try {
      // Generate summaries for medium items
      const digestItems = []
      for (const { item, classification } of mediumImpactItems.slice(0, 10)) {
        // Limit to 10 for digest
        try {
          const summary = await writeArticle(
            {
              id: item.id,
              originalTitle: item.originalTitle,
              originalContent: item.originalContent || "",
              sourceUrl: item.sourceUrl,
              publishedAt: item.publishedAt,
            } as any,
            "medium"
          )
          digestItems.push({
            id: item.id,
            title: item.originalTitle,
            summary: summary.content,
            sourceUrl: item.sourceUrl,
            category: classification.suggestedCategory || "poslovanje",
          })
          await sleep(1000)
        } catch (e) {
          console.log(`  Skipping item: ${e}`)
        }
      }

      if (digestItems.length > 0) {
        const digest = await assembleDigest(digestItems)

        const digestSlug = `dnevni-pregled-${new Date().toISOString().split("T")[0]}`

        // Determine most common category for digest
        const categoryCounts = new Map<string, number>()
        for (const item of digestItems) {
          categoryCounts.set(item.category, (categoryCounts.get(item.category) || 0) + 1)
        }
        const digestCategory =
          Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "poslovanje"

        const [digestPost] = await drizzleDb
          .insert(newsPosts)
          .values({
            slug: digestSlug,
            type: "digest",
            title: digest.title,
            content: digest.content,
            excerpt: `Pregled ${digestItems.length} vijesti iz ${new Date().toLocaleDateString("hr")}`,
            categoryId: digestCategory,
            impactLevel: "medium",
            status: "published",
            publishedAt: publishTime,
            aiPasses: {
              digest: { timestamp: new Date().toISOString(), sections: digest.sections },
            },
          })
          .returning()

        // Link items to digest
        for (const { item } of mediumImpactItems.slice(0, 10)) {
          await drizzleDb
            .insert(newsPostSources)
            .values({
              postId: digestPost.id,
              newsItemId: item.id,
            })
            .onConflictDoNothing()

          await drizzleDb
            .update(newsItems)
            .set({ assignedToPostId: digestPost.id })
            .where(eq(newsItems.id, item.id))
        }

        console.log(`  ✓ Created digest: ${digestSlug} (category: ${digestCategory})`)
      }
    } catch (error) {
      console.error(`  ✗ Error creating digest: ${error}`)
      stats.errors.push(`Digest error: ${error}`)
    }
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n" + "=".repeat(60))
  console.log("PROCESSING COMPLETE")
  console.log("=".repeat(60))
  console.log(`
Items classified: ${stats.classified}
  - High impact: ${stats.highImpact}
  - Medium impact: ${stats.mediumImpact}
  - Low impact: ${stats.lowImpact}

Posts created: ${stats.postsCreated}
Posts reviewed: ${stats.postsReviewed}
Posts rewritten: ${stats.postsRewritten}
Posts published: ${stats.postsPublished}

Errors: ${stats.errors.length}
${stats.errors.length > 0 ? stats.errors.map((e) => `  - ${e}`).join("\n") : ""}

Completed at: ${new Date().toISOString()}
  `)

  process.exit(0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
