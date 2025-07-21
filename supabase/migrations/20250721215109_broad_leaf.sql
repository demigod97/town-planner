/*
  # Create helper functions for application logic

  1. User Management Functions
    - handle_new_user() - Creates profile on user signup
    - is_admin() - Checks if user has admin role

  2. Chat Functions
    - get_user_chat_sessions_with_count() - Get sessions with message counts
    - get_session_messages() - Get messages for a session

  3. Upload Functions
    - get_user_uploads_with_status() - Get uploads with processing status

  4. Vector Search Functions
    - search_similar_vectors() - Semantic search for RAG
*/

-- Function to handle new user signups (creates profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', new.email));
  RETURN new;
END;
$$;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE id = user_id 
    AND role = 'admin'
  );
$$;

-- Function to get user's chat sessions with message count
CREATE OR REPLACE FUNCTION get_user_chat_sessions_with_count(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  message_count BIGINT
)
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT 
    s.id,
    s.title,
    s.created_at,
    s.updated_at,
    COALESCE(m.count, 0) as message_count
  FROM hh_chat_sessions s
  LEFT JOIN (
    SELECT session_id, COUNT(*) as count
    FROM hh_chat_messages
    GROUP BY session_id
  ) m ON s.id = m.session_id
  WHERE s.user_id = user_uuid
  ORDER BY s.updated_at DESC;
$$;

-- Function to get session messages
CREATE OR REPLACE FUNCTION get_session_messages(session_uuid UUID)
RETURNS TABLE (
  id UUID,
  role TEXT,
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT 
    m.id,
    m.role,
    m.content,
    m.metadata,
    m.created_at
  FROM hh_chat_messages m
  JOIN hh_chat_sessions s ON m.session_id = s.id
  WHERE s.id = session_uuid 
    AND s.user_id = auth.uid()
  ORDER BY m.created_at ASC;
$$;

-- Function to get user's uploads with processing status
CREATE OR REPLACE FUNCTION get_user_uploads_with_status(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  filename TEXT,
  file_size BIGINT,
  file_path TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  vector_count BIGINT,
  is_processed BOOLEAN
)
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT 
    u.id,
    u.filename,
    u.file_size,
    u.file_path,
    u.created_at,
    u.updated_at,
    COALESCE(v.count, 0) as vector_count,
    COALESCE(v.count, 0) > 0 as is_processed
  FROM hh_uploads u
  LEFT JOIN (
    SELECT upload_id, COUNT(*) as count
    FROM hh_pdf_vectors
    GROUP BY upload_id
  ) v ON u.id = v.upload_id
  WHERE u.user_id = user_uuid
  ORDER BY u.created_at DESC;
$$;

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