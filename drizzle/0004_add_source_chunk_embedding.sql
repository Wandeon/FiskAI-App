-- drizzle/0004_add_source_chunk_embedding.sql
-- Add embedding column to SourceChunk table
-- Requires pgvector extension from migration 0003

DO $$
BEGIN
  -- Only add vector column if pgvector extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    -- Add embedding column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'SourceChunk' AND column_name = 'embedding'
    ) THEN
      ALTER TABLE "SourceChunk" ADD COLUMN embedding vector(768);
      RAISE NOTICE 'Added embedding column to SourceChunk';
    END IF;

    -- Create IVFFlat index for fast similarity search
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE indexname = 'source_chunk_embedding_idx'
    ) THEN
      CREATE INDEX source_chunk_embedding_idx
      ON "SourceChunk"
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
      RAISE NOTICE 'Created source_chunk_embedding_idx';
    END IF;
  ELSE
    RAISE WARNING 'pgvector not installed - skipping embedding column and index';
  END IF;
END $$;
