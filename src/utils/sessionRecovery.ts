/**
 * 📄 sessionRecovery.ts
 * Part of the HHLM project – town-planning RAG assistant
 * Purpose: Session recovery utilities for error handling
 * Generated: 2025-01-27
 * ------------------------------------------------------
 * Utilities for recovering from session errors and maintaining state
 */

import { supabase } from '@/lib/api';
import type { ChatSession, ChatMessage } from '@/types/chat';

export interface SessionRecoveryData {
  sessionId: string;
  messages: ChatMessage[];
  timestamp: number;
  notebookId: string;
}

export interface RecoveryOptions {
  maxAge?: number; // Maximum age in milliseconds
  includeMessages?: boolean;
  fallbackToNewSession?: boolean;
}

/**
 * Save session state for recovery
 */
export function saveSessionForRecovery(
  sessionId: string,
  messages: ChatMessage[],
  notebookId: string
): void {
  try {
    const recoveryData: SessionRecoveryData = {
      sessionId,
      messages: messages.slice(-20), // Keep last 20 messages
      timestamp: Date.now(),
      notebookId
    };

    const key = `session_recovery_${notebookId}`;
    localStorage.setItem(key, JSON.stringify(recoveryData));
    
    // Also save to sessionStorage for tab-specific recovery
    sessionStorage.setItem(`current_session_${notebookId}`, sessionId);
  } catch (error) {
    console.warn('Failed to save session for recovery:', error);
  }
}

/**
 * Attempt to recover session state
 */
export function recoverSessionState(
  notebookId: string,
  options: RecoveryOptions = {}
): SessionRecoveryData | null {
  const {
    maxAge = 24 * 60 * 60 * 1000, // 24 hours
    includeMessages = true
  } = options;

  try {
    const key = `session_recovery_${notebookId}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) return null;

    const recoveryData: SessionRecoveryData = JSON.parse(stored);
    
    // Check if data is too old
    if (Date.now() - recoveryData.timestamp > maxAge) {
      localStorage.removeItem(key);
      return null;
    }

    // Validate data structure
    if (!recoveryData.sessionId || !recoveryData.notebookId) {
      return null;
    }

    return {
      ...recoveryData,
      messages: includeMessages ? recoveryData.messages : []
    };
  } catch (error) {
    console.warn('Failed to recover session state:', error);
    return null;
  }
}

/**
 * Clear recovery data
 */
export function clearRecoveryData(notebookId: string): void {
  try {
    localStorage.removeItem(`session_recovery_${notebookId}`);
    sessionStorage.removeItem(`current_session_${notebookId}`);
  } catch (error) {
    console.warn('Failed to clear recovery data:', error);
  }
}

/**
 * Validate session exists in database
 */
export async function validateSessionExists(sessionId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    return !error && !!data;
  } catch (error) {
    console.error('Error validating session:', error);
    return false;
  }
}

/**
 * Create recovery session if original is lost
 */
export async function createRecoverySession(
  notebookId: string,
  originalMessages: ChatMessage[] = []
): Promise<string> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Authentication required');

    // Create new session
    const { data: newSession, error: sessionError } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user.id,
        notebook_id: notebookId,
        title: `Recovered Chat - ${new Date().toLocaleString()}`,
        is_active: true,
        total_messages: 0
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Restore messages if any
    if (originalMessages.length > 0) {
      const messagesToRestore = originalMessages
        .filter(msg => msg.role !== 'system' && msg.content.trim())
        .slice(-10); // Restore last 10 messages

      for (const message of messagesToRestore) {
        try {
          await supabase
            .from('chat_messages')
            .insert({
              session_id: newSession.id,
              user_id: user.id,
              role: message.role,
              content: message.content,
              metadata: { recovered: true, original_id: message.id }
            });
        } catch (messageError) {
          console.warn('Failed to restore message:', messageError);
        }
      }
    }

    return newSession.id;
  } catch (error) {
    console.error('Failed to create recovery session:', error);
    throw error;
  }
}

/**
 * Enhanced error boundary recovery
 */
export async function recoverFromErrorBoundary(
  notebookId: string,
  lastKnownSessionId?: string
): Promise<{ sessionId: string; recovered: boolean }> {
  try {
    // Try to recover from localStorage first
    const recoveryData = recoverSessionState(notebookId);
    
    if (recoveryData) {
      // Validate the session still exists
      const sessionExists = await validateSessionExists(recoveryData.sessionId);
      
      if (sessionExists) {
        return { sessionId: recoveryData.sessionId, recovered: true };
      }
      
      // Session doesn't exist, create recovery session with messages
      const newSessionId = await createRecoverySession(
        notebookId, 
        recoveryData.messages
      );
      return { sessionId: newSessionId, recovered: true };
    }

    // Try to validate last known session
    if (lastKnownSessionId) {
      const sessionExists = await validateSessionExists(lastKnownSessionId);
      if (sessionExists) {
        return { sessionId: lastKnownSessionId, recovered: false };
      }
    }

    // Create completely new session
    const newSessionId = await createRecoverySession(notebookId);
    return { sessionId: newSessionId, recovered: false };

  } catch (error) {
    console.error('Error boundary recovery failed:', error);
    throw error;
  }
}

/**
 * Monitor session health
 */
export function startSessionHealthMonitor(
  sessionId: string,
  onSessionLost: () => void,
  checkInterval: number = 30000 // 30 seconds
): () => void {
  const interval = setInterval(async () => {
    try {
      const exists = await validateSessionExists(sessionId);
      if (!exists) {
        onSessionLost();
      }
    } catch (error) {
      console.warn('Session health check failed:', error);
    }
  }, checkInterval);

  return () => clearInterval(interval);
}