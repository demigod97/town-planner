import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

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

export const ChatArea = () => {
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
      </div>
      
      {/* Input Area */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Ask a follow-up question..."
            className="flex-1"
          />
          <Button size="sm" className="px-6">
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};