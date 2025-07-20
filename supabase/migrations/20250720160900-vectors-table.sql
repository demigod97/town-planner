-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create hh_pdf_vectors table for document embeddings (RAG)
CREATE TABLE public.hh_pdf_vectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID REFERENCES hh_uploads(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI embedding dimension
  page_number INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hh_pdf_vectors ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - users can only access vectors from their own uploads
CREATE POLICY "Users can view vectors from their own uploads" 
ON public.hh_pdf_vectors 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM hh_uploads 
    WHERE hh_uploads.id = hh_pdf_vectors.upload_id 
    AND hh_uploads.user_id = auth.uid()
  )
);

CREATE POLICY "System can manage all vectors" 
ON public.hh_pdf_vectors 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create indexes for better performance
CREATE INDEX idx_hh_pdf_vectors_upload_id ON public.hh_pdf_vectors(upload_id);
CREATE INDEX idx_hh_pdf_vectors_embedding ON public.hh_pdf_vectors 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Function to search similar vectors
CREATE OR REPLACE FUNCTION search_similar_vectors(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.8,
  match_count INT DEFAULT 10,
  filter_upload_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  upload_id UUID,
  chunk_text TEXT,
  page_number INTEGER,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    v.id,
    v.upload_id,
    v.chunk_text,
    v.page_number,
    v.metadata,
    1 - (v.embedding <=> query_embedding) AS similarity
  FROM hh_pdf_vectors v
  WHERE 
    (filter_upload_ids IS NULL OR v.upload_id = ANY(filter_upload_ids))
    AND 1 - (v.embedding <=> query_embedding) > match_threshold
  ORDER BY v.embedding <=> query_embedding
  LIMIT match_count;
$$;