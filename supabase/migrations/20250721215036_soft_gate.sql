/*
  # Create Row Level Security policies

  1. User Profiles Policies
    - Users can view and update their own profile
    - Users can insert their own profile on signup

  2. Chat Sessions Policies
    - Users can manage their own chat sessions
    - Full CRUD operations for session owners

  3. Chat Messages Policies
    - Users can view messages from their own sessions
    - Users can create messages in their own sessions

  4. Templates Policies
    - Users can manage their own templates
    - Full CRUD operations for template owners

  5. PDF Vectors Policies
    - Users can view vectors from their own uploads
    - System can manage all vectors (for processing)

  6. Uploads Policies
    - Users can manage their own uploads
    - Full CRUD operations for upload owners
*/

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

DROP POLICY IF EXISTS "Users can delete their own chat sessions" ON public.hh_chat_sessions;
CREATE POLICY "Users can delete their own chat sessions" 
ON public.hh_chat_sessions 
FOR DELETE 
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