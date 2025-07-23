import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export const NetworkStatus: React.FC = () => {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <Alert className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-auto">
      <WifiOff className="h-4 w-4" />
      <AlertDescription>
        You're offline. Some features may not work properly.
      </AlertDescription>
    </Alert>
  );
};

export const NetworkIndicator: React.FC = () => {
  const { isOnline } = useNetworkStatus();

  return (
    <div className="flex items-center gap-2">
      {isOnline ? (
        <Wifi className="h-4 w-4 text-green-500" />
      ) : (
        <WifiOff className="h-4 w-4 text-red-500" />
      )}
      <span className="text-xs text-muted-foreground">
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
};