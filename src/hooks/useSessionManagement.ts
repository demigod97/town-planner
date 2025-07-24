/**
 * 📄 useSessionManagement.ts
 * Part of the HHLM project – town-planning RAG assistant
 * Purpose: Advanced session management with real-time sync and recovery
 * Generated: 2025-01-27
 * ------------------------------------------------------
 * Handles session persistence, recovery, and real-time updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/api';
import type { ChatSession, ChatMessage, SessionState, RealtimeMessagePayload } from '@/types/chat';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { toast } from 'sonner';

interface UseSessionManagementOptions {
  notebookId: string;
  autoRestore?: boolean;
  enableRealtime?: boolean;
}

export function useSessionManagement({ 
  notebookId, 
  autoRestore = true, 
  enableRealtime = true 
}: UseSessionManagementOptions) {
  const [sessionState, setSessionState] = useState<SessionState>({
    currentSessionId: null,
    messages: [],
    isLoading: false,
    error: null,
    hasMore: false
  });

  const queryClient = useQueryClient();
  const { handleAsyncError } = useErrorHandler();
  const realtimeChannelRef = useRef<any>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Session storage keys
  const SESSION_STORAGE_KEY = `chat_session_${notebookId}`;
  const MESSAGES_STORAGE_KEY = `chat_messages_${sessionState.currentSessionId}`;

  /**
   * Load sessions for the current notebook
   */
  const { data: sessions = [], isLoading: sessionsLoading, error: sessionsError } = useQuery({
    queryKey: ['chat_sessions', notebookId],
    queryFn: async (): Promise<ChatSession[]> => {
      return handleAsyncError(async () => {
        const { data, error } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('notebook_id', notebookId)
          .order('updated_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
      }, { operation: 'fetch_sessions', notebookId });
    },
    staleTime: 30000, // 30 seconds
    retry: 3
  });

  /**
   * Load messages for current session
   */
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['chat_messages', sessionState.currentSessionId],
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!sessionState.currentSessionId) return [];
      
      return handleAsyncError(async () => {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionState.currentSessionId)
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
      }, { operation: 'fetch_messages', sessionId: sessionState.currentSessionId });
    },
    enabled: !!sessionState.currentSessionId,
    staleTime: 10000, // 10 seconds
  });

  /**
   * Create new chat session
   */
  const createSessionMutation = useMutation({
    mutationFn: async (title?: string): Promise<ChatSession> => {
      return handleAsyncError(async () => {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error('Authentication required');

        const { data, error } = await supabase
          .from('chat_sessions')
          .insert({
            user_id: user.id,
            notebook_id: notebookId,
            title: title || `Chat - ${new Date().toLocaleString()}`,
            is_active: true,
            total_messages: 0
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }, { operation: 'create_session', notebookId });
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ['chat_sessions', notebookId] });
      switchToSession(newSession.id);
      toast.success('New chat session created');
    },
    onError: (error) => {
      toast.error('Failed to create new session');
      console.error('Session creation error:', error);
    }
  });

  /**
   * Send message with optimistic updates
   */
  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, sessionId }: { message: string; sessionId: string }) => {
      return handleAsyncError(async () => {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error('Authentication required');

        // Store user message
        const { data: userMessage, error: messageError } = await supabase
          .from('chat_messages')
          .insert({
            session_id: sessionId,
            user_id: user.id,
            role: 'user',
            content: message
          })
          .select()
          .single();

        if (messageError) throw messageError;

        // Call n8n webhook for AI response
        const response = await fetch(import.meta.env.VITE_N8N_CHAT_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message,
            userId: user.id,
            notebookId,
            timestamp: new Date().toISOString()
          })
        });

        if (!response.ok) {
          throw new Error(`Chat service error: ${response.status}`);
        }

        return { userMessage, response: await response.json() };
      }, { operation: 'send_message', sessionId, messageLength: message.length });
    },
    onMutate: async ({ message, sessionId }) => {
      // Optimistic update - add user message immediately
      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        session_id: sessionId,
        status: 'sending',
        created_at: new Date().toISOString()
      };

      setSessionState(prev => ({
        ...prev,
        messages: [...prev.messages, optimisticMessage]
      }));

      return { optimisticMessage };
    },
    onSuccess: (data, variables, context) => {
      // Replace optimistic message with real one
      setSessionState(prev => ({
        ...prev,
        messages: prev.messages.map(msg => 
          msg.id === context?.optimisticMessage.id 
            ? { ...data.userMessage, status: 'completed' }
            : msg
        )
      }));

      // Add thinking indicator for AI response
      const thinkingMessage: ChatMessage = {
        id: `thinking-${Date.now()}`,
        role: 'assistant',
        content: 'AI is thinking...',
        session_id: variables.sessionId,
        status: 'processing',
        created_at: new Date().toISOString()
      };

      setSessionState(prev => ({
        ...prev,
        messages: [...prev.messages, thinkingMessage]
      }));
    },
    onError: (error, variables, context) => {
      // Remove optimistic message and show error
      setSessionState(prev => ({
        ...prev,
        messages: prev.messages.filter(msg => msg.id !== context?.optimisticMessage.id)
      }));

      toast.error('Failed to send message');
      console.error('Send message error:', error);
    }
  });

  /**
   * Switch to a different session
   */
  const switchToSession = useCallback(async (sessionId: string) => {
    try {
      // Save current session state
      if (sessionState.currentSessionId && sessionState.messages.length > 0) {
        saveSessionToStorage(sessionState.currentSessionId, sessionState.messages);
      }

      // Cleanup existing realtime subscription
      if (realtimeChannelRef.current) {
        await supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }

      // Update state
      setSessionState(prev => ({
        ...prev,
        currentSessionId: sessionId,
        messages: [],
        isLoading: true,
        error: null
      }));

      // Save session preference
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);

      // Setup realtime subscription for new session
      if (enableRealtime) {
        setupRealtimeSubscription(sessionId);
      }

      // Invalidate and refetch messages
      await queryClient.invalidateQueries({ queryKey: ['chat_messages', sessionId] });

    } catch (error) {
      console.error('Error switching session:', error);
      setSessionState(prev => ({ ...prev, error: 'Failed to switch session' }));
    }
  }, [sessionState.currentSessionId, sessionState.messages, enableRealtime, queryClient]);

  /**
   * Setup real-time subscription for chat messages
   */
  const setupRealtimeSubscription = useCallback((sessionId: string) => {
    if (!enableRealtime || !sessionId) return;

    try {
      const channel = supabase
        .channel(`chat_messages_${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_messages',
            filter: `session_id=eq.${sessionId}`
          },
          (payload: RealtimeMessagePayload) => {
            handleRealtimeMessage(payload);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Real-time subscription active for session:', sessionId);
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Real-time subscription error for session:', sessionId);
          }
        });

      realtimeChannelRef.current = channel;
    } catch (error) {
      console.error('Failed to setup realtime subscription:', error);
    }
  }, [enableRealtime]);

  /**
   * Handle real-time message updates
   */
  const handleRealtimeMessage = useCallback((payload: RealtimeMessagePayload) => {
    try {
      if (payload.eventType === 'INSERT' && payload.new) {
        const newMessage = payload.new;
        
        // Avoid duplicate messages
        if (lastMessageIdRef.current === newMessage.id) return;
        lastMessageIdRef.current = newMessage.id;

        setSessionState(prev => {
          // Remove thinking message if this is an AI response
          const filteredMessages = newMessage.role === 'assistant' 
            ? prev.messages.filter(msg => msg.status !== 'processing')
            : prev.messages;

          // Check if message already exists
          const exists = filteredMessages.some(msg => msg.id === newMessage.id);
          if (exists) return prev;

          return {
            ...prev,
            messages: [...filteredMessages, { ...newMessage, status: 'completed' }]
          };
        });

        // Update query cache
        queryClient.setQueryData(
          ['chat_messages', sessionState.currentSessionId],
          (oldMessages: ChatMessage[] = []) => {
            const exists = oldMessages.some(msg => msg.id === newMessage.id);
            return exists ? oldMessages : [...oldMessages, newMessage];
          }
        );
      }
    } catch (error) {
      console.error('Error handling realtime message:', error);
    }
  }, [sessionState.currentSessionId, queryClient]);

  /**
   * Save session data to localStorage
   */
  const saveSessionToStorage = useCallback((sessionId: string, messages: ChatMessage[]) => {
    try {
      const storageKey = `chat_messages_${sessionId}`;
      const dataToStore = {
        messages: messages.slice(-50), // Keep last 50 messages
        timestamp: Date.now(),
        sessionId
      };
      localStorage.setItem(storageKey, JSON.stringify(dataToStore));
    } catch (error) {
      console.warn('Failed to save session to storage:', error);
    }
  }, []);

  /**
   * Restore session from localStorage
   */
  const restoreSessionFromStorage = useCallback((sessionId: string): ChatMessage[] => {
    try {
      const storageKey = `chat_messages_${sessionId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only restore if data is recent (within 24 hours)
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.messages || [];
        }
      }
    } catch (error) {
      console.warn('Failed to restore session from storage:', error);
    }
    return [];
  }, []);

  /**
   * Recover from error state
   */
  const recoverFromError = useCallback(async () => {
    try {
      setSessionState(prev => ({ ...prev, error: null, isLoading: true }));

      // Try to restore current session
      if (sessionState.currentSessionId) {
        const restoredMessages = restoreSessionFromStorage(sessionState.currentSessionId);
        setSessionState(prev => ({
          ...prev,
          messages: restoredMessages,
          isLoading: false
        }));

        // Re-setup realtime subscription
        if (enableRealtime) {
          setupRealtimeSubscription(sessionState.currentSessionId);
        }
      } else {
        // Create new session if none exists
        await createSessionMutation.mutateAsync();
      }
    } catch (error) {
      console.error('Error recovering from error state:', error);
      setSessionState(prev => ({ 
        ...prev, 
        error: 'Failed to recover session', 
        isLoading: false 
      }));
    }
  }, [sessionState.currentSessionId, restoreSessionFromStorage, enableRealtime, setupRealtimeSubscription, createSessionMutation]);

  /**
   * Initialize session management
   */
  useEffect(() => {
    if (!autoRestore) return;

    const initializeSession = async () => {
      try {
        // Try to restore last session
        const lastSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
        
        if (lastSessionId && sessions.some(s => s.id === lastSessionId)) {
          await switchToSession(lastSessionId);
        } else if (sessions.length > 0) {
          // Use most recent session
          await switchToSession(sessions[0].id);
        } else {
          // Create new session
          await createSessionMutation.mutateAsync();
        }
      } catch (error) {
        console.error('Error initializing session:', error);
        setSessionState(prev => ({ ...prev, error: 'Failed to initialize session' }));
      }
    };

    if (sessions.length >= 0 && !sessionState.currentSessionId) {
      initializeSession();
    }
  }, [sessions, sessionState.currentSessionId, autoRestore, switchToSession, createSessionMutation]);

  /**
   * Update messages when query data changes
   */
  useEffect(() => {
    if (messages && messages.length > 0) {
      setSessionState(prev => ({
        ...prev,
        messages: messages.map(msg => ({ ...msg, status: 'completed' })),
        isLoading: false
      }));
    }
  }, [messages]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
      
      // Save current session state
      if (sessionState.currentSessionId && sessionState.messages.length > 0) {
        saveSessionToStorage(sessionState.currentSessionId, sessionState.messages);
      }
    };
  }, [sessionState.currentSessionId, sessionState.messages, saveSessionToStorage]);

  return {
    // State
    sessionState,
    sessions,
    isLoading: sessionsLoading || messagesLoading || sessionState.isLoading,
    error: sessionsError || sessionState.error,

    // Actions
    createSession: createSessionMutation.mutateAsync,
    switchToSession,
    sendMessage: (message: string) => {
      if (!sessionState.currentSessionId) {
        throw new Error('No active session');
      }
      return sendMessageMutation.mutateAsync({ 
        message, 
        sessionId: sessionState.currentSessionId 
      });
    },
    recoverFromError,

    // Utilities
    getCurrentSession: () => sessions.find(s => s.id === sessionState.currentSessionId),
    isSessionActive: (sessionId: string) => sessionId === sessionState.currentSessionId,
    getMessageCount: () => sessionState.messages.length,
    
    // Status
    isSending: sendMessageMutation.isPending,
    isCreatingSession: createSessionMutation.isPending
  };
}