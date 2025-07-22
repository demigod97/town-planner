import { useState } from "react";
import { TopBar } from "./TopBar";
import { SourcesSidebar } from "./SourcesSidebar";
import { ChatStream } from "./ChatStream";
import { PermitDrawer } from "./PermitDrawer";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, FileText, Settings } from "lucide-react";

interface TownPlannerLayoutProps {
  sessionId: string;
  notebookId?: string;
}

export const TownPlannerLayout = ({ sessionId, notebookId = "default" }: TownPlannerLayoutProps) => {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const handleSessionSelect = (newSessionId: string) => {
    window.location.href = `/?sessionId=${newSessionId}`;
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <TopBar onSessionSelect={handleSessionSelect} />
      
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Desktop Sources Sidebar */}
        <div className="hidden md:block">
          <SourcesSidebar notebookId={notebookId} />
        </div>
        
        {/* Mobile Sources Sheet */}
        <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="md:hidden fixed top-16 left-2 z-40 swipe-area">
              <FileText className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[300px] swipe-area">
            <SourcesSidebar notebookId={notebookId} />
          </SheetContent>
        </Sheet>
        
        {/* Chat Area */}
        <ChatStream sessionId={sessionId} />
        
        {/* Desktop Actions Sidebar */}
        <div className="hidden md:block">
          <PermitDrawer />
        </div>
        
        {/* Mobile Actions Sheet */}
        <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="md:hidden fixed top-16 right-2 z-40 swipe-area">
              <Settings className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0 w-[300px] swipe-area">
            <PermitDrawer />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};