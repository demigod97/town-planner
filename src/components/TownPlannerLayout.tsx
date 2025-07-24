import { useState } from "react";
import { TopBar } from "./TopBar";
import { UnifiedSidebar } from "./UnifiedSidebar";
import { ChatStream } from "./ChatStream";
import { ReportsTab } from "./ReportsTab";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, FileText } from "lucide-react";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";

interface TownPlannerLayoutProps {
  sessionId: string;
  notebookId?: string;
}

export const TownPlannerLayout = ({ sessionId, notebookId = "default" }: TownPlannerLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSessionSelect = (newSessionId: string) => {
    window.location.href = `/?sessionId=${newSessionId}`;
  };

  const handleTemplateCreated = (templateId: string) => {
    console.log('Template created:', templateId);
    // Could trigger a refresh or notification here
  };

  return (
    <ComponentErrorBoundary>
      <div className="h-full flex flex-col bg-background overflow-hidden">
        <TopBar onSessionSelect={handleSessionSelect} />
        
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Desktop Unified Sidebar */}
          <div className="hidden md:block">
            <UnifiedSidebar 
              sessionId={sessionId}
              notebookId={notebookId}
              onSessionSelect={handleSessionSelect}
              onTemplateCreated={handleTemplateCreated}
            />
          </div>
          
          {/* Mobile Sidebar Sheet */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="md:hidden fixed top-16 left-2 z-40 swipe-area"
                data-testid="mobile-sources-trigger"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[320px] swipe-area" data-testid="sheet-close">
              <UnifiedSidebar 
                sessionId={sessionId}
                notebookId={notebookId}
                onSessionSelect={(newSessionId) => {
                  handleSessionSelect(newSessionId);
                  setSidebarOpen(false);
                }}
                onTemplateCreated={handleTemplateCreated}
              />
            </SheetContent>
          </Sheet>
          
          {/* Chat Area */}
          <div className="flex-1 min-w-0">
            <ChatStream sessionId={sessionId} />
          </div>
          
          {/* Reports Sidebar */}
          <div className="hidden md:block w-[340px] border-l">
            <ReportsTab notebookId={notebookId} />
          </div>
          
          {/* Mobile Reports Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="md:hidden fixed top-16 right-2 z-40 swipe-area"
                data-testid="mobile-actions-trigger"
              >
                <FileText className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 w-[340px] swipe-area">
              <ReportsTab notebookId={notebookId} />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};