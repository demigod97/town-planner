import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Bell, User, Trash2, Settings, LogOut } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SettingsModal } from "./SettingsModal";
import { useSettings } from "@/hooks/useSettings";
import { useSession } from "@/hooks/useSession";

interface TopBarProps {
  onClearChats?: () => void;
  onSessionSelect?: (sessionId: string) => void;
}

export const TopBar = ({ onClearChats, onSessionSelect }: TopBarProps) => {
  const [pendingJobs] = useState(2); // Mock pending jobs count
  const [showSettings, setShowSettings] = useState(false);
  const { settings, updateSettings } = useSettings();
  const { signOut } = useSession();
  const llmProvider = settings.llmProvider;

  const handleClearChats = () => {
    onClearChats?.();
    toast("Chat history cleared");
  };

  const handleProfileClick = () => {
    toast("Profile settings coming soon");
  };

  const handleProviderToggle = (checked: boolean) => {
    const newProvider = checked ? 'OLLAMA' : 'OPENAI';
    updateSettings({ llmProvider: newProvider });
    toast(`Switched to ${newProvider}`);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast("Signed out successfully");
    } catch (error) {
      toast("Failed to sign out", { description: error.message });
    }
  };

  return (
    <div className="h-14 bg-background border-b flex items-center justify-between px-4 sticky top-0 z-40">
      {/* Left - Logo/Brand */}
      <div className="flex items-center gap-2">
        <span className="text-xl">🏙️</span>
        <h1 className="text-lg font-semibold text-foreground hidden sm:block">
          Town Planner Assistant
        </h1>
      </div>

      {/* Center - Title */}
      <div className="flex items-center gap-2 sm:hidden">
        <span className="text-lg font-semibold text-foreground">Town Planner</span>
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
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Settings Modal */}
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
};