import { useCallback } from 'react';
import { ErrorHandler, ErrorType, ErrorSeverity, RetryHandler } from '@/lib/error-handling';

export const useErrorHandler = () => {
  const handleError = useCallback((error: any, context?: Record<string, any>) => {
    return ErrorHandler.handle(error, context);
  }, []);

  const handleAsyncError = useCallback(async (
    operation: () => Promise<any>,
    context?: Record<string, any>
  ) => {
    try {
      return await operation();
    } catch (error) {
      handleError(error, context);
      throw error;
    }
  }, [handleError]);

  const handleWithRetry = useCallback(async (
    operation: () => Promise<any>,
    maxRetries: number = 3,
    context?: Record<string, any>
  ) => {
    try {
      return await RetryHandler.withRetry(operation, maxRetries);
    } catch (error) {
      handleError(error, { ...context, operation: 'retry_failed', maxRetries });
      throw error;
    }
  }, [handleError]);

  return {
    handleError,
    handleAsyncError,
    handleWithRetry
  };
};