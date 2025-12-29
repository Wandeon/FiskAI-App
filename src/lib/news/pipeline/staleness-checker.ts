/**
 * Content Freshness & Staleness Detection
 *
 * Handles automatic detection of stale content based on:
 * - Age thresholds (configurable by category/impact)
 * - Explicit expiration dates
 * - Regulatory rule changes (cross-reference with RTL)
 */

import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories } from "@/lib/db/schema"
import { eq, and, lt, lte, isNull, or, sql, desc } from "drizzle-orm"

// Freshness status types
export type FreshnessStatus = "fresh" | "stale" | "expired" | "archived"

// Default staleness thresholds (in days) by category
export const STALENESS_THRESHOLDS: Record<string, number> = {
  // Tax/regulatory content becomes stale faster
  "porez-na-dobit": 30,
  "porez-na-dohodak": 30,
  pdv: 30,
  "porezna-prijava": 14,

  // Compliance content
  fiskalizacija: 60,
  "racunovodstvo": 90,

  // General business news
  poslovanje: 90,
  default: 60,
}

// Warning threshold (days before becoming stale)
export const WARNING_THRESHOLD_DAYS = 7

export interface StalenessCheckResult {
  postId: string
  title: string
  publishedAt: Date | null
  currentStatus: FreshnessStatus | null
  newStatus: FreshnessStatus
  reason: string
  daysSincePublished: number | null
  expiresAt: Date | null
}

export interface StalenessCheckSummary {
  checked: number
  fresh: number
  stale: number
  expired: number
  archived: number
  warnings: number // Posts approaching staleness
  errors: string[]
}

/**
 * Calculate staleness threshold for a category
 */
export function getStalenessThreshold(categoryId: string | null): number {
  if (!categoryId) return STALENESS_THRESHOLDS.default
  return STALENESS_THRESHOLDS[categoryId] || STALENESS_THRESHOLDS.default
}

/**
 * Determine freshness status for a post
 */
export function determineFreshnessStatus(
  publishedAt: Date | null,
  expiresAt: Date | null,
  categoryId: string | null,
  now: Date = new Date()
): { status: FreshnessStatus; reason: string; daysSincePublished: number | null } {
  // Check explicit expiration first
  if (expiresAt && expiresAt <= now) {
    return {
      status: "expired",
      reason: `Content expired on ${expiresAt.toISOString().split("T")[0]}`,
      daysSincePublished: publishedAt ? Math.floor((now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)) : null,
    }
  }

  if (!publishedAt) {
    return {
      status: "fresh",
      reason: "No published date - treating as fresh",
      daysSincePublished: null,
    }
  }

  const daysSincePublished = Math.floor(
    (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)
  )

  const threshold = getStalenessThreshold(categoryId)

  // Very old content should be archived
  if (daysSincePublished > threshold * 3) {
    return {
      status: "archived",
      reason: `Content is ${daysSincePublished} days old (threshold: ${threshold * 3} for archival)`,
      daysSincePublished,
    }
  }

  // Stale content
  if (daysSincePublished > threshold) {
    return {
      status: "stale",
      reason: `Content is ${daysSincePublished} days old (threshold: ${threshold} days for ${categoryId || "default"})`,
      daysSincePublished,
    }
  }

  return {
    status: "fresh",
    reason: `Content is ${daysSincePublished} days old (within ${threshold} day threshold)`,
    daysSincePublished,
  }
}

/**
 * Check if a post is approaching staleness (warning period)
 */
export function isApproachingStaleness(
  publishedAt: Date | null,
  categoryId: string | null,
  now: Date = new Date()
): boolean {
  if (!publishedAt) return false

  const daysSincePublished = Math.floor(
    (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)
  )

  const threshold = getStalenessThreshold(categoryId)
  const warningStart = threshold - WARNING_THRESHOLD_DAYS

  return daysSincePublished >= warningStart && daysSincePublished <= threshold
}

/**
 * Run staleness check on all published posts
 */
export async function checkAllPostsStaleness(): Promise<{
  results: StalenessCheckResult[]
  summary: StalenessCheckSummary
}> {
  const now = new Date()
  const results: StalenessCheckResult[] = []
  const summary: StalenessCheckSummary = {
    checked: 0,
    fresh: 0,
    stale: 0,
    expired: 0,
    archived: 0,
    warnings: 0,
    errors: [],
  }

  try {
    // Get all published posts
    const posts = await drizzleDb
      .select({
        id: newsPosts.id,
        title: newsPosts.title,
        publishedAt: newsPosts.publishedAt,
        expiresAt: newsPosts.expiresAt,
        categoryId: newsPosts.categoryId,
        freshnessStatus: newsPosts.freshnessStatus,
      })
      .from(newsPosts)
      .where(eq(newsPosts.status, "published"))

    summary.checked = posts.length

    for (const post of posts) {
      try {
        const { status, reason, daysSincePublished } = determineFreshnessStatus(
          post.publishedAt,
          post.expiresAt,
          post.categoryId,
          now
        )

        results.push({
          postId: post.id,
          title: post.title,
          publishedAt: post.publishedAt,
          currentStatus: post.freshnessStatus as FreshnessStatus | null,
          newStatus: status,
          reason,
          daysSincePublished,
          expiresAt: post.expiresAt,
        })

        // Update summary counts
        summary[status]++

        // Check for warnings
        if (status === "fresh" && isApproachingStaleness(post.publishedAt, post.categoryId, now)) {
          summary.warnings++
        }

        // Update the post if status changed
        if (post.freshnessStatus !== status) {
          await drizzleDb
            .update(newsPosts)
            .set({
              freshnessStatus: status,
              freshnessCheckedAt: now,
              updatedAt: now,
            })
            .where(eq(newsPosts.id, post.id))
        } else {
          // Just update the check timestamp
          await drizzleDb
            .update(newsPosts)
            .set({
              freshnessCheckedAt: now,
            })
            .where(eq(newsPosts.id, post.id))
        }
      } catch (error) {
        const errorMsg = `Failed to check post ${post.id}: ${error instanceof Error ? error.message : String(error)}`
        summary.errors.push(errorMsg)
        console.error(`[StalenessChecker] ${errorMsg}`)
      }
    }
  } catch (error) {
    const errorMsg = `Failed to fetch posts: ${error instanceof Error ? error.message : String(error)}`
    summary.errors.push(errorMsg)
    console.error(`[StalenessChecker] ${errorMsg}`)
  }

  return { results, summary }
}

