
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Upload, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { useDropzone } from "react-dropzone";

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

  const { data: sources = [], isLoading, refetch } = useQuery({
    queryKey: ["sources", notebookId],
    queryFn: async (): Promise<Source[]> => {
      const { data, error } = await supabase
        .from("sources")
        .select("*")
        .eq("notebook_id", notebookId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Set up real-time subscription for source updates
  useEffect(() => {
    if (!notebookId) return;

    console.log('Setting up real-time subscription for sources in notebook:', notebookId);

    const channel = supabase
      .channel(`sources_${notebookId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sources',
          filter: `notebook_id=eq.${notebookId}`
        },
        (payload) => {
          console.log('Source updated via real-time:', payload);
          // Refetch sources to update the UI
          refetch();
          
          // Show toast for processing status changes
          if (payload.eventType === 'UPDATE' && payload.new.processing_status !== payload.old?.processing_status) {
            const status = payload.new.processing_status;
            if (status === 'completed') {
              toast({
                title: "Processing completed",
                description: `${payload.new.display_name} has been processed successfully.`,
              });
            } else if (status === 'failed') {
              toast({
                title: "Processing failed",
                description: `Failed to process ${payload.new.display_name}.`,
                variant: "destructive",
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up sources real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [notebookId, refetch, toast]);

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
        
        const result = await uploadFile(file, notebookId);
        
        toast({
          title: "Upload successful",
          description: `${file.name} has been uploaded and n8n is processing it.`,
        });

        // Trigger refetch to show the new source immediately
        refetch();
        
      } catch (error) {
        console.error('Upload failed:', error);
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}. Please try again.`,
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
        <p className="text-muted-foreground">Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="w-[260px] bg-sidebar-custom border-r h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-medium text-foreground mb-1">Sources</h2>
        <p className="text-sm text-muted-foreground">Upload PDFs and n8n will process them automatically.</p>
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
                <Badge 
                  variant={
                    source.processing_status === 'completed' ? 'default' : 
                    source.processing_status === 'failed' ? 'destructive' :
                    source.processing_status === 'processing' ? 'secondary' : 'outline'
                  } 
                  className="text-xs"
                >
                  {source.processing_status === 'processing' && '⏳ '}
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
  );
};
