import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MessageSquare, FileText, Settings, AlertTriangle, User, LogOut } from "lucide-react";
import { toast } from "sonner";
import { HistoryTab } from "./HistoryTab";
import { SourcesTab } from "./SourcesTab";
import { ActionsTab } from "./ActionsTab";
import { ErrorStatusPage } from "./ErrorStatusPage";
import { useSession } from "@/hooks/useSession";

interface TopBarProps {
  notebookId: string;
  currentSessionId: string | null;
  sessions: any[];
  onSessionSelect?: (sessionId: string) => void;
  onCreateSession?: () => void;
  onClearHistory?: () => void;
  isClearingHistory?: boolean;
}

export const TopBar = ({ 
  notebookId,
  currentSessionId,
  sessions,
  onSessionSelect,
  onCreateSession,
  onClearHistory,
  isClearingHistory = false
}: TopBarProps) => {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [errorStatusOpen, setErrorStatusOpen] = useState(false);
  const { signOut } = useSession();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  return (
    <>
      <div className="h-14 bg-background border-b flex items-center justify-between px-4 sticky top-0 z-40">
        {/* Left - Drawer Navigation */}
        <div className="flex items-center gap-2">
          {/* History Drawer */}
          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">History</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[400px] p-0">
              <HistoryTab
                notebookId={notebookId}
                currentSessionId={currentSessionId}
                sessions={sessions}
                onSessionSelect={(sessionId) => {
                  onSessionSelect?.(sessionId);
                  setHistoryOpen(false);
                }}
                onCreateSession={() => {
                  onCreateSession?.();
                  setHistoryOpen(false);
                }}
                onClearHistory={onClearHistory}
                isClearingHistory={isClearingHistory}
              />
            </SheetContent>
          </Sheet>

          {/* Sources Drawer */}
          <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Sources</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[400px] p-0">
              <SourcesTab
                notebookId={notebookId}
                onClose={() => setSourcesOpen(false)}
              />
            </SheetContent>
          </Sheet>

          {/* Actions Drawer */}
          <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Actions</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[400px] p-0">
              <ActionsTab
                notebookId={notebookId}
                currentSessionId={currentSessionId}
                onClose={() => setActionsOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>

        {/* Center - Title */}
        <div className="flex items-center gap-2">
          <span className="text-xl">🏙️</span>
          <h1 className="text-lg font-semibold text-foreground hidden sm:block">
            Town Planner Assistant
          </h1>
          <h1 className="text-lg font-semibold text-foreground sm:hidden">
            Town Planner
          </h1>
        </div>

        {/* Right - Error Status & Avatar */}
        <div className="flex items-center gap-2">
          {/* Error Status Button */}
          <Sheet open={errorStatusOpen} onOpenChange={setErrorStatusOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <AlertTriangle className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[500px] p-0">
              <ErrorStatusPage onClose={() => setErrorStatusOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* Avatar Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/lovable-uploads/425ef66d-dec6-4935-8b6a-913c0d095c21.png" alt="User" />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-background border shadow-lg z-50">
              <DropdownMenuItem onClick={() => toast("Profile coming soon")} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
};

      <div className="flex items-center gap-3">
        <HistoryDrawer onSessionSelect={handleSessionSelect} />
      </div>

      {/* Center - Title */}
      <div className="flex items-center gap-2">
        <span className="text-xl">🏙️</span>
        <h1 className="text-lg font-semibold text-foreground hidden sm:block">
          Town Planner Assistant
        </h1>
        <h1 className="text-lg font-semibold text-foreground sm:hidden">
          Town Planner
        </h1>
      </div>

      {/* Right - LLM Toggle, Bell & Avatar */}
      <div className="flex items-center gap-3">
        {/* LLM Provider Toggle */}
        <div className="flex items-center gap-2">
          <Label htmlFor="llm-provider" className="text-sm font-medium">
            {llmProvider}
          </Label>
          <Switch
            id="llm-provider"
            checked={llmProvider === 'OLLAMA'}
            onCheckedChange={handleProviderToggle}
          />
        </div>

        {/* Bell Icon with Badge */}
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {pendingJobs > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {pendingJobs}
            </Badge>
          )}
        </Button>

        {/* Settings Gear Button */}
        <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
          <Settings className="h-4 w-4" />
        </Button>

        {/* Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/lovable-uploads/425ef66d-dec6-4935-8b6a-913c0d095c21.png" alt="User" />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-background border shadow-lg z-50">
            <DropdownMenuItem onClick={handleProfileClick} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowSettings(true)} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleClearChats} className="cursor-pointer text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Chats
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Settings Modal */}
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
};