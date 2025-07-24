import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getDefaultNotebook, createChatSession } from "@/lib/api";
import { useSession } from "@/hooks/useSession";
import { TownPlannerLayout } from "@/components/TownPlannerLayout";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { LoadingWithError } from "@/components/ui/error-display";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading, initialized } = useSession();
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
      } catch (error) {
        // Error already handled by handleAsyncError
        console.error("Failed to initialize app:", error);
      }
    };

    // Only initialize notebook when user is authenticated
    if (initialized && !loading && user) {
      initializeApp();
    }
  }, [initialized, loading, user, handleAsyncError]);

  // Show loading state while authentication is in progress
  if (loading || !initialized) {
    return <LoadingWithError isLoading={true} />;
  }

  // Don't render anything if not authenticated - redirect will handle it
  if (!user) {
    return null;
  }

  // Show loading state while notebook is being initialized
  if (!notebookId) {
    return <LoadingWithError isLoading={true} fallbackMessage="Initializing workspace..." />;
  }

  // Get initial session ID from URL
  const initialSessionId = searchParams.get("sessionId") || undefined;
  return (
    <ComponentErrorBoundary>
      <TownPlannerLayout 
        notebookId={notebookId}
        initialSessionId={initialSessionId}
      />
    </ComponentErrorBoundary>
  );
};

export default Index;