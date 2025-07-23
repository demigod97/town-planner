import React from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorDisplayProps {
  title?: string;
  message: string;
  type?: 'error' | 'warning' | 'info';
  retry?: () => void;
  showDetails?: boolean;
  details?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  title = 'Error',
  message,
  type = 'error',
  retry,
  showDetails = false,
  details
}) => {
  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'info':
        return <Wifi className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getVariant = () => {
    switch (type) {
      case 'error':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <Alert variant={getVariant()}>
      {getIcon()}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2">
        {message}
        {retry && (
          <Button
            variant="outline"
            size="sm"
            onClick={retry}
            className="mt-2 ml-0"
          >
            <RefreshCw className="mr-2 h-3 w-3" />
            Try Again
          </Button>
        )}
        {showDetails && details && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-medium">
              Technical Details
            </summary>
            <pre className="mt-1 text-xs whitespace-pre-wrap">{details}</pre>
          </details>
        )}
      </AlertDescription>
    </Alert>
  );
};

// Inline error component for form fields
export const FieldError: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  
  return (
    <p className="text-sm text-destructive mt-1 flex items-center gap-1">
      <AlertTriangle className="h-3 w-3" />
      {message}
    </p>
  );
};

// Loading state with error fallback
export const LoadingWithError: React.FC<{
  isLoading: boolean;
  error?: Error | null;
  retry?: () => void;
  children: React.ReactNode;
}> = ({ isLoading, error, retry, children }) => {
  if (error) {
    return (
      <ErrorDisplay
        message={error.message}
        retry={retry}
        showDetails={import.meta.env.DEV}
        details={error.stack}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
};