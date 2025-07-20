-- Create hh_chat_messages table for storing chat history
CREATE TABLE public.hh_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES hh_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hh_chat_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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

-- Create index for better performance
CREATE INDEX idx_hh_chat_messages_session_id ON public.hh_chat_messages(session_id);
CREATE INDEX idx_hh_chat_messages_created_at ON public.hh_chat_messages(created_at);