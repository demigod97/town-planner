import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Download, Search, Calendar, User, MapPin, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingWithError } from "@/components/ui/error-display";

interface Report {
  id: string;
  title: string;
  topic: string;
  address?: string;
  status: string;
  file_path?: string;
  file_format: string;
  file_size?: number;
  created_at: string;
  completed_at?: string;
  progress: number;
}

interface ReportsTabProps {
  notebookId: string;
}

export const ReportsTab = ({ notebookId }: ReportsTabProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportContent, setReportContent] = useState<string>("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string>("");
  const { toast } = useToast();
  const { handleAsyncError } = useErrorHandler();

  const { data: reports = [], isLoading, error, refetch } = useQuery({
    queryKey: ["reports", notebookId],
    queryFn: async (): Promise<Report[]> => {
      return handleAsyncError(async () => {
        const { data, error } = await supabase
          .from("report_generations")
          .select("*")
          .eq("notebook_id", notebookId)
          .eq("file_format", "markdown")
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        return data || [];
      }, { operation: 'fetch_reports', notebookId });
    },
    retry: (failureCount, error) => {
      if (failureCount < 3 && error.message?.includes('fetch')) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const fetchReportContent = async (report: Report) => {
    if (!report.file_path) {
      setContentError("Report file path not available");
      return;
    }

    setIsLoadingContent(true);
    setContentError("");
    
    try {
      const content = await handleAsyncError(async () => {
        const { data, error } = await supabase.storage
          .from('reports')
          .download(report.file_path!);
        
        if (error) throw error;
        
        const text = await data.text();
        return text;
      }, { operation: 'fetch_report_content', reportId: report.id });
      
      setReportContent(content);
    } catch (error) {
      console.error('Failed to fetch report content:', error);
      setContentError(error.message || 'Failed to load report content');
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleReportClick = async (report: Report) => {
    setSelectedReport(report);
    await fetchReportContent(report);
  };

  const downloadReport = async (report: Report) => {
    try {
      if (!report.file_path) {
        throw new Error("Report file not available for download");
      }

      const { data, error } = await supabase.storage
        .from('reports')
        .download(report.file_path);
      
      if (error) throw error;

      // Create download link
      const blob = new Blob([data], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: `${report.title} is being downloaded.`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download failed",
        description: error.message || "Failed to download report",
        variant: "destructive",
      });
    }
  };

  const formatMarkdownToHtml = (markdown: string): string => {
    // Simple markdown to HTML conversion
    return markdown
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4 text-gray-900">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mb-3 text-gray-800 mt-6">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-medium mb-2 text-gray-700 mt-4">$1</h3>')
      .replace(/^\*\*(.*)\*\*/gim, '<strong class="font-semibold">$1</strong>')
      .replace(/^\*(.*)\*/gim, '<em class="italic">$1</em>')
      .replace(/^- (.*$)/gim, '<li class="ml-4 mb-1">$1</li>')
      .replace(/^---$/gim, '<hr class="my-6 border-gray-300" />')
      .replace(/\n\n/g, '</p><p class="mb-4 text-gray-700 leading-relaxed">')
      .replace(/^(?!<[h|l|p|d])(.+)$/gim, '<p class="mb-4 text-gray-700 leading-relaxed">$1</p>');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredReports = reports.filter(report =>
    report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ComponentErrorBoundary>
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">
            Generated Reports
          </h3>
          
          <div className="relative mb-4">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <LoadingWithError 
          isLoading={isLoading} 
          error={error} 
          retry={() => refetch()}
          fallbackMessage="Failed to load reports"
        >
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {filteredReports.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {searchTerm ? "No reports match your search" : "No reports generated yet"}
                </p>
                {!searchTerm && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Generate your first report using the Actions tab
                  </p>
                )}
              </div>
            ) : (
              filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleReportClick(report)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate">
                        {report.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {report.topic}
                      </p>
                    </div>
                    <Badge variant={getStatusColor(report.status)} className="text-xs ml-2">
                      {report.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1">
                    {report.address && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{report.address}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(report.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    {report.file_size && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span>{formatFileSize(report.file_size)}</span>
                      </div>
                    )}
                  </div>
                  
                  {report.status === 'processing' && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{report.progress}%</span>
                      </div>
                      <Progress value={report.progress} className="h-1" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </LoadingWithError>

        {/* Report Content Modal */}
        <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{selectedReport?.title}</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedReport && downloadReport(selectedReport)}
                    disabled={!selectedReport?.file_path}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-hidden">
              {isLoadingContent ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
                    <p className="text-sm text-muted-foreground">Loading report content...</p>
                  </div>
                </div>
              ) : contentError ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 mx-auto mb-3 text-destructive" />
                    <p className="text-sm text-destructive mb-3">{contentError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectedReport && fetchReportContent(selectedReport)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                </div>
              ) : (
                <ScrollArea className="h-[60vh] w-full">
                  <div className="p-6 bg-white rounded-lg border">
                    {/* Report Header */}
                    <div className="mb-6 pb-4 border-b">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        {selectedReport?.title}
                      </h1>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>Topic: {selectedReport?.topic}</span>
                        </div>
                        {selectedReport?.address && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>{selectedReport.address}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{selectedReport && new Date(selectedReport.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Report Content */}
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ 
                        __html: formatMarkdownToHtml(reportContent) 
                      }}
                    />
                  </div>
                </ScrollArea>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ComponentErrorBoundary>
  );
};