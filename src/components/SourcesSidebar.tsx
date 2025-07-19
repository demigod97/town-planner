import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface Document {
  id: string;
  name: string;
  size: string;
  checked: boolean;
  file_size?: number;
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

  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ["hh_uploads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hh_uploads")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
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

  const filteredUploads = uploads.filter(upload =>
    upload.filename?.toLowerCase().includes(searchTerm.toLowerCase())
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
      
      <div className="p-4 border-b">
        <Input
          placeholder="Search documents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-3"
        />
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
                {upload.filename || "Untitled Document"}
              </p>
              <Badge variant="secondary" className="text-xs">
                {upload.file_size ? formatFileSize(upload.file_size) : "Unknown size"}
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