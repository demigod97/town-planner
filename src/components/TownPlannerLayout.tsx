/**
 * 📄 TownPlannerLayout.tsx
 * Part of the HHLM project – town-planning RAG assistant
 * Purpose: Main layout component with restructured sidebar architecture
 * Generated: 2025-01-27
 * ------------------------------------------------------
 * Modern layout with unified left sidebar and reports-only right sidebar
 */

import { useEffect } from 'react';
import { TopBar } from '@/components/TopBar';
import { EnhancedChatStream } from '@/components/EnhancedChatStream';
import { ReportsOnlySidebar } from '@/components/ReportsOnlySidebar';
import { ComponentErrorBoundary } from '@/components/ErrorBoundary';
import { useSessionManagement } from '@/hooks/useSessionManagement';
import { toast } from 'sonner';

interface TownPlannerLayoutProps {
  notebookId: string;
  initialSessionId?: string;
}

export const TownPlannerLayout = ({ 
  notebookId, 
  initialSessionId 
}: TownPlannerLayoutProps) => {
  // Session management
  const {
    sessionState,
    sessions,
    isLoading,
    isInitialized,
    error,
    createSession,
    clearAllHistory,
    switchToSession,
    recoverFromError,
    isCreatingSession,
    isClearingHistory
  } = useSessionManagement({ 
    notebookId, 
    autoRestore: true, 
    enableRealtime: true 
  });

  // Handle session selection
  const handleSessionSelect = async (sessionId: string) => {
    try {
      await switchToSession(sessionId);
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
    } catch (error) {
      toast.error('Failed to create new session');
      console.error('Session creation error:', error);
    }
  };

  // Handle clear history
  const handleClearHistory = async () => {
    try {
      await clearAllHistory();
    } catch (error) {
      toast.error('Failed to clear history');
      console.error('Clear history error:', error);
    }
  };

  // Handle report generation
  const handleGenerateReport = () => {
    // This would open a report generation modal or navigate to report creation
    toast.info('Report generation coming soon');
  };

  // Error recovery
  if (error && !sessionState.currentSessionId && !isLoading) {
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
          notebookId={notebookId}
          currentSessionId={sessionState.currentSessionId}
          sessions={sessions}
          onSessionSelect={handleSessionSelect}
          onCreateSession={handleCreateSession}
          onClearHistory={handleClearHistory}
          isClearingHistory={isClearingHistory}
        />
        
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {isLoading && !isInitialized ? (
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
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};