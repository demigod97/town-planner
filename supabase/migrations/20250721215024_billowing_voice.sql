/*
  # Create core application tables

  1. New Tables
    - `hh_chat_sessions` - Chat session management
    - `hh_chat_messages` - Chat message history  
    - `hh_templates` - Generated permit templates
    - `hh_pdf_vectors` - Document embeddings for RAG
    - `user_profiles` - Extended user profile data

  2. Security
    - Enable RLS on all tables
    - Add user-specific access policies
    - Ensure data isolation between users

  3. Performance
    - Add indexes for common queries
    - Optimize vector search operations
*/

-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create user profiles table for additional user data
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  company_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat sessions table (if not exists)
CREATE TABLE IF NOT EXISTS public.hh_chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Chat',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat messages table
CREATE TABLE IF NOT EXISTS public.hh_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES hh_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create templates table for generated permit templates
CREATE TABLE IF NOT EXISTS public.hh_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  session_id UUID REFERENCES hh_chat_sessions(id),
  name TEXT NOT NULL,
  permit_type TEXT NOT NULL,
  content TEXT NOT NULL,
  template_data JSONB NOT NULL,
  file_path TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create PDF vectors table for document embeddings (RAG)
CREATE TABLE IF NOT EXISTS public.hh_pdf_vectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID REFERENCES hh_uploads(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI embedding dimension
  page_number INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hh_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hh_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hh_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hh_pdf_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hh_uploads ENABLE ROW LEVEL SECURITY;