/**
 * Get posts that need review (stale or approaching staleness)
 */
export async function getPostsNeedingReview(
  limit: number = 50
): Promise<StalenessCheckResult[]> {
  const now = new Date()

  // Get stale and expired posts
  const stalePosts = await drizzleDb
    .select({
      id: newsPosts.id,
      title: newsPosts.title,
      publishedAt: newsPosts.publishedAt,
      expiresAt: newsPosts.expiresAt,
      categoryId: newsPosts.categoryId,
      freshnessStatus: newsPosts.freshnessStatus,
    })
    .from(newsPosts)
    .where(
      and(
        eq(newsPosts.status, "published"),
        or(
          eq(newsPosts.freshnessStatus, "stale"),
          eq(newsPosts.freshnessStatus, "expired")
        )
      )
    )
    .orderBy(desc(newsPosts.publishedAt))
    .limit(limit)

  return stalePosts.map((post) => {
    const { status, reason, daysSincePublished } = determineFreshnessStatus(
      post.publishedAt,
      post.expiresAt,
      post.categoryId,
      now
    )

    return {
      postId: post.id,
      title: post.title,
      publishedAt: post.publishedAt,
      currentStatus: post.freshnessStatus as FreshnessStatus | null,
      newStatus: status,
      reason,
      daysSincePublished,
      expiresAt: post.expiresAt,
    }
  })
}

/**
 * Mark a post as verified (content accuracy confirmed)
 */
export async function markPostAsVerified(postId: string): Promise<void> {
  const now = new Date()
  await drizzleDb
    .update(newsPosts)
    .set({
      lastVerifiedAt: now,
      freshnessStatus: "fresh",
      freshnessCheckedAt: now,
      updatedAt: now,
    })
    .where(eq(newsPosts.id, postId))
}

/**
 * Set expiration date for time-sensitive content
 */
export async function setPostExpiration(
  postId: string,
  expiresAt: Date
): Promise<void> {
  await drizzleDb
    .update(newsPosts)
    .set({
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(newsPosts.id, postId))
}

/**
 * Archive old posts (bulk operation)
 */
export async function archiveOldPosts(
  olderThanDays: number = 180
): Promise<{ archived: number }> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

  const result = await drizzleDb
    .update(newsPosts)
    .set({
      freshnessStatus: "archived",
      freshnessCheckedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(newsPosts.status, "published"),
        lt(newsPosts.publishedAt, cutoffDate),
        sql`${newsPosts.freshnessStatus} != 'archived'`
      )
    )

  return { archived: result.rowCount || 0 }
}

/**
 * Get freshness statistics for dashboard
 */
export async function getFreshnessStats(): Promise<{
  total: number
  fresh: number
  stale: number
  expired: number
  archived: number
  neverChecked: number
  averageAge: number | null
}> {
  const stats = await drizzleDb
    .select({
      freshnessStatus: newsPosts.freshnessStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(newsPosts)
    .where(eq(newsPosts.status, "published"))
    .groupBy(newsPosts.freshnessStatus)

  const result = {
    total: 0,
    fresh: 0,
    stale: 0,
    expired: 0,
    archived: 0,
    neverChecked: 0,
    averageAge: null as number | null,
  }

  for (const row of stats) {
    const count = row.count
    result.total += count

    if (row.freshnessStatus === "fresh") result.fresh = count
    else if (row.freshnessStatus === "stale") result.stale = count
    else if (row.freshnessStatus === "expired") result.expired = count
    else if (row.freshnessStatus === "archived") result.archived = count
    else result.neverChecked += count
  }

  // Calculate average age
  const ageResult = await drizzleDb
    .select({
      avgAge: sql<number>`avg(extract(epoch from (now() - ${newsPosts.publishedAt})) / 86400)::numeric(10,1)`,
    })
    .from(newsPosts)
    .where(
      and(
        eq(newsPosts.status, "published"),
        sql`${newsPosts.publishedAt} is not null`
      )
    )

  if (ageResult[0]?.avgAge) {
    result.averageAge = parseFloat(ageResult[0].avgAge.toString())
  }

  return result
}
