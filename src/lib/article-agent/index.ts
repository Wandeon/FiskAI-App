// src/lib/article-agent/index.ts

// Types
export * from "./types"

// LLM clients
export * from "./llm"

// Extraction
export { fetchUrl, fetchUrls } from "./extraction/fetcher"
export { chunkText, chunkMultiple } from "./extraction/chunker"
export { extractClaimsFromChunk, extractKeyEntities } from "./extraction/claim-extractor"

// Verification
export { embedText, embedBatch } from "./verification/embedder"
export { findSimilarChunks, updateChunkEmbedding } from "./verification/similarity"
export { classifySupport, classifyParagraphAgainstChunks } from "./verification/classifier"

// Utils
export * from "./utils/confidence"

// Steps
export { synthesizeFactSheet } from "./steps/synthesize"
export { writeDraft } from "./steps/draft"
export { verifyDraft } from "./steps/verify"
export { rewriteFailingParagraphs } from "./steps/rewrite"
export { publishArticle, generateSlug } from "./steps/publish"

// Orchestrator
export { runArticleJob, createArticleJob } from "./orchestrator"
