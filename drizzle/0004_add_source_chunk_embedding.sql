-- drizzle/0004_add_source_chunk_embedding.sql
-- Add embedding column to SourceChunk table

ALTER TABLE "SourceChunk"
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create IVFFlat index for fast similarity search
-- lists = sqrt(num_rows) is a good starting point, we use 100 for expected scale
CREATE INDEX IF NOT EXISTS source_chunk_embedding_idx
ON "SourceChunk"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
