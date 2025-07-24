import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MessageSquare, Search, Plus, Clock, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import type { ChatSession } from "@/types/chat";

interface HistoryTabProps {
  notebookId: string;
  currentSessionId: string | null;
  sessions: ChatSession[];
  onSessionSelect: (sessionId: string) => void;
  onCreateSession: () => void;
  onClearHistory?: () => void;
  isClearingHistory?: boolean;
}

export const HistoryTab = ({
  notebookId,
  currentSessionId,
  sessions,
  onSessionSelect,
  onCreateSession,
  onClearHistory,
  isClearingHistory = false
}: HistoryTabProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClearHistory = async () => {
    try {
      await onClearHistory?.();
    } catch (error) {
      toast.error("Failed to clear history");
    }
  };

  return (
    <ComponentErrorBoundary>
      <div className="h-full flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Chat History
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-4 flex-1 flex flex-col">
          {/* Search and Actions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search sessions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button
                size="sm"
                onClick={onCreateSession}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New
              </Button>
            </div>

            {/* Clear History Button */}
            {sessions.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full flex items-center gap-2 text-destructive hover:text-destructive"
                    disabled={isClearingHistory}
                  >
                    {isClearingHistory ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Clear All History
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Chat History</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all chat sessions except the current one. 
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearHistory}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Clear History
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {/* Sessions List */}
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {filteredSessions.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    {searchTerm ? 'No sessions match your search' : 'No chat sessions yet'}
                  </p>
                  {!searchTerm && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onCreateSession}
                    >
                      Start First Chat
                    </Button>
                  )}
                </div>
              ) : (
                filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      session.id === currentSessionId
                        ? 'bg-primary/10 border-primary/20'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => onSessionSelect(session.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-foreground truncate flex-1">
                        {session.title}
                      </h4>
                      <Badge variant="secondary" className="text-xs ml-2">
                        {session.total_messages || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(session.updated_at).toLocaleDateString()}</span>
                      {session.llm_provider && (
                        <Badge variant="outline" className="text-xs">
                          {session.llm_provider}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};