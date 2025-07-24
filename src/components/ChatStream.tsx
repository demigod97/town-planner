/**
 * 📄 ChatStream.tsx - DEPRECATED
 * This component has been replaced by EnhancedChatStream.tsx
 * Keeping for backward compatibility during transition
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Send } from "lucide-react";
import { useState, useEffect } from "react";
import Lottie from "lottie-react";
import { sendChat } from "@/lib/api";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { fetchCitation } from "@/lib/api";
import { InlineError } from "@/components/ui/error-display";
import { NetworkIndicator } from "@/components/NetworkStatus";
import { parseMessageContent } from "@/utils/messageContentParser";
import type { ChatMessage as ChatMessageType } from "@/types/chat";


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
  type: 'user' | 'assistant';
  content: string;
  avatar?: string;
}

interface ChatStreamProps {
  sessionId: string;
}

export const ChatStream = ({ sessionId }: ChatStreamProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [citationData, setCitationData] = useState<Record<string, any>>({});
  const [chatError, setChatError] = useState<string>("");
  const { handleAsyncError } = useErrorHandler();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "assistant",
      content: "Hello! How can I assist you with your town planning needs today? I can help you with zoning regulations, permit applications, and more.",
    },
  ]);
  const thinkingAnimation = useThinkingAnimation();

  const handleCitationHover = async (citationId: string) => {
    if (!citationData[citationId]) {
      try {
        const data = await fetchCitation(citationId);
        setCitationData(prev => ({ ...prev, [citationId]: data }));
      } catch (error) {
        console.error('Failed to fetch citation:', error);
      }
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    setChatError("");
    const messageContent = inputValue.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: messageContent
    };
    
    setMessages(m => [...m, userMessage]);
    setIsLoading(true);
    setInputValue('');
    
    // Add thinking message
    const thinkingMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: "assistant",
      content: "💭 Town Planner Assistant is thinking…"
    };
    setMessages(m => [...m, thinkingMessage]);
    
    try {
      const res = await handleAsyncError(
        () => sendChat(sessionId, messageContent),
        { operation: 'send_chat_message', sessionId, messageLength: messageContent.length }
      );
      
      // Remove thinking message and add actual response
      setMessages(m => {
        const withoutThinking = m.slice(0, -1);
        return [
          ...withoutThinking,
          { id: res.aiMessage.id, type: 'assistant', content: res.aiMessage.content }
        ];
      });
    } catch (error) {
      setChatError(error.message || 'Failed to send message');
      setMessages(m => {
        const withoutThinking = m.slice(0, -1);
        return [
          ...withoutThinking,
          {
            id: Date.now().toString(),
            type: "assistant",
            content: "Sorry, I encountered an error processing your message. Please try again."
          }
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageContent = (content: string) => {
    try {
      // Use the bulletproof parser
      const contentData = parseMessageContent(content);
      
      if (contentData.type === 'error') {
        return (
          <div className="text-sm text-destructive">
            {contentData.content}
          </div>
        );
      }
      
      if (contentData.type === 'loading') {
        return (
          <div className="text-sm text-muted-foreground">
            {contentData.content}
          </div>
        );
      }
      
      // Render text with citations
      const citationRegex = /\[(\d+)\]/g;
      const parts = contentData.content.split(citationRegex);
      
      return parts.map((part, index) => {
        if (index % 2 === 1) {
          // This is a citation number
          const citationId = part;
          return (
            <Popover key={index}>
              <PopoverTrigger asChild>
                <Badge 
                  variant="secondary" 
                  className="cursor-pointer mx-1"
                  onMouseEnter={() => handleCitationHover(citationId)}
                >
                  [{citationId}]
                </Badge>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                {citationData[citationId] ? (
                  <div>
                    <h4 className="font-semibold mb-2">{citationData[citationId].title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {citationData[citationId].excerpt}
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Loading citation...</div>
                )}
              </PopoverContent>
            </Popover>
          );
        }
        return part;
      });
    } catch (error) {
      console.error('Error rendering message content:', error);
      return (
        <div className="text-sm text-destructive">
          Failed to display message content
        </div>
      );
    }
  };

  return (
    <ComponentErrorBoundary>
      <div className="flex-1 flex flex-col bg-background h-full">
        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4 mobile-scroll">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type === 'assistant' && (
                <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center mt-0.5 flex-shrink-0">
                  <div className="w-4 h-4 bg-primary-foreground rounded-sm" />
                </div>
              )}
              
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.type === 'user'
                    ? 'bg-chat-user text-primary-foreground'
                    : 'bg-chat-assistant text-foreground'
                }`}
              >
                <div className="text-sm leading-relaxed">
                  {message.type === 'assistant' ? renderMessageContent(message.content) : message.content}
                </div>
              </div>
              
              {message.type === 'user' && (
                <Avatar className="h-8 w-8 mt-0.5 flex-shrink-0">
                  <AvatarFallback className="bg-muted text-xs">U</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          
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
                  handleSend();
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
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              disabled={isLoading}
            />
            <Button size="sm" className="px-6" disabled={isLoading || !inputValue.trim()} onClick={handleSend}>
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};