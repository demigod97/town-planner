// Error Handling Strategy for Town Planner Application
import { toast } from "@/components/ui/sonner";

// Error Types
export enum ErrorType {
  NETWORK = 'NETWORK',
  API = 'API',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  PERMISSION = 'PERMISSION',
  FILE_UPLOAD = 'FILE_UPLOAD',
  PROCESSING = 'PROCESSING',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  code?: string;
  details?: any;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  context?: Record<string, any>;
}

// Error Logger
class ErrorLogger {
  private static instance: ErrorLogger;
  private errors: AppError[] = [];
  private maxErrors = 100;

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  log(error: AppError): void {
    // Add to local storage
    this.errors.unshift(error);
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // Store in localStorage for persistence
    try {
      localStorage.setItem('app_errors', JSON.stringify(this.errors.slice(0, 20)));
    } catch (e) {
      console.warn('Failed to store errors in localStorage');
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('App Error:', error);
    }

    // Send to external logging service (implement as needed)
    this.sendToLoggingService(error);
  }

  private async sendToLoggingService(error: AppError): Promise<void> {
    // Only send critical and high severity errors to external service
    if (error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.HIGH) {
      try {
        // Example: Send to Sentry, LogRocket, or custom logging endpoint
        await fetch('/api/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(error)
        });
      } catch (e) {
        console.warn('Failed to send error to logging service');
      }
    }
  }

  getErrors(): AppError[] {
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
    localStorage.removeItem('app_errors');
  }
}

// Error Handler Class
export class ErrorHandler {
  private static logger = ErrorLogger.getInstance();

  static handle(error: any, context?: Record<string, any>): AppError {
    const appError = this.createAppError(error, context);
    this.logger.log(appError);
    this.showUserNotification(appError);
    return appError;
  }

  private static createAppError(error: any, context?: Record<string, any>): AppError {
    const timestamp = new Date();
    
    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        type: ErrorType.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        message: error.message,
        userMessage: 'Connection problem. Please check your internet connection and try again.',
        timestamp,
        context
      };
    }

    // Supabase API errors
    if (error.code && typeof error.code === 'string') {
      return this.handleSupabaseError(error, timestamp, context);
    }

    // File upload errors
    if (context?.operation === 'file_upload') {
      return {
        type: ErrorType.FILE_UPLOAD,
        severity: ErrorSeverity.MEDIUM,
        message: error.message,
        userMessage: 'File upload failed. Please check the file size and format, then try again.',
        timestamp,
        context
      };
    }

    // Validation errors
    if (error.name === 'ValidationError' || context?.operation === 'validation') {
      return {
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.LOW,
        message: error.message,
        userMessage: 'Please check your input and try again.',
        timestamp,
        context
      };
    }

    // Authentication errors
    if (error.message?.includes('auth') || error.message?.includes('unauthorized')) {
      return {
        type: ErrorType.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        message: error.message,
        userMessage: 'Authentication required. Please log in and try again.',
        timestamp,
        context
      };
    }

    // Default unknown error
    return {
      type: ErrorType.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      message: error.message || 'Unknown error occurred',
      userMessage: 'Something went wrong. Please try again or contact support if the problem persists.',
      timestamp,
      context
    };
  }

  private static handleSupabaseError(error: any, timestamp: Date, context?: Record<string, any>): AppError {
    const code = error.code;
    
    switch (code) {
      case '42703': // Column does not exist
        return {
          type: ErrorType.API,
          severity: ErrorSeverity.HIGH,
          message: `Database column error: ${error.message}`,
          userMessage: 'A technical issue occurred. Our team has been notified.',
          code,
          timestamp,
          context
        };
      
      case '22P02': // Invalid UUID
        return {
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          message: `Invalid ID format: ${error.message}`,
          userMessage: 'Invalid data format. Please refresh the page and try again.',
          code,
          timestamp,
          context
        };
      
      case '23505': // Unique constraint violation
        return {
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.LOW,
          message: `Duplicate entry: ${error.message}`,
          userMessage: 'This item already exists. Please use a different name or value.',
          code,
          timestamp,
          context
        };
      
      case 'PGRST116': // No rows returned
        return {
          type: ErrorType.API,
          severity: ErrorSeverity.LOW,
          message: 'No data found',
          userMessage: 'No data found for your request.',
          code,
          timestamp,
          context
        };
      
      default:
        return {
          type: ErrorType.API,
          severity: ErrorSeverity.MEDIUM,
          message: error.message,
          userMessage: 'A server error occurred. Please try again in a moment.',
          code,
          timestamp,
          context
        };
    }
  }

  private static showUserNotification(error: AppError): void {
    const variant = error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.HIGH 
      ? 'destructive' 
      : 'default';

    toast(error.userMessage, {
      description: error.severity === ErrorSeverity.CRITICAL 
        ? 'Please contact support if this issue persists.'
        : undefined,
      duration: error.severity === ErrorSeverity.LOW ? 3000 : 5000,
    });
  }

  static getLogger(): ErrorLogger {
    return this.logger;
  }
}

