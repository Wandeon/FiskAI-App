-- Migration: Add ConceptEmbedding table for semantic search
-- Created: 2025-12-29
-- Purpose: Enable semantic search in AI Assistant using pgvector

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create ConceptEmbedding table
CREATE TABLE IF NOT EXISTS "ConceptEmbedding" (
  "id" TEXT PRIMARY KEY,
  "conceptId" TEXT NOT NULL UNIQUE,
  "embedding" vector(768),
  "embeddingText" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT "ConceptEmbedding_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE
);

-- Create index on conceptId for faster lookups
CREATE INDEX IF NOT EXISTS "ConceptEmbedding_conceptId_idx" ON "ConceptEmbedding"("conceptId");

-- Create ivfflat index for fast vector similarity search
-- Using 10 lists for small to medium datasets (adjust based on concept count)
CREATE INDEX IF NOT EXISTS "ConceptEmbedding_embedding_idx"
  ON "ConceptEmbedding"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- Note: Run generate-concept-embeddings.ts script to populate embeddings
