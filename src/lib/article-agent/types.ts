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
export const THRESHOLDS = {
  PARAGRAPH_PASS: parseFloat(process.env.ARTICLE_AGENT_PASS_THRESHOLD || "0.8"),
  PARAGRAPH_FAIL: parseFloat(process.env.ARTICLE_AGENT_FAIL_THRESHOLD || "0.5"),
  JOB_AUTO_APPROVE: 0.85,
  MAX_ITERATIONS: parseInt(process.env.ARTICLE_AGENT_MAX_ITERATIONS || "3"),
  MIN_SUPPORTING_CLAIMS: 1,
  TOP_K_CHUNKS: 5,
} as const
