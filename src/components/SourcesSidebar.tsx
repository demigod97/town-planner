import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Upload, Search } from "lucide-react";
import { supabase } from "@/lib/api";
import { uploadFile } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { useDropzone } from "react-dropzone";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { NetworkIndicator } from "@/components/NetworkStatus";

interface Source {
  id: string;
  display_name: string;
  file_size: number;
  file_path?: string;
  processing_status: string;
  created_at: string;
  updated_at: string;
}

interface SourcesSidebarProps {
  notebookId: string;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export const SourcesSidebar = ({ notebookId }: SourcesSidebarProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const { handleAsyncError } = useErrorHandler();

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
    retry: (failureCount, error) => {
      // Retry up to 3 times for network errors
      if (failureCount < 3 && error.message?.includes('fetch')) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const handleFileToggle = async (fileId: string, enabled: boolean) => {
    setSelectedFiles(prev => ({
      ...prev,
      [fileId]: enabled
    }));
  };

  const onDrop = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      try {
        setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));
        
        console.log('Starting file upload:', file.name);
        const result = await handleAsyncError(
          () => uploadFile(file, notebookId),
          { operation: 'file_upload', fileName: file.name, fileSize: file.size }
        );
        
        console.log('File upload completed:', result);
        toast({
          title: "Upload successful",
          description: `${file.name} has been uploaded and is being processed.`,
        });
      } catch (error) {
        // Error already handled by handleAsyncError
        console.error('File upload failed:', error);
        toast({
          title: "Upload failed",
          description: error.message?.includes('environment') 
            ? "Server configuration issue. Please contact support."
            : error.message || `Failed to upload ${file.name}. Please try again.`,
          variant: "destructive",
        });
      } finally {
        setUploadProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[file.name];
          return newProgress;
        });
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const filteredSources = sources.filter(source =>
    source.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="w-[260px] bg-sidebar-custom border-r h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <ComponentErrorBoundary>
      <div className="w-[260px] bg-sidebar-custom border-r h-full flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-foreground">Sources</h2>
            <NetworkIndicator />
          </div>
          <p className="text-sm text-muted-foreground">Select PDF documents to use as context.</p>
        </div>
        
        <div className="p-4 border-b space-y-4">
          {/* Dropzone for PDF upload */}
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-sm text-muted-foreground">Drop PDFs here...</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Drag & drop PDFs here or click to browse
              </p>
            )}
          </div>
          
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        
        <div className="flex-1 p-4 space-y-3 overflow-auto">
          {filteredSources.map((source) => (
            <div key={source.id} className="flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
              <Checkbox
                checked={selectedFiles[source.id] || false}
                onCheckedChange={(checked) => handleFileToggle(source.id, !!checked)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-tight mb-1">
                  {source.display_name}
                </p>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {formatFileSize(source.file_size)}
                  </Badge>
                  <Badge variant={source.processing_status === 'completed' ? 'default' : 'outline'} className="text-xs">
                    {source.processing_status}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
          {filteredSources.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {searchTerm ? "No documents match your search." : "No documents uploaded yet."}
            </p>
          )}
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};