import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Upload, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile, ingestPDF } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getSettings } from "@/hooks/useSettings";
import { Progress } from "@/components/ui/progress";
import { useDropzone } from "react-dropzone";

interface Upload {
  id: string;
  filename: string;
  file_size: number;
  file_path?: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

interface SourcesSidebarProps {
  sessionId: string;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export const SourcesSidebar = ({ sessionId }: SourcesSidebarProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Record<string, boolean>>({});
  const [sources, setSources] = useState<Upload[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ["hh_uploads"],
    queryFn: async (): Promise<Upload[]> => {
      const { data, error } = await supabase
        .from("hh_uploads")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const handleFileToggle = async (fileId: string, enabled: boolean) => {
    try {
      await fetch("/api/chat/sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          fileId,
          enabled,
        }),
      });

      setSelectedFiles(prev => ({
        ...prev,
        [fileId]: enabled
      }));
    } catch (error) {
      console.error("Failed to update file selection:", error);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      try {
        setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));
        
        const result = await uploadFile(file, (progress) => {
          setUploadProgress((prev) => ({ ...prev, [file.name]: progress }));
        });

        if (result && typeof result === 'object' && 'id' in result) {
          // Update sources list optimistically
          const newUpload: Upload = {
            id: (result as any).id,
            filename: (result as any).fileName || file.name,
            file_size: file.size,
            file_path: (result as any).filePath || '',
            user_id: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          setSources((prev) => [newUpload, ...prev]);
          setSelectedFiles((prev) => ({ ...prev, [(result as any).id]: true }));
          
          // Build file URL and trigger n8n ingestion
          const { supabaseUrl } = getSettings();
          const bucket = 'hh_pdf_library';
          const filePath = (result as any).filePath || '';
          const file_url = `${supabaseUrl}/storage/v1/object/public/${bucket}/${filePath}`;
          
          // Trigger n8n PDF ingestion
          try {
            await ingestPDF({
              source_id: (result as any).id,
              file_url,
              file_path: filePath
            });
          } catch (ingestError) {
            console.error('PDF ingestion failed:', ingestError);
          }
          
          toast({
            title: "Upload successful",
            description: `${file.name} has been uploaded and is being processed.`,
          });
        }
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

  const filteredUploads = uploads.filter(upload =>
    upload.filename.toLowerCase().includes(searchTerm.toLowerCase())
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
        {filteredUploads.map((upload) => (
          <div key={upload.id} className="flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
            <Checkbox
              checked={selectedFiles[upload.id] || false}
              onCheckedChange={(checked) => handleFileToggle(upload.id, !!checked)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-tight mb-1">
                {upload.filename}
              </p>
              <Badge variant="secondary" className="text-xs">
                {formatFileSize(upload.file_size)}
              </Badge>
            </div>
          </div>
        ))}
        {filteredUploads.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {searchTerm ? "No documents match your search." : "No documents uploaded yet."}
          </p>
        )}
      </div>
    </div>
  );
};