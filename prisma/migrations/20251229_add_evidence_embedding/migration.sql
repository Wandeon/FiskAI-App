-- Add vector embedding column to Evidence for semantic duplicate detection
-- Uses pgvector extension (nomic-embed-text, 768 dimensions)

-- Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to Evidence table
-- Generated from rawContent (or normalized excerpt for large docs)
-- Enables semantic similarity detection beyond content hash matching
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- Add index for vector similarity search (using cosine distance)
-- This enables efficient semantic duplicate detection
CREATE INDEX IF NOT EXISTS "evidence_embedding_idx" ON "Evidence"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);

-- Note: The index will be populated as embeddings are generated
-- Use the backfill script to generate embeddings for existing records
