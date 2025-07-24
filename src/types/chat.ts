/**
 * 📄 chat.ts
 * Part of the HHLM project – town-planning RAG assistant
 * Purpose: TypeScript interfaces for chat system
 * Generated: 2025-01-27
 * ------------------------------------------------------
 * Comprehensive type definitions for chat functionality
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    chunks_retrieved?: string[];
    sources_cited?: string[];
    processing_time_ms?: number;
    model_used?: string;
    citations?: Citation[];
    error?: string;
    timestamp?: string;
  };
  created_at?: string;
  session_id?: string;
  status?: 'sending' | 'processing' | 'completed' | 'error';
}

export interface Citation {
  id: string;
  title: string;
  excerpt: string;
  page_number?: number;
  source_id?: string;
  confidence?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  notebook_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
  total_messages: number;
  is_active: boolean;
  llm_provider?: string;
  llm_model?: string;
  source_ids?: string[];
}

export interface MessageContentData {
  type: 'text' | 'error' | 'loading' | 'system';
  content: string;
  citations?: Citation[];
  metadata?: Record<string, any>;
}

export interface SessionState {
  currentSessionId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
}

export interface RealtimeMessagePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: ChatMessage;
  old?: ChatMessage;
}