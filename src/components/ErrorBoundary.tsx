import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorFallbackProps {
  error?: Error;
  retry?: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, retry }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            An unexpected error occurred. Our team has been notified.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {import.meta.env.DEV && error && (
            <details className="rounded border p-2 text-sm">
              <summary className="cursor-pointer font-medium">Error Details</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs">{error.message}</pre>
            </details>
          )}
          <div className="flex gap-2">
            <Button onClick={() => window.location.reload()} variant="outline" className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload Page
            </Button>
            {retry && (
              <Button onClick={retry} className="flex-1">
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Component-level error boundary
export const ComponentErrorBoundary: React.FC<{
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
}> = ({ children, fallback: Fallback = ErrorFallback }) => {
  return (
    <ErrorBoundaryWrapper fallback={Fallback}>
      {children}
    </ErrorBoundaryWrapper>
  );
};

class ErrorBoundaryWrapper extends React.Component<
  { children: React.ReactNode; fallback: React.ComponentType<ErrorFallbackProps> },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback;
      return (
        <Fallback 
          error={this.state.error}
          retry={() => this.setState({ hasError: false, error: undefined })}
        />
      );
    }

    return this.props.children;
  }
}