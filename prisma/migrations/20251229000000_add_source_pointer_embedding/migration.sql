-- Add vector embedding column to SourcePointer for semantic search
-- Uses pgvector extension (nomic-embed-text, 768 dimensions)

-- Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to SourcePointer table
-- Generated from exactQuote + contextBefore + contextAfter
-- Enables semantic similarity search beyond keyword matching
ALTER TABLE "SourcePointer" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- Add index for vector similarity search (using cosine distance)
-- This enables efficient semantic search queries
CREATE INDEX IF NOT EXISTS "source_pointer_embedding_idx" ON "SourcePointer"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);

-- Note: The index will be populated as embeddings are generated
-- Use the backfill script to generate embeddings for existing records
