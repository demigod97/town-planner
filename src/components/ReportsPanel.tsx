import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileText, 
  Download, 
  Search, 
  Calendar, 
  User, 
  MapPin, 
  Loader2, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  X,
  Plus,
  Settings
} from "lucide-react";
import { supabase } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingWithError } from "@/components/ui/error-display";
import { Progress } from "@/components/ui/progress";

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

interface ReportTemplate {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  category?: string;
}

interface ReportsPanelProps {
  notebookId: string;
}

export const ReportsPanel = ({ notebookId }: ReportsPanelProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportContent, setReportContent] = useState<string>("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [showNewReportDialog, setShowNewReportDialog] = useState(false);
  const [newReportForm, setNewReportForm] = useState({
    templateId: "",
    topic: "",
    address: "",
    additionalContext: ""
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const { handleAsyncError } = useErrorHandler();

  // Reports Query
  const { data: reports = [], isLoading, error, refetch } = useQuery({
    queryKey: ["reports", notebookId],
    queryFn: async (): Promise<Report[]> => {
      return handleAsyncError(async () => {
        const { data, error } = await supabase
          .from("report_generations")
          .select("*")
          .eq("notebook_id", notebookId)
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

  // Templates Query
  const { data: templates = [] } = useQuery({
    queryKey: ["report_templates"],
    queryFn: async (): Promise<ReportTemplate[]> => {
      const { data, error } = await supabase
        .from("report_templates")
        .select("id, name, display_name, description, category")
        .eq("is_active", true)
        .order("display_name");
      
      if (error) throw error;
      return data || [];
    },
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
    setIsDownloading(true);
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
    } finally {
      setIsDownloading(false);
    }
  };

  const generateNewReport = async () => {
    if (!newReportForm.templateId || !newReportForm.topic) {
      toast({
        title: "Missing information",
        description: "Please select a template and enter a topic.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions
        .invoke('generate-report', {
          body: {
            notebook_id: notebookId,
            template_id: newReportForm.templateId,
            topic: newReportForm.topic,
            address: newReportForm.address || null,
            additional_context: newReportForm.additionalContext || null,
            llm_provider: 'ollama',
            llm_config: { model: 'qwen3:8b-q4_K_M' },
            embedding_provider: 'ollama'
          }
        });

      if (error) throw error;

      toast({
        title: "Report generation started",
        description: `Your ${newReportForm.topic} report is being generated.`,
      });

      setShowNewReportDialog(false);
      setNewReportForm({
        templateId: "",
        topic: "",
        address: "",
        additionalContext: ""
      });

      // Refresh reports list
      refetch();
    } catch (error) {
      console.error('Report generation failed:', error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to start report generation",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const formatMarkdownToHtml = (markdown: string): string => {
    return markdown
      .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mb-6 text-gray-900 border-b-2 border-gray-200 pb-3">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-semibold mb-4 text-gray-800 mt-8 border-b border-gray-200 pb-2">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-medium mb-3 text-gray-700 mt-6">$1</h3>')
      .replace(/^#### (.*$)/gim, '<h4 class="text-lg font-medium mb-2 text-gray-700 mt-4">$1</h4>')
      .replace(/^\*\*(.*?)\*\*/gim, '<strong class="font-semibold text-gray-900">$1</strong>')
      .replace(/^\*(.*?)\*/gim, '<em class="italic text-gray-700">$1</em>')
      .replace(/^- (.*$)/gim, '<li class="ml-6 mb-2 text-gray-700">$1</li>')
      .replace(/^(\d+)\. (.*$)/gim, '<li class="ml-6 mb-2 text-gray-700 list-decimal">$2</li>')
      .replace(/^---$/gim, '<hr class="my-8 border-gray-300 border-t-2" />')
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800">$1</code>')
      .replace(/\n\n/g, '</p><p class="mb-4 text-gray-700 leading-relaxed text-justify">')
      .replace(/^(?!<[h|l|p|d|c])(.+)$/gim, '<p class="mb-4 text-gray-700 leading-relaxed text-justify">$1</p>');
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

  const closeModal = () => {
    setSelectedReport(null);
    setReportContent("");
    setContentError("");
  };

  return (
    <ComponentErrorBoundary>
      <div className="w-[380px] bg-sidebar-custom border-l h-full flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-foreground">Reports</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewReportDialog(true)}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Generate and manage planning reports.</p>
        </div>

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

        <div className="flex-1 overflow-hidden">
          <LoadingWithError 
            isLoading={isLoading} 
            error={error} 
            retry={() => refetch()}
            fallbackMessage="Failed to load reports"
          >
            <ScrollArea className="h-full p-4">
              <div className="space-y-3">
                {filteredReports.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {searchTerm ? "No reports match your search" : "No reports generated yet"}
                    </p>
                    {!searchTerm && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNewReportDialog(true)}
                        className="mt-3"
                      >
                        <Plus className="h-4 w-4 mr-1" />
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
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {report.title}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {report.topic}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
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
                        <div className="mt-3">
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
            </ScrollArea>
          </LoadingWithError>
        </div>

        {/* New Report Dialog */}
        <Dialog open={showNewReportDialog} onOpenChange={setShowNewReportDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Generate New Report</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template">Report Template</Label>
                <Select
                  value={newReportForm.templateId}
                  onValueChange={(value) => setNewReportForm(prev => ({ ...prev, templateId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topic">Project Topic</Label>
                <Input
                  id="topic"
                  placeholder="e.g., Heritage Impact Assessment"
                  value={newReportForm.topic}
                  onChange={(e) => setNewReportForm(prev => ({ ...prev, topic: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Property Address (Optional)</Label>
                <Input
                  id="address"
                  placeholder="e.g., 123 Main Street, Melbourne"
                  value={newReportForm.address}
                  onChange={(e) => setNewReportForm(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="context">Additional Context (Optional)</Label>
                <Textarea
                  id="context"
                  placeholder="Any specific requirements or context..."
                  value={newReportForm.additionalContext}
                  onChange={(e) => setNewReportForm(prev => ({ ...prev, additionalContext: e.target.value }))}
                  className="min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowNewReportDialog(false)}
                  disabled={isGenerating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={generateNewReport}
                  disabled={isGenerating || !newReportForm.templateId || !newReportForm.topic}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Report
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Report Content Modal */}
        <Dialog open={!!selectedReport} onOpenChange={(open) => !open && closeModal()}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0 border-b pb-4">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-xl font-bold text-gray-900 pr-8">
                  {selectedReport?.title}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedReport && downloadReport(selectedReport)}
                    disabled={isDownloading || !selectedReport?.file_path}
                    className="flex items-center gap-2"
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {isDownloading ? 'Downloading...' : 'Download'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closeModal}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {selectedReport && (
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-3">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>Topic: {selectedReport.topic}</span>
                  </div>
                  {selectedReport.address && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{selectedReport.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(selectedReport.created_at).toLocaleDateString()}</span>
                  </div>
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
                    <p className="text-xs text-muted-foreground mt-1">
                      Converting markdown to formatted document
                    </p>
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
                <ScrollArea className="h-full w-full">
                  <div className="p-8 bg-white rounded-lg border shadow-sm max-w-4xl mx-auto">
                    <div className="mb-8 pb-6 border-b-2 border-gray-200">
                      <div className="text-center">
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">
                          {selectedReport?.title}
                        </h1>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 max-w-2xl mx-auto">
                          <div className="flex items-center justify-center gap-2">
                            <User className="h-4 w-4" />
                            <span><strong>Project:</strong> {selectedReport?.topic}</span>
                          </div>
                          {selectedReport?.address && (
                            <div className="flex items-center justify-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span><strong>Address:</strong> {selectedReport.address}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span><strong>Date:</strong> {selectedReport && new Date(selectedReport.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span><strong>Format:</strong> Planning Report</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="prose prose-lg max-w-none">
                      <div 
                        className="document-content"
                        dangerouslySetInnerHTML={{ 
                          __html: formatMarkdownToHtml(reportContent) 
                        }}
                        style={{
                          fontFamily: 'Georgia, "Times New Roman", serif',
                          lineHeight: '1.6',
                          fontSize: '16px'
                        }}
                      />
                    </div>
                    
                    <div className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
                      <p>Generated by Town Planner Assistant</p>
                      <p>Report ID: {selectedReport?.id}</p>
                    </div>
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