import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useDropzone } from "react-dropzone";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { 
  History, 
  MessageSquare, 
  Upload, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  Loader2,
  FileText,
  Calendar,
  User,
  Trash2,
  Settings
} from "lucide-react";
import { supabase, uploadFile, deleteAllSources, genTemplate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { NetworkIndicator } from "@/components/NetworkStatus";
import { FileUploadErrorDisplay, ValidationErrorDisplay, InlineError } from "@/components/ui/error-display";
import { MapPreview } from "./MapPreview";

interface UnifiedSidebarProps {
  sessionId: string;
  notebookId: string;
  onSessionSelect?: (sessionId: string) => void;
  onTemplateCreated?: (id: string) => void;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  total_messages: number;
}

interface Source {
  id: string;
  display_name: string;
  file_size: number;
  file_path?: string;
  processing_status: string;
  created_at: string;
  updated_at: string;
}

interface UploadProgress {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'uploaded' | 'error' | 'transitioning';
  error?: string;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export const UnifiedSidebar = ({ 
  sessionId, 
  notebookId, 
  onSessionSelect,
  onTemplateCreated 
}: UnifiedSidebarProps) => {
  const [activeTab, setActiveTab] = useState("history");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [userQuery, setUserQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string>("");
  const [preview, setPreview] = useState<string>('');
  const [download, setDownload] = useState<string>('');
  
  const { toast } = useToast();
  const { handleAsyncError } = useErrorHandler();
  const queryClient = useQueryClient();

  const { register, handleSubmit, watch, reset } = useForm({
    defaultValues: {
      permitType: "",
      address: "",
      applicant: ""
    }
  });

  const watchedAddress = watch("address");

  // Chat sessions query with real-time updates
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["chat_sessions"],
    queryFn: async (): Promise<ChatSession[]> => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select(`
          id, 
          title, 
          created_at, 
          updated_at,
          total_messages
        `)
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      return (data || []).map((session: any) => ({
        id: session.id,
        title: session.title || 'Untitled Session',
        created_at: session.created_at,
        updated_at: session.updated_at,
        total_messages: session.total_messages || 0
      }));
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Sources query with real-time updates
  const { data: sources = [], isLoading: sourcesLoading } = useQuery({
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
      if (failureCount < 3 && error.message?.includes('fetch')) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Session click handler
  const handleSessionClick = (sessionId: string) => {
    if (onSessionSelect) {
      onSessionSelect(sessionId);
    }
  };

  // File upload handlers
  const simulateUploadProgress = (fileId: string, fileName: string): NodeJS.Timeout => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 12 + 8;
      
      if (progress >= 100) {
        progress = 100;
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: { ...prev[fileId], progress: 100, status: 'completed' }
        }));
        
        setTimeout(() => {
          setUploadProgress(prev => ({
            ...prev,
            [fileId]: { ...prev[fileId], status: 'transitioning' }
          }));
          
          setTimeout(() => {
            setUploadProgress(prev => ({
              ...prev,
              [fileId]: { ...prev[fileId], status: 'uploaded' }
            }));
            
            setTimeout(() => {
              setUploadProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[fileId];
                return newProgress;
              });
            }, 3000);
          }, 1500);
        }, 2000);
        
        clearInterval(interval);
      } else {
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: { ...prev[fileId], progress, status: 'uploading' }
        }));
      }
    }, 150);

    return interval;
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    setUploadError("");
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

      const progressInterval = simulateUploadProgress(fileId, file.name);

      try {
        const result = await handleAsyncError(
          () => uploadFile(file, notebookId, userQuery.trim() || undefined),
          { operation: 'file_upload', fileName: file.name, fileSize: file.size }
        );
        
        toast({
          title: "Upload successful",
          description: `${file.name} has been uploaded and sent for processing.`,
        });
        
        setUserQuery("");
        queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
        
      } catch (error) {
        console.error('File upload failed:', error);
        clearInterval(progressInterval);
        
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: {
            ...prev[fileId],
            status: 'error',
            error: error.message || 'Upload failed'
          }
        }));
        
        setUploadError(error.message || 'Upload failed');
      }
    }
    
    setIsUploading(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  // Template form submission
  const onSubmit = async (data: any) => {
    setFormErrors({});
    setSubmitError("");
    
    try {
      const errors: Record<string, string> = {};
      
      if (!data.permitType) errors.permitType = 'Please select a permit type';
      if (!data.address?.trim()) errors.address = 'Property address is required';
      if (!data.applicant?.trim()) errors.applicant = 'Applicant name is required';
      
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }
    } catch (error) {
      setSubmitError(error.message || "Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await handleAsyncError(
        () => genTemplate({
          ...data,
          sessionId: sessionId || ""
        }),
        { operation: 'generate_template', permitType: data.permitType }
      );
      
      setPreview(result.preview_url);
      setDownload(result.docx_url);
      
      toast({
        title: "Template ready",
        description: "Your permit template has been generated.",
      });
      
      if (onTemplateCreated) {
        onTemplateCreated(result.docx_url);
      }
      
      reset();
    } catch (error) {
      setSubmitError(error.message || "Failed to generate template. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearAllSources = async () => {
    if (!confirm('Are you sure you want to delete all documents? This action cannot be undone.')) {
      return;
    }

    setIsDeletingAll(true);
    
    try {
      await handleAsyncError(
        () => deleteAllSources(notebookId),
        { operation: 'delete_all_sources', notebookId }
      );
      
      toast({
        title: "All documents deleted",
        description: "All documents have been successfully removed.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleFileToggle = async (fileId: string, enabled: boolean) => {
    setSelectedFiles(prev => ({
      ...prev,
      [fileId]: enabled
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'uploaded':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'transitioning':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 w-4 text-red-500" />;
      default:
        return <Upload className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string, progress: number) => {
    switch (status) {
      case 'uploading':
        return `Uploading... ${Math.round(progress)}%`;
      case 'completed':
        return 'Upload Complete!';
      case 'transitioning':
        return 'Processing...';
      case 'uploaded':
        return 'Successfully Uploaded';
      case 'error':
        return 'Upload Failed';
      default:
        return 'Preparing...';
    }
  };

  const retryUpload = (fileId: string) => {
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
    setUploadError("");
  };

  const filteredSources = sources.filter(source =>
    source.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ComponentErrorBoundary>
      <div className="w-[320px] bg-sidebar-custom border-r h-full flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-foreground">Assistant</h2>
            <NetworkIndicator />
          </div>
          <p className="text-sm text-muted-foreground">Chat, upload documents, and generate reports.</p>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 mx-4 mt-4">
              <TabsTrigger value="history" className="text-xs">
                <History className="h-4 w-4 mr-1" />
                History
              </TabsTrigger>
              <TabsTrigger value="sources" className="text-xs">
                <FileText className="h-4 w-4 mr-1" />
                Sources
              </TabsTrigger>
              <TabsTrigger value="actions" className="text-xs">
                <Settings className="h-4 w-4 mr-1" />
                Actions
              </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-hidden">
              {/* Chat History Tab */}
              <TabsContent value="history" className="h-full m-0 p-4 space-y-4">
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search conversations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <ScrollArea className="flex-1 h-[calc(100vh-200px)]">
                  {sessionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                        <p className="text-sm text-muted-foreground">Loading conversations...</p>
                      </div>
                    </div>
                  ) : filteredSessions.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {searchTerm ? "No conversations match your search" : "No chat history"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredSessions.map((session) => (
                        <div
                          key={session.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                            session.id === sessionId ? 'bg-muted border-primary' : 'bg-background'
                          }`}
                          onClick={() => handleSessionClick(session.id)}
                        >
                          <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{session.title}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{new Date(session.updated_at).toLocaleDateString()}</span>
                              {session.total_messages > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {session.total_messages} msgs
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Sources Tab */}
              <TabsContent value="sources" className="h-full m-0 p-4 space-y-4">
                <div className="space-y-4">
                  {/* Upload Error Display */}
                  {uploadError && (
                    <FileUploadErrorDisplay
                      error={uploadError}
                      retry={() => setUploadError("")}
                    />
                  )}
                  
                  {/* User Query Input */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">
                      What would you like to know? (Optional)
                    </Label>
                    <Textarea
                      placeholder="e.g., What are the setback requirements?"
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      className="min-h-[80px] resize-none"
                      disabled={isUploading}
                    />
                  </div>
                  
                  {/* Dropzone */}
                  <div 
                    {...getRootProps()} 
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                      isDragActive ? 'border-primary bg-primary/5' : 
                      isUploading ? 'border-muted-foreground/25 bg-muted/20 cursor-not-allowed' :
                      'border-muted-foreground/25 hover:border-primary/50'
                    }`}
                    data-testid="dropzone"
                  >
                    <input {...getInputProps()} disabled={isUploading} />
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    {isUploading ? (
                      <p className="text-sm text-muted-foreground">Uploading files...</p>
                    ) : isDragActive ? (
                      <p className="text-sm text-muted-foreground">Drop PDFs here</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Drag & drop PDFs or click to browse
                      </p>
                    )}
                  </div>
                  
                  {/* Upload Progress */}
                  {Object.keys(uploadProgress).length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-foreground">Upload Progress</h3>
                      {Object.entries(uploadProgress).map(([fileId, progress]) => (
                        <div key={fileId} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(progress.status)}
                              <span className="text-sm font-medium truncate max-w-[150px]">
                                {progress.fileName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {(progress.status === 'uploading' || progress.status === 'transitioning') && (
                                <span className="text-xs text-muted-foreground">
                                  {progress.status === 'uploading' ? `${Math.round(progress.progress)}%` : ''}
                                </span>
                              )}
                              {progress.status === 'error' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => retryUpload(fileId)}
                                  className="h-6 w-6 p-0"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-xs font-medium text-center">
                            <span className={`${
                              progress.status === 'completed' ? 'text-green-600' :
                              progress.status === 'uploaded' ? 'text-blue-600' :
                              progress.status === 'error' ? 'text-red-600' :
                              'text-muted-foreground'
                            }`}>
                              {getStatusText(progress.status, progress.progress)}
                            </span>
                          </div>
                          
                          {progress.status === 'uploading' && (
                            <Progress 
                              value={progress.progress} 
                              className="h-2 w-full bg-muted"
                            />
                          )}
                          
                          {progress.status === 'transitioning' && (
                            <div className="w-full bg-muted rounded-full h-2">
                              <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '100%' }} />
                            </div>
                          )}
                          
                          {progress.status === 'error' && progress.error && (
                            <div className="text-xs text-red-600">
                              {progress.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Search Sources */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search documents"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                
                <ScrollArea className="flex-1 h-[calc(100vh-400px)]">
                  <div className="space-y-3">
                    {sourcesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                          <p className="text-sm text-muted-foreground">Loading documents...</p>
                        </div>
                      </div>
                    ) : filteredSources.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {searchTerm ? "No documents match your search" : "No documents uploaded yet"}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Documents ({filteredSources.length})</span>
                          {filteredSources.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleClearAllSources}
                              disabled={isDeletingAll}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        
                        {filteredSources.map((source) => (
                          <div key={source.id} className="flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors" data-testid="uploaded-file">
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
                      </>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Actions Tab */}
              <TabsContent value="actions" className="h-full m-0 p-4">
                <ScrollArea className="h-full">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-foreground mb-3">
                        Permit Template Generator
                      </h3>
                      
                      {/* Form Errors */}
                      {Object.keys(formErrors).length > 0 && (
                        <div className="mb-4">
                          <ValidationErrorDisplay errors={formErrors} />
                        </div>
                      )}
                      
                      {/* Submit Error */}
                      {submitError && (
                        <div className="mb-4">
                          <InlineError 
                            message={submitError} 
                            retry={() => setSubmitError("")}
                          />
                        </div>
                      )}
                      
                      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="permitType">Permit Type</Label>
                          <Select {...register("permitType")}>
                            <SelectTrigger className="bg-background" data-testid="permit-type-select">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              <SelectItem value="building">Building Permit</SelectItem>
                              <SelectItem value="zoning">Zoning Variance</SelectItem>
                              <SelectItem value="subdivision">Subdivision</SelectItem>
                              <SelectItem value="site-plan">Site Plan Review</SelectItem>
                              <SelectItem value="special-use">Special Use Permit</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="address">Property Address</Label>
                          <Input
                            id="address"
                            {...register("address")}
                            placeholder="Enter property address"
                            className="bg-background"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="applicant">Applicant Name</Label>
                          <Input
                            id="applicant"
                            {...register("applicant")}
                            placeholder="Enter applicant name"
                            className="bg-background"
                          />
                        </div>

                        <MapPreview address={watchedAddress} />

                        <Button 
                          type="submit" 
                          className="w-full"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? "Generating..." : "Generate Template"}
                        </Button>
                        
                        {download && (
                          <Button 
                            variant="outline" 
                            className="w-full mt-2"
                            onClick={() => window.open(download, '_blank')}
                          >
                            Download Template
                          </Button>
                        )}
                        
                        {preview && (
                          <Button 
                            variant="ghost" 
                            className="w-full mt-1"
                            onClick={() => window.open(preview, '_blank')}
                            data-testid="template-preview"
                          >
                            Preview Template
                          </Button>
                        )}
                      </form>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};