import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Send, AlertTriangle, RefreshCw } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import Lottie from "lottie-react";
import { sendChat } from "@/lib/api";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { fetchCitation, supabase } from "@/lib/api";
import { InlineError } from "@/components/ui/error-display";
import { NetworkIndicator } from "@/components/NetworkStatus";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Load thinking animation from public folder
const useThinkingAnimation = () => {
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    fetch('/lottie/thinking.json')
      .then(response => response.json())
      .then(data => setAnimationData(data))
      .catch(error => console.error('Failed to load thinking animation:', error));
  }, []);

  return animationData;
};

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  chunks_retrieved?: string[];
  sources_cited?: string[];
  created_at?: string;
  llm_provider?: string;
  llm_model?: string;
}

interface ChatStreamProps {
  sessionId: string;
}

// Bulletproof content renderer that handles any data type
const renderMessageContent = (content: unknown): JSX.Element => {
  try {
    // Handle null/undefined
    if (content == null) {
      return <span className="text-muted-foreground italic">No content available</span>;
    }

    // Handle string content (normal case)
    if (typeof content === 'string') {
      return renderStringContent(content);
    }

    // Handle object/array content (from n8n webhooks)
    if (typeof content === 'object') {
      // Try to extract message from common object structures
      const obj = content as any;
      
      // Common n8n response patterns
      if (obj.message && typeof obj.message === 'string') {
        return renderStringContent(obj.message);
      }
      if (obj.content && typeof obj.content === 'string') {
        return renderStringContent(obj.content);
      }
      if (obj.response && typeof obj.response === 'string') {
        return renderStringContent(obj.response);
      }
      if (obj.text && typeof obj.text === 'string') {
        return renderStringContent(obj.text);
      }

      // Handle array of messages
      if (Array.isArray(content)) {
        return (
          <div className="space-y-2">
            {content.map((item, index) => (
              <div key={index}>
                {renderMessageContent(item)}
              </div>
            ))}
          </div>
        );
      }

      // Fallback: display as formatted JSON
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Structured response:</div>
          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
            {JSON.stringify(content, null, 2)}
          </pre>
        </div>
      );
    }

    // Handle primitive types (number, boolean)
    return <span>{String(content)}</span>;

  } catch (error) {
    console.error('Error rendering message content:', error, { content });
    return (
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm">Error displaying message content</span>
      </div>
    );
  }
};

