-- drizzle/0003_add_pgvector.sql
-- Enable pgvector extension for embedding similarity search
-- Note: pgvector must be installed on the PostgreSQL server first
-- Install with: apt install postgresql-16-pgvector (or via docker image)

DO $$
BEGIN
  -- Only create extension if pgvector is available on the server
  IF EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS vector;
    RAISE NOTICE 'pgvector extension enabled';
  ELSE
    RAISE WARNING 'pgvector extension not available - Article Agent embeddings will not work until installed';
  END IF;
END $$;
