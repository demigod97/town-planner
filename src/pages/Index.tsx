import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { getDefaultNotebook, createChatSession } from "@/lib/api";
import { useSession } from "@/hooks/useSession";
import { TownPlannerLayout } from "@/components/TownPlannerLayout";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { LoadingWithError } from "@/components/ui/error-display";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading, initialized } = useSession();
  const [sessionId, setSessionId] = useState<string>("");
  const [notebookId, setNotebookId] = useState<string>("");
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
    const initializeApp = async () => {
      try {
        const defaultNotebook = await handleAsyncError(
          () => getDefaultNotebook(),
          { operation: 'initialize_notebook' }
        );
        setNotebookId(defaultNotebook);
        
        // Handle session initialization
        const currentSessionId = searchParams.get("sessionId");
        if (currentSessionId) {
          setSessionId(currentSessionId);
        } else {
          // Create new session in database and get the ID
          const newSessionId = await handleAsyncError(
            () => createChatSession(defaultNotebook),
            { operation: 'create_chat_session' }
          );
          setSessionId(newSessionId);
          setSearchParams({ sessionId: newSessionId });
        }
      } catch (error) {
        // Error already handled by handleAsyncError
        console.error("Failed to initialize app:", error);
      }
    };

    // Only initialize notebook when user is authenticated
    if (initialized && !loading && user) {
      initializeApp();
    }
  }, [initialized, loading, user, searchParams, handleAsyncError, navigate]);

  // Show loading state while authentication is in progress
  if (loading || !initialized) {
    return <LoadingWithError isLoading={true} />;
  }

  // Don't render anything if not authenticated - redirect will handle it
  if (!user) {
    return null;
  }

  // Show loading state while notebook is being initialized
  if (!sessionId || !notebookId) {
    return <LoadingWithError isLoading={true} fallbackMessage="Initializing workspace..." />;
  }

  return (
    <ComponentErrorBoundary>
      <TownPlannerLayout sessionId={sessionId} notebookId={notebookId} />
    </ComponentErrorBoundary>
  );
};

export default Index;