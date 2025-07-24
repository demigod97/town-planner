/**
 * 📄 ReportsOnlySidebar.tsx
 * Part of the HHLM project – town-planning RAG assistant
 * Purpose: Dedicated reports sidebar for the right side
 * Generated: 2025-01-27
 * ------------------------------------------------------
 * Focused reports management interface
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  Download, 
  Search, 
  Calendar, 
  MapPin, 
  Loader2, 
  AlertCircle, 
  RefreshCw, 
  Eye,
  Plus
} from 'lucide-react';
import { supabase } from '@/lib/api';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { ComponentErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingWithError } from '@/components/ui/error-display';

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
  error_message?: string;
}

interface ReportsOnlySidebarProps {
  notebookId: string;
  onGenerateReport?: () => void;
}

export const ReportsOnlySidebar = ({ 
  notebookId, 
  onGenerateReport 
}: ReportsOnlySidebarProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportContent, setReportContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  
  const { handleAsyncError } = useErrorHandler();

  const { data: reports = [], isLoading, error, refetch } = useQuery({
    queryKey: ['reports', notebookId],
    queryFn: async (): Promise<Report[]> => {
      return handleAsyncError(async () => {
        const { data, error } = await supabase
          .from('report_generations')
          .select('*')
          .eq('notebook_id', notebookId)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
      }, { operation: 'fetch_reports', notebookId });
    },
    retry: 3,
    staleTime: 30000
  });

  const fetchReportContent = async (report: Report) => {
    if (!report.file_path) {
      setContentError('Report file not available');
      return;
    }

    setIsLoadingContent(true);
    setContentError('');
    
    try {
      const content = await handleAsyncError(async () => {
        const { data, error } = await supabase.storage
          .from('reports')
          .download(report.file_path!);
        
        if (error) throw error;
        return await data.text();
      }, { operation: 'fetch_report_content', reportId: report.id });
      
      setReportContent(content);
    } catch (error) {
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
    if (!report.file_path) {
      toast.error('Report file not available');
      return;
    }

    setIsDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('reports')
        .download(report.file_path);
      
      if (error) throw error;

      const blob = new Blob([data], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Download started');
    } catch (error) {
      toast.error('Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'processing': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const formatMarkdownToHtml = (markdown: string): string => {
    return markdown
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4 text-gray-900 border-b pb-2">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mb-3 text-gray-800 mt-6 border-b border-gray-200 pb-1">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-medium mb-2 text-gray-700 mt-4">$1</h3>')
      .replace(/^\*\*(.*?)\*\*/gim, '<strong class="font-semibold">$1</strong>')
      .replace(/^\*(.*?)\*/gim, '<em class="italic">$1</em>')
      .replace(/^- (.*$)/gim, '<li class="ml-4 mb-1">$1</li>')
      .replace(/\n\n/g, '</p><p class="mb-3 leading-relaxed">')
      .replace(/^(?!<[h|l|p])(.+)$/gim, '<p class="mb-3 leading-relaxed">$1</p>');
  };

  const filteredReports = reports.filter(report =>
    report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ComponentErrorBoundary>
      <div className="w-[340px] bg-sidebar border-l h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sidebar-foreground">Reports</h2>
            <Button
              size="sm"
              onClick={onGenerateReport}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Generate
            </Button>
          </div>
          <p className="text-sm text-sidebar-foreground/70">
            View and manage generated reports
          </p>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Reports List */}
        <div className="flex-1 overflow-hidden">
          <LoadingWithError 
            isLoading={isLoading} 
            error={error} 
            retry={() => refetch()}
            fallbackMessage="Failed to load reports"
          >
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {filteredReports.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      {searchTerm ? 'No reports match your search' : 'No reports generated yet'}
                    </p>
                    {!searchTerm && onGenerateReport && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onGenerateReport}
                        className="mt-2"
                      >
                        Generate First Report
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredReports.map((report) => (
                    <div
                      key={report.id}
                      className="p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => handleReportClick(report)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-medium text-foreground truncate flex-1">
                          {report.title}
                        </h4>
                        <div className="flex items-center gap-1 ml-2">
                          <Badge variant={getStatusColor(report.status)} className="text-xs">
                            {report.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadReport(report);
                            }}
                            disabled={isDownloading || !report.file_path}
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {report.topic}
                      </p>
                      
                      <div className="space-y-1">
                        {report.address && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{report.address}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          <span>{new Date(report.created_at).toLocaleDateString()}</span>
                        </div>
                        
                        {report.file_size && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <FileText className="h-3 w-3 flex-shrink-0" />
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

                      {report.error_message && (
                        <div className="mt-2 text-xs text-destructive">
                          {report.error_message}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </LoadingWithError>
        </div>

        {/* Report Content Modal */}
        <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-xl font-bold pr-8">
                  {selectedReport?.title}
                </DialogTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedReport && downloadReport(selectedReport)}
                  disabled={isDownloading || !selectedReport?.file_path}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download
                </Button>
              </div>
              
              {selectedReport && (
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(selectedReport.created_at).toLocaleDateString()}</span>
                  </div>
                  {selectedReport.address && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{selectedReport.address}</span>
                    </div>
                  )}
                  {selectedReport.file_size && (
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      <span>{formatFileSize(selectedReport.file_size)}</span>
                    </div>
                  )}
                </div>
              )}
            </DialogHeader>
            
            <div className="flex-1 overflow-hidden">
              {isLoadingContent ? (
                <div className="flex items-center justify-center py-12 h-full">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
                    <p className="text-sm text-muted-foreground">Loading report content...</p>
                  </div>
                </div>
              ) : contentError ? (
                <div className="flex items-center justify-center py-12 h-full">
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
                <ScrollArea className="h-full">
                  <div className="p-6 bg-white rounded-lg border shadow-sm max-w-3xl mx-auto">
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