// src/lib/regulatory-truth/index.ts
// Croatian Regulatory Truth Layer - Main Entry Point

// Schemas and types
export * from "./schemas"

// Prompt templates
export { getAgentPrompt } from "./prompts"

// Agent implementations
export {
  runAgent,
  runSentinel,
  runExtractor,
  type AgentRunOptions,
  type AgentRunResult,
  type SentinelResult,
  type ExtractorResult,
} from "./agents"

// DSL
export {
  evaluateAppliesWhen,
  parseAppliesWhen,
  validateAppliesWhen,
  predicates,
  type AppliesWhenPredicate,
  type EvaluationContext,
  appliesWhenSchema,
} from "./dsl/applies-when"

export {
  parseOutcome,
  validateOutcome,
  outcomes,
  type Outcome,
  type Deadline,
  type Step,
  outcomeSchema,
  deadlineSchema,
  stepSchema,
} from "./dsl/outcome"

// Utilities
export { rateLimiter, fetchWithRateLimit, DomainRateLimiter } from "./utils/rate-limiter"
export { hashContent, normalizeContent, detectContentChange } from "./utils/content-hash"

// Parsers
export {
  parseSitemap,
  parseNNSitemapFilename,
  filterNNSitemaps,
  getLatestNNIssueSitemaps,
  type SitemapEntry,
  type NNSitemapMeta,
} from "./parsers/sitemap-parser"

export {
  parseHtmlList,
  findPaginationLinks,
  extractDocumentLinks,
  type ListItem,
  type ListParserConfig,
} from "./parsers/html-list-parser"

// Site Crawler
export {
  crawlSite,
  crawlAndRegisterUrls,
  type CrawlOptions,
  type CrawlResult,
  type CrawledUrl,
} from "./agents/site-crawler"

// Monitoring
export {
  collectMetrics,
  getEndpointHealth,
  getRecentAgentRuns,
  type PipelineMetrics,
} from "./monitoring/metrics"

// Scheduler
export {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  triggerManualRun,
} from "./scheduler/cron"
