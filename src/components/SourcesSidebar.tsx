import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Upload, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/lib/api";
import { useDropzone } from "react-dropzone";
import { toast } from "@/hooks/use-toast";

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
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<Upload[]>([]);

  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ["hh_uploads"],
    queryFn: async (): Promise<Upload[]> => {
      // Temporary mock data until hh_uploads table is created
      return [
        {
          id: "1",
          filename: "planning_regulations.pdf",
          file_size: 2048576,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "2", 
          filename: "zoning_guidelines.pdf",
          file_size: 1536000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ];
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

      setSelectedFiles(prev => {
        const newSet = new Set(prev);
        if (enabled) {
          newSet.add(fileId);
        } else {
          newSet.delete(fileId);
        }
        return newSet;
      });
    } catch (error) {
      console.error("Failed to update file selection:", error);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      try {
        const result = await uploadFile(file);
        toast({
          title: "Uploaded",
          description: `${file.name} uploaded successfully`,
        });
        
        // Optimistically add to sources list
        const newUpload: Upload = {
          id: result.id,
          filename: result.fileName,
          file_size: file.size,
          file_path: '',
          user_id: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setSources(prev => [newUpload, ...prev]);
      } catch (error) {
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
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
              checked={selectedFiles.has(upload.id)}
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