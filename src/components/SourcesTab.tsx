import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  Search, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Loader2,
  Trash2,
  RefreshCw
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { supabase, uploadFile, deleteAllSources } from "@/lib/api";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";

interface Source {
  id: string;
  display_name: string;
  file_size: number;
  processing_status: string;
  created_at: string;
  error_message?: string;
}

interface UploadProgress {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

interface SourcesTabProps {
  notebookId: string;
  onClose?: () => void;
}

export const SourcesTab = ({ notebookId, onClose }: SourcesTabProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSources, setSelectedSources] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [userQuery, setUserQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  
  const { handleAsyncError } = useErrorHandler();
  const queryClient = useQueryClient();

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["sources", notebookId],
    queryFn: async (): Promise<Source[]> => {
      return handleAsyncError(async () => {
        const { data, error } = await supabase
          .from("sources")
          .select("*")
          .eq("notebook_id", notebookId)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        return data || [];
      }, { operation: 'fetch_sources', notebookId });
    },
    retry: 3,
    staleTime: 30000,
  });

  const simulateUploadProgress = (fileId: string): NodeJS.Timeout => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      
      if (progress >= 100) {
        progress = 100;
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: { ...prev[fileId], progress: 100, status: 'completed' }
        }));
        
        setTimeout(() => {
          setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileId];
            return newProgress;
          });
        }, 3000);
        
        clearInterval(interval);
      } else {
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: { ...prev[fileId], progress }
        }));
      }
    }, 200);

    return interval;
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    setIsUploading(true);
    
    for (const file of acceptedFiles) {
      const fileId = `${Date.now()}-${file.name}`;
      
      setUploadProgress(prev => ({
        ...prev,
        [fileId]: {
          id: fileId,
          fileName: file.name,
          progress: 0,
          status: 'uploading'
        }
      }));

      const progressInterval = simulateUploadProgress(fileId);

      try {
        await handleAsyncError(
          () => uploadFile(file, notebookId, userQuery.trim() || undefined),
          { operation: 'file_upload', fileName: file.name, fileSize: file.size }
        );
        
        toast.success(`${file.name} uploaded successfully`);
        setUserQuery("");
        queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
        
      } catch (error) {
        clearInterval(progressInterval);
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: {
            ...prev[fileId],
            status: 'error',
            error: error.message || 'Upload failed'
          }
        }));
        
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    
    setIsUploading(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    disabled: isUploading
  });

  const handleDeleteAllSources = async () => {
    setIsDeletingAll(true);
    try {
      await handleAsyncError(
        () => deleteAllSources(notebookId),
        { operation: 'delete_all_sources', notebookId }
      );
      
      toast.success("All documents deleted");
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
    } catch (error) {
      toast.error("Failed to delete documents");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const filteredSources = sources.filter(source =>
    source.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ComponentErrorBoundary>
      <div className="h-full flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Document Sources
            </SheetTitle>
            {sources.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteAllSources}
                disabled={isDeletingAll}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="p-4 space-y-4 flex-1 flex flex-col">
          {/* User Query Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Context Query (Optional)
            </label>
            <Textarea
              placeholder="What would you like to know about these documents?"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              className="min-h-[60px] resize-none"
              disabled={isUploading}
            />
          </div>

          {/* Upload Area */}
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 
              isUploading ? 'border-muted-foreground/25 bg-muted/20 cursor-not-allowed' :
              'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} disabled={isUploading} />
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isUploading ? 'Uploading...' : 
               isDragActive ? 'Drop PDFs here' : 
               'Drag PDFs or click to browse'}
            </p>
          </div>

          {/* Upload Progress */}
          {Object.keys(uploadProgress).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Upload Progress</h4>
              {Object.entries(uploadProgress).map(([fileId, progress]) => (
                <div key={fileId} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate max-w-[250px]">
                      {progress.fileName}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(progress.progress)}%
                    </span>
                  </div>
                  <Progress value={progress.progress} className="h-2" />
                  {progress.error && (
                    <p className="text-sm text-destructive">{progress.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Sources List */}
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {isLoading ? (
                <div className="text-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading documents...</p>
                </div>
              ) : filteredSources.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {searchTerm ? 'No documents match search' : 'No documents uploaded'}
                  </p>
                </div>
              ) : (
                filteredSources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-start gap-3 p-3 rounded border bg-background hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedSources[source.id] || false}
                      onCheckedChange={(checked) => 
                        setSelectedSources(prev => ({ ...prev, [source.id]: !!checked }))
                      }
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {source.display_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusIcon(source.processing_status)}
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(source.file_size)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {source.processing_status}
                        </Badge>
                      </div>
                      {source.error_message && (
                        <p className="text-xs text-destructive mt-1 truncate">
                          {source.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};