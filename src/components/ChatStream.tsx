
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Send } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Lottie from "lottie-react";
import { sendChatMessage, getChatMessages } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  message_type: 'human' | 'ai';
  content: string;
  created_at: string;
  sources_used?: any[];
  citations?: any[];
}

interface ChatStreamProps {
  sessionId: string;
}

export const ChatStream = ({ sessionId }: ChatStreamProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [citationData, setCitationData] = useState<Record<string, any>>({});
  const [waitingForAI, setWaitingForAI] = useState(false);
  const thinkingAnimation = useThinkingAnimation();
  const { toast } = useToast();

  // Fetch messages from database
  const { data: messages = [], refetch } = useQuery({
    queryKey: ["chat_messages", sessionId],
    queryFn: () => getChatMessages(sessionId),
    enabled: !!sessionId,
  });

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!sessionId) return;

    console.log('Setting up real-time subscription for session:', sessionId);

    const channel = supabase
      .channel(`chat_messages_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('New message received via real-time:', payload);
          // Refetch messages to update the UI
          refetch();
          // If it's an AI message, stop waiting
          if (payload.new.message_type === 'ai') {
            setWaitingForAI(false);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [sessionId, refetch]);

  const handleCitationHover = async (citationId: string) => {
    if (!citationData[citationId]) {
      try {
        const response = await fetch(`/api/citation?id=${citationId}`);
        const data = await response.json();
        setCitationData(prev => ({ ...prev, [citationId]: data }));
      } catch (error) {
        console.error('Failed to fetch citation:', error);
      }
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    setIsLoading(true);
    setWaitingForAI(true);
    const userMessageContent = inputValue;
    setInputValue('');
    
    try {
      const result = await sendChatMessage(sessionId, userMessageContent);
      console.log('Message sent, waiting for n8n to process:', result);
      
      // Refetch to show the user message immediately
      refetch();
      
      // Show toast that message is being processed
      toast({
        title: "Message sent",
        description: "AI is processing your message...",
      });
      
    } catch (error) {
      console.error('Chat error:', error);
      setWaitingForAI(false);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageContent = (content: string) => {
    // Simple regex to find citation chips like [1], [2], etc.
    const citationRegex = /\[(\d+)\]/g;
    const parts = content.split(citationRegex);
    
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
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4 mobile-scroll">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.message_type === 'human' ? 'justify-end' : 'justify-start'}`}
          >
            {message.message_type === 'ai' && (
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center mt-0.5 flex-shrink-0">
                <div className="w-4 h-4 bg-primary-foreground rounded-sm" />
              </div>
            )}
            
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.message_type === 'human'
                  ? 'bg-chat-user text-primary-foreground'
                  : 'bg-chat-assistant text-foreground'
              }`}
            >
              <div className="text-sm leading-relaxed">
                {message.message_type === 'ai' ? renderMessageContent(message.content) : message.content}
              </div>
            </div>
            
            {message.message_type === 'human' && (
              <Avatar className="h-8 w-8 mt-0.5 flex-shrink-0">
                <AvatarFallback className="bg-muted text-xs">U</AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
        
        {/* Waiting for AI response */}
        {waitingForAI && (
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
        <div className="flex gap-2">
          <Input
            placeholder="Ask a follow-up question..."
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
  );
};
