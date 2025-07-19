import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Bell, User, History, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TopBarProps {
  onClearChats?: () => void;
}

export const TopBar = ({ onClearChats }: TopBarProps) => {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingJobs] = useState(2); // Mock pending jobs count

  const handleClearChats = () => {
    onClearChats?.();
    toast("Chat history cleared");
  };

  const handleProfileClick = () => {
    toast("Profile settings coming soon");
  };

  return (
    <div className="h-14 bg-background border-b flex items-center justify-between px-4 sticky top-0 z-40">
      {/* Left - Hamburger Menu for History */}
      <div className="flex items-center gap-3">
        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Chat History
              </SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-2">
              <div className="p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                <p className="text-sm font-medium">Building Permit Discussion</p>
                <p className="text-xs text-muted-foreground">2 hours ago</p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                <p className="text-sm font-medium">Zoning Regulations Query</p>
                <p className="text-xs text-muted-foreground">Yesterday</p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                <p className="text-sm font-medium">Site Plan Review</p>
                <p className="text-xs text-muted-foreground">3 days ago</p>
              </div>
            </div>
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

      {/* Right - Bell & Avatar */}
      <div className="flex items-center gap-3">
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
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleClearChats} className="cursor-pointer text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Chats
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};