// Safe string content renderer with citation support
const renderStringContent = (content: string): JSX.Element => {
  try {
    // Simple regex to find citation chips like [1], [2], etc.
    const citationRegex = /\[(\d+)\]/g;
    const parts = content.split(citationRegex);
    
    return (
      <>
        {parts.map((part, index) => {
          if (index % 2 === 1) {
            // This is a citation number
            const citationId = part;
            return (
              <CitationChip key={index} citationId={citationId} />
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </>
    );
  } catch (error) {
    console.error('Error rendering string content:', error);
    return <span>{content}</span>;
  }
};

// Citation component with error handling
const CitationChip = ({ citationId }: { citationId: string }) => {
  const [citationData, setCitationData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const handleCitationHover = async () => {
    if (citationData || loading) return;
    
    setLoading(true);
    setError("");
    
    try {
      const data = await fetchCitation(citationId);
      setCitationData(data);
    } catch (err) {
      console.error('Failed to fetch citation:', err);
      setError('Failed to load citation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge 
          variant="secondary" 
          className="cursor-pointer mx-1 hover:bg-secondary/80 transition-colors"
          onMouseEnter={handleCitationHover}
          data-testid="citation-chip"
        >
          [{citationId}]
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-80" data-testid="citation-popover">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading citation...</div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : citationData ? (
          <div>
            <h4 className="font-semibold mb-2">{citationData.title}</h4>
            <p className="text-sm text-muted-foreground">
              {citationData.excerpt}
            </p>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Click to load citation...</div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export const ChatStream = ({ sessionId }: ChatStreamProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [chatError, setChatError] = useState<string>("");
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const { handleAsyncError } = useErrorHandler();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const thinkingAnimation = useThinkingAnimation();

  // Real-time messages subscription with error handling
  const { data: messages = [], isLoading: messagesLoading, error: messagesError } = useQuery({
    queryKey: ["chat_messages", sessionId],
    queryFn: async (): Promise<Message[]> => {
      if (!sessionId) return [];
      
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionId,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Retry up to 3 times for network errors
      return failureCount < 3 && !error.message?.includes('auth');
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!sessionId) return;

    console.log('Setting up real-time subscription for session:', sessionId);

    const channel = supabase
      .channel(`chat-messages-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('Real-time message received:', payload);
          const newMessage = payload.new as Message;
          
          // Update query cache with new message
          queryClient.setQueryData(
            ["chat_messages", sessionId],
            (oldMessages: Message[] = []) => {
              // Avoid duplicates
              if (oldMessages.some(msg => msg.id === newMessage.id)) {
                return oldMessages;
              }
              return [...oldMessages, newMessage];
            }
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('Message updated:', payload);
          const updatedMessage = payload.new as Message;
          
          queryClient.setQueryData(
            ["chat_messages", sessionId],
            (oldMessages: Message[] = []) => {
              return oldMessages.map(msg => 
                msg.id === updatedMessage.id ? updatedMessage : msg
              );
            }
          );
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [sessionId, queryClient]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, optimisticMessages]);

  // Session recovery after errors
  const recoverSession = useCallback(async () => {
    try {
      // Verify session exists
      const { data: session, error } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        console.error('Session not found, creating new one');
        // Could trigger session recreation here
        throw new Error('Session not found');
      }

      // Refresh messages
      queryClient.invalidateQueries({ queryKey: ["chat_messages", sessionId] });
      setChatError("");
      
    } catch (error) {
      console.error('Session recovery failed:', error);
      setChatError("Session recovery failed. Please refresh the page.");
    }
  }, [sessionId, queryClient]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    setChatError("");
    const messageContent = inputValue.trim();
    const tempId = `temp-${Date.now()}`;
    
    // Optimistic user message
    const userMessage: Message = {
      id: tempId,
      role: "user",
      content: messageContent,
      created_at: new Date().toISOString()
    };
    
    // Add optimistic message immediately
    setOptimisticMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInputValue('');
    
    // Add thinking message
    const thinkingMessage: Message = {
      id: `thinking-${Date.now()}`,
      role: "assistant",
      content: "💭 Town Planner Assistant is thinking…",
      created_at: new Date().toISOString()
    };
    setOptimisticMessages(prev => [...prev, thinkingMessage]);
    
    try {
      const res = await handleAsyncError(
        () => sendChat(sessionId, messageContent),
        { operation: 'send_chat_message', sessionId, messageLength: messageContent.length }
      );
      
      // Clear optimistic messages on success
      setOptimisticMessages([]);
      
      // Refresh messages to get the real data from database
      queryClient.invalidateQueries({ queryKey: ["chat_messages", sessionId] });
      
    } catch (error) {
      console.error('Chat send error:', error);
      
      // Remove optimistic messages
      setOptimisticMessages([]);
      
      // Set error state
      setChatError(error.message || 'Failed to send message');
      
      // Try session recovery
      await recoverSession();
      
    } finally {
      setIsLoading(false);
    }
  };

  // Combine real messages with optimistic messages
  const allMessages = [...messages, ...optimisticMessages];

  // Handle loading state
  if (messagesLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  // Handle messages error
  if (messagesError) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <div>
            <h3 className="font-semibold text-lg mb-2">Failed to load conversation</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {messagesError.message || 'Unable to load chat messages'}
            </p>
            <Button onClick={recoverSession} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ComponentErrorBoundary>
      <div className="flex-1 flex flex-col bg-background h-full">
        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4 mobile-scroll">
          {allMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4 max-w-md">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                    <div className="w-4 h-4 bg-primary-foreground rounded-sm" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Welcome to Town Planner Assistant</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload documents and ask questions about zoning, permits, and planning regulations.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            allMessages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center mt-0.5 flex-shrink-0">
                    <div className="w-4 h-4 bg-primary-foreground rounded-sm" />
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-chat-user text-primary-foreground'
                      : 'bg-chat-assistant text-foreground'
                  }`}
                >
                  <div className="text-sm leading-relaxed">
                    {renderMessageContent(message.content)}
                  </div>
                  
                  {/* Message metadata */}
                  {message.created_at && (
                    <div className="text-xs text-muted-foreground mt-2 opacity-70">
                      {new Date(message.created_at).toLocaleTimeString()}
                      {message.llm_provider && (
                        <span className="ml-2">• {message.llm_provider}</span>
                      )}
                    </div>
                  )}
                </div>
                
                {message.role === 'user' && (
                  <Avatar className="h-8 w-8 mt-0.5 flex-shrink-0">
                    <AvatarFallback className="bg-muted text-xs">U</AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))
          )}
          
          {/* Loading state */}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center mt-0.5 flex-shrink-0">
                <div className="w-4 h-4 bg-primary-foreground rounded-sm" />
              </div>
              <div className="max-w-[80%] rounded-lg p-3 bg-chat-assistant text-foreground">
                {thinkingAnimation ? (
                  <Lottie 
                    animationData={thinkingAnimation} 
                    loop 
                    style={{ width: 60, height: 30 }}
                    data-testid="thinking-animation"
                  />
                ) : (
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div className="border-t p-4">
          {/* Chat Error Display */}
          {chatError && (
            <div className="mb-4">
              <InlineError 
                message={chatError} 
                retry={() => {
                  setChatError("");
                  recoverSession();
                }}
              />
            </div>
          )}
          
          <div className="flex gap-2">
            <div className="flex items-center">
              <NetworkIndicator showLabel={false} />
            </div>
            <Input
              placeholder="Ask about your documents..."
              className="flex-1"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={isLoading}
            />
            <Button 
              size="sm" 
              className="px-6" 
              disabled={isLoading || !inputValue.trim()} 
              onClick={handleSend}
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};