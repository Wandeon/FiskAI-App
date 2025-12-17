-- drizzle/0003_add_pgvector.sql
-- Enable pgvector extension for embedding similarity search

CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is available
SELECT extversion FROM pg_extension WHERE extname = 'vector';
