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
  const [initializationError, setInitializationError] = useState<string>("");
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
        setInitializationError("");
        
        // Initialize notebook
        const defaultNotebook = await handleAsyncError(
          () => getDefaultNotebook(),
          { operation: 'initialize_notebook' }
        );
        setNotebookId(defaultNotebook);
        
        // Handle session initialization with recovery
        const currentSessionId = searchParams.get("sessionId");
        if (currentSessionId) {
          // Verify session exists and is accessible
          try {
            const { data: sessionExists, error: sessionError } = await supabase
              .from('chat_sessions')
              .select('id')
              .eq('id', currentSessionId)
              .single();

            if (sessionError || !sessionExists) {
              console.log('Session not found, creating new one');
              throw new Error('Session not found');
            }

            setSessionId(currentSessionId);
          } catch (sessionError) {
            // Create new session if current one is invalid
            const newSessionId = await handleAsyncError(
              () => createChatSession(defaultNotebook),
              { operation: 'create_chat_session_recovery' }
            );
            setSessionId(newSessionId);
            setSearchParams({ sessionId: newSessionId });
          }
        } else {
          // Create new session
          const newSessionId = await handleAsyncError(
            () => createChatSession(defaultNotebook),
            { operation: 'create_chat_session' }
          );
          setSessionId(newSessionId);
          setSearchParams({ sessionId: newSessionId });
        }
      } catch (error) {
        console.error("Failed to initialize app:", error);
        setInitializationError(error.message || "Failed to initialize application");
      }
    };

    // Only initialize when user is authenticated
    if (initialized && !loading && user) {
      initializeApp();
    }
  }, [initialized, loading, user, searchParams, setSearchParams, handleAsyncError]);

  // Show loading state while authentication is in progress
  if (loading || !initialized) {
    return <LoadingWithError isLoading={true} fallbackMessage="Initializing authentication..." />;
  }

  // Don't render anything if not authenticated - redirect will handle it
  if (!user) {
    return null;
  }

  // Show loading state while app is being initialized
  if (!sessionId || !notebookId) {
    return (
      <LoadingWithError 
        isLoading={true} 
        error={initializationError ? new Error(initializationError) : null}
        retry={() => window.location.reload()}
        fallbackMessage="Initializing workspace..." 
      />
    );
  }

  return (
    <ComponentErrorBoundary>
      <TownPlannerLayout sessionId={sessionId} notebookId={notebookId} />
    </ComponentErrorBoundary>
  );
};

export default Index;