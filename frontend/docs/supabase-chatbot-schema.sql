-- ============================================================
-- Griffin's Web Services — Supabase Schema
-- Run this in: https://supabase.com/dashboard/project/afvzesojldpbfaiedwme/sql/new
-- ============================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Knowledge Documents table (file cache/index)
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  filename     TEXT        NOT NULL UNIQUE,
  content      TEXT,
  content_type TEXT,        -- stores composite metadata: "mime|etag|size"
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Knowledge Chunks table (vector embeddings)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID        REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  filename     TEXT        NOT NULL,
  chunk_index  INTEGER     NOT NULL,
  content      TEXT        NOT NULL,
  embedding    VECTOR(1536),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Vector similarity search function
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.2,
  match_count     INT   DEFAULT 5
)
RETURNS TABLE (
  id         UUID,
  filename   TEXT,
  content    TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.filename,
    kc.content,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. IVFFlat index for fast approximate nearest-neighbor search
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 6. Row Level Security
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks    ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by the chat API server-side)
CREATE POLICY "service_role_all_documents"
  ON knowledge_documents FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_chunks"
  ON knowledge_chunks FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 7. Create the knowledge-base storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-base',
  'knowledge-base',
  false,
  52428800, -- 50MB limit
  ARRAY['text/plain', 'text/markdown', 'application/pdf', 'application/json']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: service role can do everything
CREATE POLICY "service_role_storage_all"
  ON storage.objects FOR ALL
  TO service_role USING (bucket_id = 'knowledge-base') WITH CHECK (bucket_id = 'knowledge-base');
