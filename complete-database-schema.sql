-- ============================================================================
-- HHLM Town Planner - Complete Database Schema
-- ============================================================================
-- This file contains the complete database schema for the Town Planner project
-- It consolidates all migrations into a single, comprehensive setup
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. CORE FUNCTIONS
-- ============================================================================

-- Create the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 2. STORAGE BUCKETS
-- ============================================================================

-- Create storage bucket for PDF library
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hh_pdf_library', 'hh_pdf_library', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for templates
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hh_templates', 'hh_templates', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. USER PROFILES TABLE
-- ============================================================================

-- Create user profiles table for additional user data
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  company_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. CORE APPLICATION TABLES
-- ============================================================================

-- Create uploads table for PDF documents
CREATE TABLE IF NOT EXISTS public.hh_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_path TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create hh_chat_sessions table
CREATE TABLE IF NOT EXISTS public.hh_chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Chat',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create hh_chat_messages table for storing chat history
CREATE TABLE IF NOT EXISTS public.hh_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES hh_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create hh_templates table for generated permit templates
CREATE TABLE IF NOT EXISTS public.hh_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES hh_chat_sessions(id),
  permit_type TEXT NOT NULL,
  template_data JSONB NOT NULL,
  file_path TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create hh_pdf_vectors table for document embeddings (RAG)
CREATE TABLE IF NOT EXISTS public.hh_pdf_vectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID REFERENCES hh_uploads(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI embedding dimension
  page_number INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.hh_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hh_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hh_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hh_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hh_pdf_vectors ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- User Profiles Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
CREATE POLICY "Users can view their own profile" 
ON public.user_profiles 
FOR SELECT 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile" 
ON public.user_profiles 
FOR UPDATE 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
CREATE POLICY "Users can insert their own profile" 
ON public.user_profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Uploads Policies
DROP POLICY IF EXISTS "Users can view their own uploads" ON public.hh_uploads;
CREATE POLICY "Users can view their own uploads" 
ON public.hh_uploads 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own uploads" ON public.hh_uploads;
CREATE POLICY "Users can create their own uploads" 
ON public.hh_uploads 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own uploads" ON public.hh_uploads;
CREATE POLICY "Users can update their own uploads" 
ON public.hh_uploads 
FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own uploads" ON public.hh_uploads;
CREATE POLICY "Users can delete their own uploads" 
ON public.hh_uploads 
FOR DELETE 
USING (auth.uid() = user_id);

-- Chat Sessions Policies
DROP POLICY IF EXISTS "Users can view their own chat sessions" ON public.hh_chat_sessions;
CREATE POLICY "Users can view their own chat sessions" 
ON public.hh_chat_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own chat sessions" ON public.hh_chat_sessions;
CREATE POLICY "Users can create their own chat sessions" 
ON public.hh_chat_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own chat sessions" ON public.hh_chat_sessions;
CREATE POLICY "Users can update their own chat sessions" 
ON public.hh_chat_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Chat Messages Policies
DROP POLICY IF EXISTS "Users can view messages from their own sessions" ON public.hh_chat_messages;
CREATE POLICY "Users can view messages from their own sessions" 
ON public.hh_chat_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM hh_chat_sessions 
    WHERE hh_chat_sessions.id = hh_chat_messages.session_id 
    AND hh_chat_sessions.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create messages in their own sessions" ON public.hh_chat_messages;
CREATE POLICY "Users can create messages in their own sessions" 
ON public.hh_chat_messages 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM hh_chat_sessions 
    WHERE hh_chat_sessions.id = hh_chat_messages.session_id 
    AND hh_chat_sessions.user_id = auth.uid()
  )
);

-- Templates Policies
DROP POLICY IF EXISTS "Users can view their own templates" ON public.hh_templates;
CREATE POLICY "Users can view their own templates" 
ON public.hh_templates 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own templates" ON public.hh_templates;
CREATE POLICY "Users can create their own templates" 
ON public.hh_templates 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own templates" ON public.hh_templates;
CREATE POLICY "Users can update their own templates" 
ON public.hh_templates 
FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own templates" ON public.hh_templates;
CREATE POLICY "Users can delete their own templates" 
ON public.hh_templates 
FOR DELETE 
USING (auth.uid() = user_id);

