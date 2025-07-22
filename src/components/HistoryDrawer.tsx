import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface HistoryDrawerProps {
  onSessionSelect: (sessionId: string) => void;
}

export function HistoryDrawer({ onSessionSelect }: HistoryDrawerProps) {
  const [open, setOpen] = useState(false);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["chat_sessions"],
    queryFn: async (): Promise<ChatSession[]> => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, session_name, created_at, updated_at")
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      return (data || []).map((session: any) => ({
        id: session.id,
        title: session.session_name || 'Untitled Session',
        created_at: session.created_at,
        updated_at: session.updated_at
      }));
    },
  });

  const handleSessionClick = (sessionId: string) => {
    onSessionSelect(sessionId);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <History className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle>Chat History</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-full mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">No chat history</div>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSessionClick(session.id)}
                >
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{session.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(session.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}