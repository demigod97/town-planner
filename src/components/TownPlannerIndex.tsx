import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { TopBar } from "./TopBar";
import { SourcesSidebar } from "./SourcesSidebar";
import { ChatStream } from "./ChatStream";
import { PermitDrawer } from "./PermitDrawer";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { FileText, Settings } from "lucide-react";

export const TownPlannerIndex = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessionId, setSessionId] = useState<string>("");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    const currentSessionId = searchParams.get("sessionId");
    
    if (!currentSessionId) {
      const newSessionId = uuidv4();
      setSessionId(newSessionId);
      setSearchParams({ sessionId: newSessionId });
    } else {
      setSessionId(currentSessionId);
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Sticky TopBar */}
      <div className="sticky top-0 z-50">
        <TopBar />
      </div>
      
      {/* Main Grid Layout */}
      <div className="flex-1 overflow-hidden">
        {/* Desktop Grid: 260px | 1fr | 340px */}
        <div className="hidden md:grid grid-cols-[260px_1fr_340px] h-full">
          <SourcesSidebar />
          <ChatStream sessionId={sessionId} />
          <PermitDrawer />
        </div>
        
        {/* Mobile Layout */}
        <div className="md:hidden h-full relative">
          {/* Mobile Floating Buttons */}
          <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="fixed top-16 left-2 z-40">
                <FileText className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[300px]">
              <SourcesSidebar />
            </SheetContent>
          </Sheet>
          
          <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="fixed top-16 right-2 z-40">
                <Settings className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 w-[300px]">
              <PermitDrawer />
            </SheetContent>
          </Sheet>
          
          {/* Full-width chat on mobile */}
          <ChatStream sessionId={sessionId} />
        </div>
      </div>
    </div>
  );
};