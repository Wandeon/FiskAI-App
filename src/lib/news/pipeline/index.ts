/**
 * FiskAI News Processing Pipeline
 *
 * 3-pass AI pipeline for quality news processing:
 * - Pass 1: Classify & Write
 * - Pass 2: Review
 * - Pass 3: Rewrite & Finalize
 */

// DeepSeek API client
export { callDeepSeek, callDeepSeekJSON, DeepSeekError } from "./deepseek-client"

// Pass 1: Classification
export { classifyNewsItem, classifyNewsItems, type ClassificationResult } from "./classifier"

// Pass 1: Writing
export { writeArticle, writeArticles, type ArticleContent } from "./writer"

// Pass 2: Review
export { reviewArticle, reviewArticles, needsRewrite, type ReviewFeedback } from "./reviewer"

// Pass 3: Rewrite
export { rewriteArticle, rewriteArticles, type RewriteResult } from "./rewriter"

// Digest Assembly
export {
  assembleDigest,
  assembleSimpleDigest,
  type DigestContent,
  type DigestSection,
} from "./digest-assembler"

// Error Recovery
export {
  withRetry,
  recordNewsItemError,
  recordNewsPostError,
  getFailedNewsItems,
  getFailedNewsPosts,
  resetNewsItemForReprocessing,
  resetNewsPostForReprocessing,
  getRetryableNewsItems,
  getPipelineHealthStats,
  calculateBackoffDelay,
  MAX_PROCESSING_ATTEMPTS,
  DEAD_LETTER_STATUS,
  PipelineRetryExhaustedError,
  type RetryConfig,
} from "./error-recovery"

// Staleness Detection
export {
  checkAllPostsStaleness,
  getPostsNeedingReview,
  markPostAsVerified,
  setPostExpiration,
  archiveOldPosts,
  getFreshnessStats,
  determineFreshnessStatus,
  isApproachingStaleness,
  getStalenessThreshold,
  STALENESS_THRESHOLDS,
  WARNING_THRESHOLD_DAYS,
  type FreshnessStatus,
  type StalenessCheckResult,
  type StalenessCheckSummary,
} from "./staleness-checker"

/**
 * Full pipeline orchestration example:
 *
 * ```typescript
 * import { db } from '@/lib/db';
 * import { newsItems } from '@/lib/db/schema/news';
 * import {
 *   classifyNewsItems,
 *   writeArticles,
 *   reviewArticles,
 *   rewriteArticles,
 *   assembleDigest,
 * } from '@/lib/news/pipeline';
 *
 * // Pass 1: Classify & Write
 * const items = await db.select().from(newsItems).where(...);
 * const classifications = await classifyNewsItems(items);
 *
 * const highImpact = items.filter(item =>
 *   classifications.get(item.id)?.impact === 'high'
 * );
 * const mediumImpact = items.filter(item =>
 *   classifications.get(item.id)?.impact === 'medium'
 * );
 *
 * const drafts = await writeArticles(
 *   highImpact.map(item => ({
 *     item,
 *     impact: 'high' as const
 *   }))
 * );
 *
 * // Pass 2: Review
 * const reviews = await reviewArticles(
 *   Array.from(drafts.entries()).map(([id, draft]) => ({
 *     id,
 *     title: draft.title,
 *     content: draft.content,
 *   }))
 * );
 *
 * // Pass 3: Rewrite (only if needed)
 * const needsRewriteList = Array.from(reviews.entries())
 *   .filter(([_, feedback]) => feedback.score < 7)
 *   .map(([id, feedback]) => ({
 *     id,
 *     draft: drafts.get(id)!,
 *     feedback,
 *   }));
 *
 * const rewrites = await rewriteArticles(needsRewriteList);
 *
 * // Digest Assembly
 * const digest = await assembleDigest(
 *   mediumImpact.map(item => ({
 *     id: item.id,
 *     title: item.originalTitle,
 *     summary: item.summaryHr || '',
 *     sourceUrl: item.sourceUrl,
 *   }))
 * );
 * ```
 */
