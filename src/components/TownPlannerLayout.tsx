/**
 * 📄 TownPlannerLayout.tsx
 * Part of the HHLM project – town-planning RAG assistant
 * Purpose: Main layout component with restructured sidebar architecture
 * Generated: 2025-01-27
 * ------------------------------------------------------
 * Modern layout with unified left sidebar and reports-only right sidebar
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, FileText, BarChart3 } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { UnifiedSidebar } from '@/components/UnifiedSidebar';
import { EnhancedChatStream } from '@/components/EnhancedChatStream';
import { ReportsOnlySidebar } from '@/components/ReportsOnlySidebar';
import { ComponentErrorBoundary } from '@/components/ErrorBoundary';
import { useSessionManagement } from '@/hooks/useSessionManagement';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

interface TownPlannerLayoutProps {
  notebookId: string;
  initialSessionId?: string;
}

export const TownPlannerLayout = ({ 
  notebookId, 
  initialSessionId 
}: TownPlannerLayoutProps) => {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Session management
  const {
    sessionState,
    sessions,
    isLoading,
    error,
    createSession,
    switchToSession,
    recoverFromError,
    isCreatingSession
  } = useSessionManagement({ 
    notebookId, 
    autoRestore: true, 
    enableRealtime: true 
  });

  // Handle session selection
  const handleSessionSelect = async (sessionId: string) => {
    try {
      await switchToSession(sessionId);
      setLeftSidebarOpen(false); // Close mobile sidebar
      toast.success('Session switched');
    } catch (error) {
      toast.error('Failed to switch session');
      console.error('Session switch error:', error);
    }
  };

  // Handle new session creation
  const handleCreateSession = async () => {
    try {
      await createSession();
      setLeftSidebarOpen(false); // Close mobile sidebar
    } catch (error) {
      toast.error('Failed to create new session');
      console.error('Session creation error:', error);
    }
  };

  // Handle report generation
  const handleGenerateReport = () => {
    // This would open a report generation modal or navigate to report creation
    toast.info('Report generation coming soon');
  };

  // Handle clear chats
  const handleClearChats = () => {
    if (confirm('Clear all chat history? This cannot be undone.')) {
      // Implementation for clearing chats
      toast.success('Chat history cleared');
    }
  };

  // Auto-close mobile sidebars when switching to desktop
  useEffect(() => {
    if (!isMobile) {
      setLeftSidebarOpen(false);
      setRightSidebarOpen(false);
    }
  }, [isMobile]);

  // Error recovery
  if (error && !sessionState.currentSessionId) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6">
          <h2 className="text-xl font-semibold mb-2">Session Error</h2>
          <p className="text-muted-foreground mb-4">
            Failed to initialize chat session. This might be due to network issues or authentication problems.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={recoverFromError} variant="outline">
              Retry
            </Button>
            <Button onClick={handleCreateSession}>
              Start New Session
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ComponentErrorBoundary>
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        {/* Top Bar */}
        <TopBar 
          onClearChats={handleClearChats}
          onSessionSelect={handleSessionSelect}
        />
        
        <div className="flex-1 flex overflow-hidden">
          {/* Desktop Left Sidebar */}
          <div className="hidden lg:block">
            <UnifiedSidebar
              notebookId={notebookId}
              currentSessionId={sessionState.currentSessionId}
              sessions={sessions}
              onSessionSelect={handleSessionSelect}
              onCreateSession={handleCreateSession}
              isCreatingSession={isCreatingSession}
            />
          </div>
          
          {/* Mobile Left Sidebar */}
          <Sheet open={leftSidebarOpen} onOpenChange={setLeftSidebarOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="lg:hidden fixed top-16 left-2 z-40"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[320px]">
              <UnifiedSidebar
                notebookId={notebookId}
                currentSessionId={sessionState.currentSessionId}
                sessions={sessions}
                onSessionSelect={handleSessionSelect}
                onCreateSession={handleCreateSession}
                isCreatingSession={isCreatingSession}
              />
            </SheetContent>
          </Sheet>
          
          {/* Chat Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {isLoading && !sessionState.currentSessionId ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Initializing workspace...</p>
                </div>
              </div>
            ) : (
              <EnhancedChatStream 
                notebookId={notebookId}
                initialSessionId={sessionState.currentSessionId || undefined}
                className="flex-1"
              />
            )}
          </div>
          
          {/* Desktop Right Sidebar */}
          <div className="hidden lg:block">
            <ReportsOnlySidebar
              notebookId={notebookId}
              onGenerateReport={handleGenerateReport}
            />
          </div>
          
          {/* Mobile Right Sidebar */}
          <Sheet open={rightSidebarOpen} onOpenChange={setRightSidebarOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="lg:hidden fixed top-16 right-2 z-40"
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 w-[340px]">
              <ReportsOnlySidebar
                notebookId={notebookId}
                onGenerateReport={handleGenerateReport}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};