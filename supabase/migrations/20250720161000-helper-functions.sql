-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Create function to get user's chat sessions with message count
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

-- Create function to get session messages
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

-- Create function to get user's uploads with processing status
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