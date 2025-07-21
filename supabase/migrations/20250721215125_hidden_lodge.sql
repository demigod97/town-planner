/*
  # Create performance indexes

  1. Chat Message Indexes
    - session_id for fast message retrieval
    - created_at for chronological ordering

  2. Template Indexes
    - user_id for user template queries
    - session_id for session-based templates
    - permit_type for filtering by type

  3. PDF Vector Indexes
    - upload_id for document-based queries
    - vector similarity search index (ivfflat)

  4. Upload Indexes
    - user_id for user upload queries
    - created_at for chronological ordering
*/

-- Chat Messages Indexes
CREATE INDEX IF NOT EXISTS idx_hh_chat_messages_session_id ON public.hh_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_hh_chat_messages_created_at ON public.hh_chat_messages(created_at);

-- Chat Sessions Indexes
CREATE INDEX IF NOT EXISTS idx_hh_chat_sessions_user_id ON public.hh_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_hh_chat_sessions_updated_at ON public.hh_chat_sessions(updated_at);

-- Templates Indexes
CREATE INDEX IF NOT EXISTS idx_hh_templates_user_id ON public.hh_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_hh_templates_session_id ON public.hh_templates(session_id);
CREATE INDEX IF NOT EXISTS idx_hh_templates_permit_type ON public.hh_templates(permit_type);
CREATE INDEX IF NOT EXISTS idx_hh_templates_created_at ON public.hh_templates(created_at);

-- PDF Vectors Indexes
CREATE INDEX IF NOT EXISTS idx_hh_pdf_vectors_upload_id ON public.hh_pdf_vectors(upload_id);

-- Vector similarity search index (only create if vectors table has data or for future use)
-- This uses ivfflat algorithm for approximate nearest neighbor search
DO $$
BEGIN
  -- Create the vector index for similarity search
  CREATE INDEX IF NOT EXISTS idx_hh_pdf_vectors_embedding 
  ON public.hh_pdf_vectors 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);
EXCEPTION
  WHEN others THEN
    -- If index creation fails (e.g., no data), just log and continue
    RAISE NOTICE 'Vector index creation skipped: %', SQLERRM;
END $$;

-- Upload Indexes
CREATE INDEX IF NOT EXISTS idx_hh_uploads_user_id ON public.hh_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_hh_uploads_created_at ON public.hh_uploads(created_at);

-- User Profiles Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);