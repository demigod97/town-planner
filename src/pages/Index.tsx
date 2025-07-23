import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { getDefaultNotebook } from "@/lib/api";
import { useSession } from "@/hooks/useSession";
import { TopBar } from "@/components/TopBar";
import { SourcesSidebar } from "@/components/SourcesSidebar";
import { ChatStream } from "@/components/ChatStream";
import { PermitDrawer } from "@/components/PermitDrawer";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FileText, Settings } from "lucide-react";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { useErrorHandler } from "@/hooks/useErrorHandler";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading, initialized } = useSession();
  const [sessionId, setSessionId] = useState<string>("");
  const [notebookId, setNotebookId] = useState<string>("");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const { handleAsyncError } = useErrorHandler();
  const navigate = useNavigate();

  // Redirect to login if not authenticated (after initialization)
  useEffect(() => {
    if (initialized && !loading && !user) {
      console.log('User not authenticated, redirecting to login');
      navigate('/login', { 
        state: { from: { pathname: window.location.pathname + window.location.search } },
        replace: true 
      });
    }
  }, [initialized, loading, user, navigate]);

  useEffect(() => {
    const initializeNotebook = async () => {
      try {
        const defaultNotebook = await handleAsyncError(
          () => getDefaultNotebook(),
          { operation: 'initialize_notebook' }
        );
        setNotebookId(defaultNotebook);
      } catch (error) {
        // Error already handled by handleAsyncError
        console.error("Failed to initialize notebook:", error);
      }
    };

    // Only initialize notebook when user is authenticated
    if (initialized && !loading && user) {
      initializeNotebook();
    }

    const currentSessionId = searchParams.get("sessionId");
    if (currentSessionId) {
      setSessionId(currentSessionId);
    } else {
      const newSessionId = uuidv4();
      setSessionId(newSessionId);
      setSearchParams({ sessionId: newSessionId });
    }
  }, [searchParams, setSearchParams, user, loading, initialized]);

  // Show loading state while authentication is in progress
  if (loading || !initialized) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>{!initialized ? 'Initializing...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated - redirect will handle it
  if (!user) {
    return null;
  }

  // Show loading state while notebook is being initialized
  if (!sessionId || !notebookId) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Initializing workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <ComponentErrorBoundary>
      <div className="h-screen flex flex-col bg-background">
        <TopBar />
        
        <div className="flex-1 grid grid-cols-[260px_1fr_340px] md:grid-cols-3 overflow-hidden">
          {/* Desktop Sources Sidebar */}
          <div className="hidden md:block">
            <SourcesSidebar notebookId={notebookId} />
          </div>
          
          {/* Mobile Sources Sheet */}
          <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="md:hidden fixed top-16 left-2 z-40">
                <FileText className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[300px]">
              <SourcesSidebar notebookId={notebookId} />
            </SheetContent>
          </Sheet>
          
          {/* Chat Stream */}
          <ChatStream sessionId={sessionId} />
          
          {/* Desktop Actions Sidebar */}
          <div className="hidden md:block">
            <PermitDrawer sessionId={sessionId} notebookId={notebookId} />
          </div>
          
          {/* Mobile Actions Sheet */}
          <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="md:hidden fixed top-16 right-2 z-40">
                <Settings className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 w-[300px]">
              <PermitDrawer sessionId={sessionId} notebookId={notebookId} />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};

export default Index;