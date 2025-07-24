/**
 * 📄 EnhancedChatStream.tsx
 * Part of the HHLM project – town-planning RAG assistant
 * Purpose: Bulletproof chat component with real-time updates
 * Generated: 2025-01-27
 * ------------------------------------------------------
 * Advanced chat interface with comprehensive error handling
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, AlertTriangle, RefreshCw, Copy, User, Bot } from 'lucide-react';
import Lottie from 'lottie-react';
import { toast } from 'sonner';
import { ComponentErrorBoundary } from '@/components/ErrorBoundary';
import { useSessionManagement } from '@/hooks/useSessionManagement';
import { parseMessageContent, validateUserInput, formatErrorMessage } from '@/utils/messageContentParser';
import type { ChatMessage, Citation, MessageContentData } from '@/types/chat';

interface EnhancedChatStreamProps {
  notebookId: string;
  initialSessionId?: string;
  className?: string;
}

// Load thinking animation with error handling
const useThinkingAnimation = () => {
  const [animationData, setAnimationData] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch('/lottie/thinking.json')
      .then(response => response.json())
      .then(data => setAnimationData(data))
      .catch(error => {
        console.warn('Failed to load thinking animation:', error);
        setLoadError(true);
      });
  }, []);

  return { animationData, loadError };
};

export const EnhancedChatStream = ({ 
  notebookId, 
  initialSessionId,
  className = '' 
}: EnhancedChatStreamProps) => {
  const [inputValue, setInputValue] = useState('');
  const [citationData, setCitationData] = useState<Record<string, Citation>>({});
  const [retryCount, setRetryCount] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { animationData, loadError: animationLoadError } = useThinkingAnimation();

  // Session management with real-time updates
  const {
    sessionState,
    sessions,
    isLoading,
    error: sessionError,
    sendMessage,
    switchToSession,
    createSession,
    recoverFromError,
    isSending,
    getCurrentSession
  } = useSessionManagement({ 
    notebookId, 
    autoRestore: true, 
    enableRealtime: true 
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [sessionState.messages]);

  // Initialize with provided session ID
  useEffect(() => {
    if (initialSessionId && initialSessionId !== sessionState.currentSessionId) {
      switchToSession(initialSessionId);
    }
  }, [initialSessionId, sessionState.currentSessionId, switchToSession]);

  /**
   * Bulletproof message content renderer
   * Handles all possible content types safely
   */
  const renderMessageContent = useCallback((message: ChatMessage): React.ReactNode => {
    try {
      const contentData = parseMessageContent(message.content);
      
      switch (contentData.type) {
        case 'error':
          return (
            <Alert variant="destructive" className="my-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {contentData.content}
                {contentData.metadata?.error && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer">Technical Details</summary>
                    <pre className="mt-1 whitespace-pre-wrap">
                      {JSON.stringify(contentData.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </AlertDescription>
            </Alert>
          );

        case 'loading':
          return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {animationData && !animationLoadError ? (
                <Lottie 
                  animationData={animationData} 
                  loop 
                  style={{ width: 40, height: 20 }}
                />
              ) : (
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              )}
              <span>{contentData.content}</span>
            </div>
          );

        case 'text':
        default:
          return renderTextWithCitations(contentData.content, contentData.citations || []);
      }
    } catch (error) {
      console.error('Error rendering message content:', error);
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to display message content. 
            <Button 
              variant="link" 
              size="sm" 
              onClick={() => copyToClipboard(JSON.stringify(message, null, 2))}
              className="ml-2 p-0 h-auto"
            >
              Copy raw data
            </Button>
          </AlertDescription>
        </Alert>
      );
    }
  }, [animationData, animationLoadError]);

  /**
   * Render text content with citation support
   */
  const renderTextWithCitations = (content: string, citations: Citation[]) => {
    try {
      if (typeof content !== 'string') {
        return <span className="text-destructive">Invalid content format</span>;
      }

      const citationRegex = /\[(\d+)\]/g;
      const parts = content.split(citationRegex);
      
      return (
        <div className="text-sm leading-relaxed">
          {parts.map((part, index) => {
            if (index % 2 === 1) {
              // This is a citation number
              const citationId = part;
              const citation = citations.find(c => c.id === citationId) || 
                              citationData[citationId];
              
              return (
                <Popover key={index}>
                  <PopoverTrigger asChild>
                    <Badge 
                      variant="secondary" 
                      className="cursor-pointer mx-1 text-xs"
                      onMouseEnter={() => handleCitationHover(citationId)}
                    >
                      [{citationId}]
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" side="top">
                    {citation ? (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">{citation.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          {citation.excerpt}
                        </p>
                        {citation.page_number && (
                          <p className="text-xs text-muted-foreground">
                            Page {citation.page_number}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Loading citation...
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              );
            }
            return <span key={index}>{part}</span>;
          })}
        </div>
      );
    } catch (error) {
      console.error('Error rendering text with citations:', error);
      return <span className="text-sm">{String(content)}</span>;
    }
  };

  /**
   * Handle citation hover with caching
   */
  const handleCitationHover = async (citationId: string) => {
    if (citationData[citationId]) return;

    try {
      // Mock citation fetch - replace with actual API call
      const citation: Citation = {
        id: citationId,
        title: `Document Reference ${citationId}`,
        excerpt: `This is a sample excerpt for citation ${citationId}. In production, this would fetch actual citation data.`,
        confidence: 0.85
      };
      
      setCitationData(prev => ({ ...prev, [citationId]: citation }));
    } catch (error) {
      console.error('Failed to fetch citation:', error);
    }
  };

  /**
   * Handle message sending with validation
   */
  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    const validation = validateUserInput(inputValue);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    if (!sessionState.currentSessionId) {
      toast.error('No active session. Creating new session...');
      try {
        await createSession();
        return;
      } catch (error) {
        toast.error('Failed to create session');
        return;
      }
    }

    try {
      await sendMessage(validation.sanitized);
      setInputValue('');
      setRetryCount(0);
      
      // Focus input for next message
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      toast.error(errorMessage);
      
      // Increment retry count for exponential backoff
      setRetryCount(prev => prev + 1);
    }
  };

  /**
   * Handle retry with exponential backoff
   */
  const handleRetry = async () => {
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));
    await handleSend();
  };

  /**
   * Copy content to clipboard
   */
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Error recovery UI
  if (sessionError) {
    return (
      <div className={`flex-1 flex flex-col bg-background ${className}`}>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2">Session Error</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {formatErrorMessage(sessionError)}
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={recoverFromError} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Recover Session
              </Button>
              <Button onClick={() => createSession()}>
                Start New Chat
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ComponentErrorBoundary>
      <div className={`flex-1 flex flex-col bg-background ${className}`}>
        {/* Session Info Header */}
        {getCurrentSession() && (
          <div className="px-4 py-2 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium truncate">
                  {getCurrentSession()?.title}
                </h3>
                {getCurrentSession()?.llm_provider && (
                  <Badge variant="outline" className="text-xs">
                    {getCurrentSession()?.llm_provider}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {sessionState.messages.length} messages
              </div>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
          <div className="space-y-4 max-w-4xl mx-auto">
            {isLoading && sessionState.messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading conversation...</p>
              </div>
            ) : sessionState.messages.length === 0 ? (
              <div className="text-center py-12">
                <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Welcome to Town Planner Assistant</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  I can help you with zoning regulations, permit applications, planning requirements, and more. 
                  Upload documents and ask questions to get started.
                </p>
              </div>
            ) : (
              sessionState.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="h-8 w-8 mt-0.5 flex-shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div
                    className={`max-w-[85%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {message.status === 'sending' && (
                          <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
                        )}
                        {message.status === 'error' && (
                          <AlertTriangle className="w-3 h-3 text-destructive" />
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(message.content)}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {renderMessageContent(message)}
                    
                    {message.metadata?.processing_time_ms && (
                      <div className="text-xs opacity-70 mt-2">
                        Response time: {message.metadata.processing_time_ms}ms
                      </div>
                    )}
                  </div>
                  
                  {message.role === 'user' && (
                    <Avatar className="h-8 w-8 mt-0.5 flex-shrink-0">
                      <AvatarFallback className="bg-muted">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        {/* Input Area */}
        <div className="border-t p-4">
          <div className="max-w-4xl mx-auto">
            {/* Error Display */}
            {sessionError && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>{formatErrorMessage(sessionError)}</span>
                  <Button variant="outline" size="sm" onClick={recoverFromError}>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder="Ask about your documents..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSending || !sessionState.currentSessionId}
                className="flex-1"
                maxLength={4000}
              />
              <Button 
                size="sm" 
                onClick={handleSend}
                disabled={isSending || !inputValue.trim() || !sessionState.currentSessionId}
                className="px-6"
              >
                {isSending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Sending</span>
                  </div>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
            
            {/* Character count */}
            <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
              <span>
                {!sessionState.currentSessionId ? 'No active session' : 
                 isSending ? 'Sending message...' : 
                 'Type your message and press Enter'}
              </span>
              <span>{inputValue.length}/4000</span>
            </div>
          </div>
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};