-- PDF Vectors Policies
DROP POLICY IF EXISTS "Users can view vectors from their own uploads" ON public.hh_pdf_vectors;
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

DROP POLICY IF EXISTS "System can manage all vectors" ON public.hh_pdf_vectors;
CREATE POLICY "System can manage all vectors" 
ON public.hh_pdf_vectors 
FOR ALL 
USING (auth.role() = 'service_role');

-- ============================================================================
-- 7. STORAGE POLICIES
-- ============================================================================

-- PDF Library Storage Policies
DROP POLICY IF EXISTS "Users can view their own pdf files" ON storage.objects;
CREATE POLICY "Users can view their own pdf files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'hh_pdf_library' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can upload their own pdf files" ON storage.objects;
CREATE POLICY "Users can upload their own pdf files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'hh_pdf_library' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own pdf files" ON storage.objects;
CREATE POLICY "Users can update their own pdf files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'hh_pdf_library' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own pdf files" ON storage.objects;
CREATE POLICY "Users can delete their own pdf files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'hh_pdf_library' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Templates Storage Policies
DROP POLICY IF EXISTS "Users can view their own template files" ON storage.objects;
CREATE POLICY "Users can view their own template files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'hh_templates' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can upload their own template files" ON storage.objects;
CREATE POLICY "Users can upload their own template files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'hh_templates' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own template files" ON storage.objects;
CREATE POLICY "Users can update their own template files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'hh_templates' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own template files" ON storage.objects;
CREATE POLICY "Users can delete their own template files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'hh_templates' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================================
-- 8. TRIGGERS
-- ============================================================================

-- Add triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hh_uploads_updated_at ON public.hh_uploads;
CREATE TRIGGER update_hh_uploads_updated_at
BEFORE UPDATE ON public.hh_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hh_chat_sessions_updated_at ON public.hh_chat_sessions;
CREATE TRIGGER update_hh_chat_sessions_updated_at
BEFORE UPDATE ON public.hh_chat_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hh_templates_updated_at ON public.hh_templates;
CREATE TRIGGER update_hh_templates_updated_at
BEFORE UPDATE ON public.hh_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 9. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Chat Messages Indexes
CREATE INDEX IF NOT EXISTS idx_hh_chat_messages_session_id ON public.hh_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_hh_chat_messages_created_at ON public.hh_chat_messages(created_at);

-- Templates Indexes
CREATE INDEX IF NOT EXISTS idx_hh_templates_user_id ON public.hh_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_hh_templates_session_id ON public.hh_templates(session_id);
CREATE INDEX IF NOT EXISTS idx_hh_templates_permit_type ON public.hh_templates(permit_type);

-- PDF Vectors Indexes
CREATE INDEX IF NOT EXISTS idx_hh_pdf_vectors_upload_id ON public.hh_pdf_vectors(upload_id);
CREATE INDEX IF NOT EXISTS idx_hh_pdf_vectors_embedding ON public.hh_pdf_vectors 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- 10. HELPER FUNCTIONS
-- ============================================================================

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

-- ============================================================================
-- 11. ADMIN POLICIES
-- ============================================================================

-- Add admin policies for system management
DROP POLICY IF EXISTS "Admins can view all uploads" ON public.hh_uploads;
CREATE POLICY "Admins can view all uploads" 
ON public.hh_uploads 
FOR SELECT 
USING (is_admin());

DROP POLICY IF EXISTS "Admins can view all sessions" ON public.hh_chat_sessions;
CREATE POLICY "Admins can view all sessions" 
ON public.hh_chat_sessions 
FOR SELECT 
USING (is_admin());

DROP POLICY IF EXISTS "Admins can view all messages" ON public.hh_chat_messages;
CREATE POLICY "Admins can view all messages" 
ON public.hh_chat_messages 
FOR SELECT 
USING (is_admin());

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================

-- Verify setup with a simple query
SELECT 
  'Database schema setup completed successfully!' as status,
  now() as timestamp;

-- Show all created tables
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'hh_%' 
  OR table_name = 'user_profiles'
ORDER BY table_name;