// Retry mechanism for failed operations
export class RetryHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
    backoff: number = 2
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain error types
        if (this.shouldNotRetry(error)) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(backoff, attempt - 1)));
      }
    }
    
    throw lastError;
  }

  private static shouldNotRetry(error: any): boolean {
    // Don't retry validation errors, authentication errors, or 4xx errors
    if (error.code === '22P02' || error.code === '23505') return true;
    if (error.message?.includes('auth') || error.message?.includes('unauthorized')) return true;
    if (error.status >= 400 && error.status < 500) return true;
    return false;
  }
}

// Network status monitoring
export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private isOnline: boolean = navigator.onLine;
  private listeners: ((online: boolean) => void)[] = [];

  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  constructor() {
    window.addEventListener('online', () => this.setOnlineStatus(true));
    window.addEventListener('offline', () => this.setOnlineStatus(false));
  }

  private setOnlineStatus(online: boolean): void {
    this.isOnline = online;
    this.listeners.forEach(listener => listener(online));
    
    if (online) {
      toast('Connection restored', {
        description: 'You are back online.',
        duration: 3000,
      });
    } else {
      toast('Connection lost', {
        description: 'You are currently offline. Some features may not work.',
        duration: 5000,
      });
    }
  }

  isOnlineStatus(): boolean {
    return this.isOnline;
  }

  onStatusChange(listener: (online: boolean) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

// Offline storage for failed operations
export class OfflineQueue {
  private static instance: OfflineQueue;
  private queue: Array<{
    id: string;
    operation: string;
    data: any;
    timestamp: Date;
    retryCount: number;
  }> = [];

  static getInstance(): OfflineQueue {
    if (!OfflineQueue.instance) {
      OfflineQueue.instance = new OfflineQueue();
      OfflineQueue.instance.loadFromStorage();
    }
    return OfflineQueue.instance;
  }

  addToQueue(operation: string, data: any): string {
    const id = crypto.randomUUID();
    const item = {
      id,
      operation,
      data,
      timestamp: new Date(),
      retryCount: 0
    };
    
    this.queue.push(item);
    this.saveToStorage();
    return id;
  }

  async processQueue(): Promise<void> {
    if (!NetworkMonitor.getInstance().isOnlineStatus()) {
      return;
    }

    const itemsToProcess = [...this.queue];
    
    for (const item of itemsToProcess) {
      try {
        await this.processQueueItem(item);
        this.removeFromQueue(item.id);
      } catch (error) {
        item.retryCount++;
        if (item.retryCount >= 3) {
          this.removeFromQueue(item.id);
          ErrorHandler.handle(error, { 
            operation: 'offline_queue_processing',
            queueItem: item 
          });
        }
      }
    }
    
    this.saveToStorage();
  }

  private async processQueueItem(item: any): Promise<void> {
    // Implement specific operation handlers
    switch (item.operation) {
      case 'upload_file':
        // Re-attempt file upload
        break;
      case 'send_message':
        // Re-attempt message sending
        break;
      default:
        throw new Error(`Unknown operation: ${item.operation}`);
    }
  }

  private removeFromQueue(id: string): void {
    this.queue = this.queue.filter(item => item.id !== id);
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('offline_queue', JSON.stringify(this.queue));
    } catch (e) {
      console.warn('Failed to save offline queue');
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('offline_queue');
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load offline queue');
    }
  }
}

// Error boundary helper
export const createErrorBoundary = (fallbackComponent: React.ComponentType<any>) => {
  return class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error?: Error }
  > {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      ErrorHandler.handle(error, {
        operation: 'react_error_boundary',
        errorInfo,
        componentStack: errorInfo.componentStack
      });
    }

    render() {
      if (this.state.hasError) {
        return React.createElement(fallbackComponent, { 
          error: this.state.error,
          retry: () => this.setState({ hasError: false, error: undefined })
        });
      }

      return this.props.children;
    }
  };
};

// Validation helpers
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const validateRequired = (value: any, fieldName: string): void => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
};

export const validateEmail = (email: string): void => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Please enter a valid email address', 'email');
  }
};

export const validateFileSize = (file: File, maxSizeMB: number): void => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new ValidationError(`File size must be less than ${maxSizeMB}MB`, 'file');
  }
};

export const validateFileType = (file: File, allowedTypes: string[]): void => {
  if (!allowedTypes.includes(file.type)) {
    throw new ValidationError(`File type must be one of: ${allowedTypes.join(', ')}`, 'file');
  }
};