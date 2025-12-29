// src/lib/article-agent/types.ts

import type { ArticleType, ArticleStatus } from "@prisma/client"

// Re-export Prisma types
export type { ArticleType, ArticleStatus }

// ─── Job Input ───────────────────────────────────────────────
export interface CreateJobInput {
  type: ArticleType
  sourceUrls: string[]
  topic?: string
  maxIterations?: number
}

// ─── Fact Sheet ──────────────────────────────────────────────
export interface KeyEntities {
  names: string[]
  dates: string[]
  amounts: string[]
  regulations: string[]
}

export interface FactSheetData {
  topic: string
  keyEntities: KeyEntities
  claims: ClaimData[]
  sourceChunks: SourceChunkData[]
}

export interface ClaimData {
  id: string
  statement: string
  quote: string | null
  sourceUrl: string
  category: ClaimCategory
  confidence: number
}

export type ClaimCategory = "deadline" | "amount" | "requirement" | "entity" | "general"

export interface SourceChunkData {
  id: string
  sourceUrl: string
  content: string
  hasEmbedding: boolean
}

// ─── Verification ────────────────────────────────────────────
export type SupportLevel = "SUPPORTED" | "PARTIALLY_SUPPORTED" | "NOT_SUPPORTED" | "CONTRADICTED"

export interface ParagraphVerification {
  index: number
  content: string
  isLocked: boolean
  confidence: number
  status: SupportLevel
  supportingClaims: Array<{
    claimId: string
    statement: string
    similarity: number
    relationship: SupportLevel
  }>
}

export interface VerificationResult {
  draftId: string
  iteration: number
  paragraphs: ParagraphVerification[]
  overallConfidence: number
  passCount: number
  failCount: number
  allParagraphsPass: boolean
  anyBelowThreshold: boolean
  anyCriticalFail: boolean
}

// ─── Orchestrator Events ─────────────────────────────────────
export type JobEvent =
  | { type: "SYNTHESIS_COMPLETE"; claimCount: number }
  | { type: "DRAFT_COMPLETE"; iteration: number; paragraphCount: number }
  | { type: "VERIFICATION_COMPLETE"; result: VerificationResult }
  | { type: "ITERATION_COMPLETE"; iteration: number; lockedCount: number }
  | { type: "JOB_APPROVED"; finalConfidence: number }
  | { type: "JOB_NEEDS_REVIEW"; reason: string }
  | { type: "JOB_FAILED"; error: string }

// ─── Thresholds ──────────────────────────────────────────────
// Now sourced from unified feature configuration
// @see /src/lib/config/features.ts for the single source of truth
import { getArticleAgentConfig } from "@/lib/config/features"

// Getter function to ensure config is always current
function getThresholds() {
  const config = getArticleAgentConfig()
  return {
    PARAGRAPH_PASS: config.passThreshold,
    PARAGRAPH_FAIL: config.failThreshold,
    JOB_AUTO_APPROVE: config.jobAutoApprove,
    MAX_ITERATIONS: config.maxIterations,
    MIN_SUPPORTING_CLAIMS: config.minSupportingClaims,
    TOP_K_CHUNKS: config.topKChunks,
  } as const
}

// Legacy export for backward compatibility
export const THRESHOLDS = {
  get PARAGRAPH_PASS() {
    return getThresholds().PARAGRAPH_PASS
  },
  get PARAGRAPH_FAIL() {
    return getThresholds().PARAGRAPH_FAIL
  },
  get JOB_AUTO_APPROVE() {
    return getThresholds().JOB_AUTO_APPROVE
  },
  get MAX_ITERATIONS() {
    return getThresholds().MAX_ITERATIONS
  },
  get MIN_SUPPORTING_CLAIMS() {
    return getThresholds().MIN_SUPPORTING_CLAIMS
  },
  get TOP_K_CHUNKS() {
    return getThresholds().TOP_K_CHUNKS
  },
} as const
