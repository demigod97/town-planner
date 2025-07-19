import { useState } from "react";
import { TopBar } from "./TopBar";
import { SourcesSidebar } from "./SourcesSidebar";
import { ChatArea } from "./ChatArea";
import { ActionsSidebar } from "./ActionsSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, FileText, Settings } from "lucide-react";

export const TownPlannerLayout = () => {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-background">
      <TopBar />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sources Sidebar */}
        <div className="hidden md:block">
          <SourcesSidebar />
        </div>
        
        {/* Mobile Sources Sheet */}
        <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="md:hidden fixed top-16 left-2 z-40">
              <FileText className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[300px]">
            <SourcesSidebar />
          </SheetContent>
        </Sheet>
        
        {/* Chat Area */}
        <ChatArea />
        
        {/* Desktop Actions Sidebar */}
        <div className="hidden md:block">
          <ActionsSidebar />
        </div>
        
        {/* Mobile Actions Sheet */}
        <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="md:hidden fixed top-16 right-2 z-40">
              <Settings className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0 w-[300px]">
            <ActionsSidebar />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};