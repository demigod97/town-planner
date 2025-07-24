import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AlertTriangle, 
  RefreshCw, 
  Download, 
  Trash2, 
  Activity,
  Database,
  Wifi,
  WifiOff,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { ErrorHandler, PerformanceMonitor } from "@/lib/error-handling";
import { useNetworkStatus } from "@/hooks/useErrorHandler";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";

interface ErrorStatusPageProps {
  onClose?: () => void;
}

export const ErrorStatusPage = ({ onClose }: ErrorStatusPageProps) => {
  const [errorStats, setErrorStats] = useState<any>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>({});
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const { isOnline, connectionQuality } = useNetworkStatus();

  useEffect(() => {
    const updateStats = () => {
      const stats = ErrorHandler.getLogger().getErrorStats();
      const perfMetrics = PerformanceMonitor.getMetrics();
      const errors = ErrorHandler.getLogger().getErrors().slice(0, 10);
      
      setErrorStats(stats);
      setPerformanceMetrics(perfMetrics);
      setRecentErrors(errors);
    };

    updateStats();
    const interval = setInterval(updateStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const clearErrors = () => {
    ErrorHandler.getLogger().clearErrors();
    setErrorStats({ total: 0, bySeverity: {}, byType: {} });
    setRecentErrors([]);
    toast.success("Error logs cleared");
  };

  const downloadErrorReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      errorStats,
      performanceMetrics,
      recentErrors,
      systemInfo: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        online: isOnline,
        connectionQuality
      }
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Error report downloaded");
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'secondary';
      case 'LOW': return 'outline';
      default: return 'outline';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <ComponentErrorBoundary>
      <div className="h-full flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              System Status
            </SheetTitle>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <Badge variant={isOnline ? "default" : "destructive"}>
                {connectionQuality}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 p-4">
          <Tabs defaultValue="overview" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="errors">Errors</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {errorStats?.total || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Connection</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {isOnline ? (
                        <Wifi className="h-4 w-4 text-green-500" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm">{connectionQuality}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Error Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {errorStats && Object.entries(errorStats.bySeverity).map(([severity, count]) => (
                      <div key={severity} className="flex items-center justify-between">
                        <Badge variant={getSeverityColor(severity)}>
                          {severity}
                        </Badge>
                        <span className="text-sm">{count as number}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadErrorReport}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Report
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearErrors}
                  className="flex-1"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Logs
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="errors" className="flex-1">
              <ScrollArea className="h-full">
                <div className="space-y-3">
                  {recentErrors.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No recent errors</p>
                    </div>
                  ) : (
                    recentErrors.map((error, index) => (
                      <Card key={index}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <Badge variant={getSeverityColor(error.severity)}>
                              {error.severity}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(error.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm font-medium">{error.type}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {error.userMessage}
                          </p>
                          {error.context && (
                            <details className="mt-2">
                              <summary className="text-xs cursor-pointer">Context</summary>
                              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                                {JSON.stringify(error.context, null, 2)}
                              </pre>
                            </details>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="performance" className="flex-1">
              <ScrollArea className="h-full">
                <div className="space-y-3">
                  {Object.keys(performanceMetrics).length === 0 ? (
                    <div className="text-center py-8">
                      <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No performance data</p>
                    </div>
                  ) : (
                    Object.entries(performanceMetrics).map(([operation, metrics]) => (
                      <Card key={operation}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">{operation}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Average</p>
                              <p className="font-medium">{formatDuration(metrics.average)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Recent</p>
                              <p className="font-medium">{formatDuration(metrics.recent)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Count</p>
                              <p className="font-medium">{metrics.count}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};