import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { useState } from "react";
import Lottie from "lottie-react";

// Simple thinking animation data
const thinkingAnimation = {
  v: "5.5.7",
  fr: 30,
  ip: 0,
  op: 60,
  w: 100,
  h: 100,
  nm: "thinking",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "dot1",
      sr: 1,
      ks: {
        o: { a: 1, k: [
          { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [30] },
          { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 10, s: [100] },
          { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 20, s: [30] },
          { t: 30, s: [30] }
        ] },
        p: { a: 0, k: [30, 50, 0] },
        s: { a: 0, k: [100, 100, 100] }
      },
      shapes: [
        {
          ty: "el",
          p: { a: 0, k: [0, 0] },
          s: { a: 0, k: [8, 8] }
        },
        {
          ty: "fl",
          c: { a: 0, k: [0.4, 0.4, 0.4, 1] }
        }
      ]
    }
  ]
};

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  avatar?: string;
}

const messages: Message[] = [
  {
    id: "1",
    type: "assistant",
    content: "Hello! How can I assist you with your town planning needs today? I can help you with zoning regulations, permit applications, and more. Please select the relevant documents from the \"Sources\" panel.",
  },
  {
    id: "2",
    type: "user",
    content: "I need to check the setback requirements for a new residential construction project on Elm Street.",
  },
  {
    id: "3",
    type: "assistant",
    content: "Based on the \"Zoning Master Plan 2023,\" the setback requirement for residential properties on Elm Street is 15 feet from the front property line and 5 feet from the side property lines. Would you like me to generate a permit template with this information?",
  },
];

interface ChatStreamProps {
  sessionId: string;
}

export const ChatStream = ({ sessionId }: ChatStreamProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
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
              <p className="text-sm leading-relaxed">{message.content}</p>
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
              <Lottie 
                animationData={thinkingAnimation} 
                loop 
                style={{ width: 40, height: 20 }}
              />
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
            disabled={isLoading}
          />
          <Button size="sm" className="px-6" disabled={isLoading}>
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};