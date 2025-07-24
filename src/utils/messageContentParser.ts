/**
 * 📄 messageContentParser.ts
 * Part of the HHLM project – town-planning RAG assistant
 * Purpose: Bulletproof message content parsing and validation
 * Generated: 2025-01-27
 * ------------------------------------------------------
 * Handles all possible content types from n8n webhooks safely
 */

import type { MessageContentData, Citation } from '@/types/chat';

/**
 * Safely parses and validates message content from various sources
 * Handles string, object, array, null, undefined inputs without throwing
 */
export function parseMessageContent(
  rawContent: unknown,
  fallbackMessage: string = "Message content unavailable"
): MessageContentData {
  try {
    // Handle null/undefined
    if (rawContent === null || rawContent === undefined) {
      return {
        type: 'error',
        content: fallbackMessage,
        metadata: { error: 'Content is null or undefined' }
      };
    }

    // Handle string content (most common case)
    if (typeof rawContent === 'string') {
      if (rawContent.trim() === '') {
        return {
          type: 'error',
          content: 'Empty message received',
          metadata: { error: 'Empty string content' }
        };
      }
      
      return {
        type: 'text',
        content: rawContent.trim(),
        citations: extractCitations(rawContent)
      };
    }

    // Handle object content (n8n webhook responses)
    if (typeof rawContent === 'object') {
      return parseObjectContent(rawContent);
    }

    // Handle array content
    if (Array.isArray(rawContent)) {
      const textContent = rawContent
        .filter(item => typeof item === 'string' || (item && typeof item.content === 'string'))
        .map(item => typeof item === 'string' ? item : item.content)
        .join('\n\n');
      
      if (textContent.trim()) {
        return {
          type: 'text',
          content: textContent,
          citations: extractCitations(textContent)
        };
      }
    }

    // Handle primitive types
    if (typeof rawContent === 'number' || typeof rawContent === 'boolean') {
      return {
        type: 'text',
        content: String(rawContent),
        metadata: { originalType: typeof rawContent }
      };
    }

    // Fallback for unknown types
    return {
      type: 'error',
      content: fallbackMessage,
      metadata: { 
        error: `Unsupported content type: ${typeof rawContent}`,
        originalType: typeof rawContent
      }
    };

  } catch (error) {
    console.error('Error parsing message content:', error);
    return {
      type: 'error',
      content: fallbackMessage,
      metadata: { 
        error: error instanceof Error ? error.message : 'Unknown parsing error',
        parseError: true
      }
    };
  }
}

/**
 * Parses object content from n8n webhook responses
 */
function parseObjectContent(obj: any): MessageContentData {
  try {
    // Handle n8n response format
    if (obj.response && typeof obj.response === 'string') {
      return {
        type: 'text',
        content: obj.response,
        citations: extractCitations(obj.response),
        metadata: obj.metadata || {}
      };
    }

    // Handle content property
    if (obj.content && typeof obj.content === 'string') {
      return {
        type: 'text',
        content: obj.content,
        citations: obj.citations || extractCitations(obj.content),
        metadata: obj.metadata || {}
      };
    }

    // Handle message property
    if (obj.message && typeof obj.message === 'string') {
      return {
        type: 'text',
        content: obj.message,
        citations: extractCitations(obj.message),
        metadata: obj
      };
    }

    // Handle error responses
    if (obj.error) {
      return {
        type: 'error',
        content: `Error: ${typeof obj.error === 'string' ? obj.error : 'Unknown error occurred'}`,
        metadata: obj
      };
    }

    // Handle status/loading responses
    if (obj.status === 'processing' || obj.status === 'thinking') {
      return {
        type: 'loading',
        content: obj.message || 'AI is thinking...',
        metadata: obj
      };
    }

    // Try to stringify object as fallback
    const stringified = JSON.stringify(obj, null, 2);
    if (stringified && stringified !== '{}') {
      return {
        type: 'text',
        content: `Response data:\n\`\`\`json\n${stringified}\n\`\`\``,
        metadata: { isStringified: true, originalObject: obj }
      };
    }

    return {
      type: 'error',
      content: 'Received empty or invalid response object',
      metadata: { error: 'Empty object', originalObject: obj }
    };

  } catch (error) {
    return {
      type: 'error',
      content: 'Failed to parse response object',
      metadata: { 
        error: error instanceof Error ? error.message : 'Object parsing error',
        originalObject: obj
      }
    };
  }
}

/**
 * Extracts citation references from text content
 * Handles formats like [1], [2], [Source 1], etc.
 */
function extractCitations(content: string): Citation[] {
  if (typeof content !== 'string') return [];

  try {
    const citations: Citation[] = [];
    const citationRegex = /\[(\d+)\]|\[([^\]]+)\]/g;
    let match;

    while ((match = citationRegex.exec(content)) !== null) {
      const citationId = match[1] || match[2];
      if (citationId) {
        citations.push({
          id: citationId,
          title: `Citation ${citationId}`,
          excerpt: `Reference ${citationId} from the document corpus`,
          confidence: 0.8
        });
      }
    }

    return citations;
  } catch (error) {
    console.warn('Error extracting citations:', error);
    return [];
  }
}

/**
 * Validates and sanitizes user input before sending
 */
export function validateUserInput(input: string): { isValid: boolean; sanitized: string; error?: string } {
  if (typeof input !== 'string') {
    return { isValid: false, sanitized: '', error: 'Input must be a string' };
  }

  const trimmed = input.trim();
  
  if (trimmed.length === 0) {
    return { isValid: false, sanitized: '', error: 'Message cannot be empty' };
  }

  if (trimmed.length > 4000) {
    return { 
      isValid: false, 
      sanitized: trimmed.substring(0, 4000), 
      error: 'Message too long (max 4000 characters)' 
    };
  }

  // Basic sanitization - remove potentially harmful content
  const sanitized = trimmed
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');

  return { isValid: true, sanitized };
}

/**
 * Formats error messages for user display
 */
export function formatErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  
  if (error instanceof Error) {
    // Map common errors to user-friendly messages
    if (error.message.includes('fetch')) {
      return 'Connection error. Please check your internet connection and try again.';
    }
    if (error.message.includes('auth')) {
      return 'Authentication error. Please refresh the page and sign in again.';
    }
    if (error.message.includes('timeout')) {
      return 'Request timed out. The AI service may be busy, please try again.';
    }
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}