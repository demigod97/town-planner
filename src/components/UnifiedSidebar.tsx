/**
 * 📄 UnifiedSidebar.tsx
 * Part of the HHLM project – town-planning RAG assistant
 * Purpose: Unified left sidebar with tabbed navigation
 * Generated: 2025-01-27
 * ------------------------------------------------------
 * Modern sidebar with Chat History, Sources, and Actions tabs
 */

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  MessageSquare, 
  FileText, 
  Settings, 
  Search, 
  Plus, 
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Upload,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/api';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { ComponentErrorBoundary } from '@/components/ErrorBoundary';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { uploadFile, deleteAllSources } from '@/lib/api';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import type { ChatSession } from '@/types/chat';

interface UnifiedSidebarProps {
  notebookId: string;
  currentSessionId: string | null;
  sessions: ChatSession[];
  onSessionSelect: (sessionId: string) => void;
  onCreateSession: () => void;
  isCreatingSession?: boolean;
}

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

export const UnifiedSidebar = ({
  notebookId,
  currentSessionId,
  sessions,
  onSessionSelect,
  onCreateSession,
  isCreatingSession = false
}: UnifiedSidebarProps) => {
  const [activeTab, setActiveTab] = useState('history');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSources, setSelectedSources] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [userQuery, setUserQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  
  const { handleAsyncError } = useErrorHandler();
  const queryClient = useQueryClient();

  // Load sources for the current notebook
  const { data: sources = [], isLoading: sourcesLoading, error: sourcesError } = useQuery({
    queryKey: ['sources', notebookId],
    queryFn: async (): Promise<Source[]> => {
      return handleAsyncError(async () => {
        const { data, error } = await supabase
          .from('sources')
          .select('*')
          .eq('notebook_id', notebookId)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
      }, { operation: 'fetch_sources', notebookId });
    },
    retry: 3,
    staleTime: 30000
  });

  // File upload handling
  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    setIsUploading(true);
    
    for (const file of acceptedFiles) {
      const fileId = `${Date.now()}-${file.name}`;
      
      // Initialize progress tracking
      setUploadProgress(prev => ({
        ...prev,
        [fileId]: {
          id: fileId,
          fileName: file.name,
          progress: 0,
          status: 'uploading'
        }
      }));

      // Simulate upload progress
      const progressInterval = simulateUploadProgress(fileId);

      try {
        await handleAsyncError(
          () => uploadFile(file, notebookId, userQuery.trim() || undefined),
          { operation: 'file_upload', fileName: file.name, fileSize: file.size }
        );
        
        toast.success(`${file.name} uploaded successfully`);
        setUserQuery('');
        queryClient.invalidateQueries({ queryKey: ['sources', notebookId] });
        
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

  const handleDeleteAllSources = async () => {
    if (!confirm('Delete all documents? This cannot be undone.')) return;

    setIsDeletingAll(true);
    try {
      await handleAsyncError(
        () => deleteAllSources(notebookId),
        { operation: 'delete_all_sources', notebookId }
      );
      
      toast.success('All documents deleted');
      queryClient.invalidateQueries({ queryKey: ['sources', notebookId] });
    } catch (error) {
      toast.error('Failed to delete documents');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSources = sources.filter(source =>
    source.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ComponentErrorBoundary>
      <div className="w-[320px] bg-sidebar border-r h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sidebar-foreground">Workspace</h2>
          <p className="text-sm text-sidebar-foreground/70">
            Manage chats, documents, and actions
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mx-4 mt-4">
            <TabsTrigger value="history" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="sources" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Sources</span>
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Actions</span>
            </TabsTrigger>
          </TabsList>

          {/* Chat History Tab */}
          <TabsContent value="history" className="flex-1 flex flex-col mt-4 mx-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search sessions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={onCreateSession}
                  disabled={isCreatingSession}
                  className="flex items-center gap-2"
                >
                  {isCreatingSession ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {filteredSessions.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {searchTerm ? 'No sessions match your search' : 'No chat sessions yet'}
                      </p>
                      {!searchTerm && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onCreateSession}
                          className="mt-2"
                        >
                          Start First Chat
                        </Button>
                      )}
                    </div>
                  ) : (
                    filteredSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          session.id === currentSessionId
                            ? 'bg-sidebar-accent border-sidebar-accent-foreground/20'
                            : 'hover:bg-sidebar-accent/50'
                        }`}
                        onClick={() => onSessionSelect(session.id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-sm font-medium text-sidebar-foreground truncate flex-1">
                            {session.title}
                          </h4>
                          <Badge variant="secondary" className="text-xs ml-2">
                            {session.total_messages}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(session.updated_at).toLocaleDateString()}</span>
                          {session.llm_provider && (
                            <Badge variant="outline" className="text-xs">
                              {session.llm_provider}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Sources Tab */}
          <TabsContent value="sources" className="flex-1 flex flex-col mt-4 mx-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-sidebar-foreground">Documents</h3>
                {sources.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteAllSources}
                    disabled={isDeletingAll}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* User Query Input */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-sidebar-foreground">
                  What would you like to know? (Optional)
                </label>
                <Textarea
                  placeholder="e.g., What are the setback requirements?"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  className="min-h-[60px] resize-none text-sm"
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
                <p className="text-xs text-muted-foreground">
                  {isUploading ? 'Uploading...' : 
                   isDragActive ? 'Drop PDFs here' : 
                   'Drag PDFs or click to browse'}
                </p>
              </div>

              {/* Upload Progress */}
              {Object.keys(uploadProgress).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-sidebar-foreground">Upload Progress</h4>
                  {Object.entries(uploadProgress).map(([fileId, progress]) => (
                    <div key={fileId} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium truncate max-w-[200px]">
                          {progress.fileName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(progress.progress)}%
                        </span>
                      </div>
                      <Progress value={progress.progress} className="h-1" />
                      {progress.error && (
                        <p className="text-xs text-destructive">{progress.error}</p>
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
                  className="pl-8 text-sm"
                />
              </div>

              {/* Sources List */}
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {sourcesLoading ? (
                    <div className="text-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Loading documents...</p>
                    </div>
                  ) : filteredSources.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        {searchTerm ? 'No documents match search' : 'No documents uploaded'}
                      </p>
                    </div>
                  ) : (
                    filteredSources.map((source) => (
                      <div
                        key={source.id}
                        className="flex items-start gap-2 p-2 rounded border bg-background hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedSources[source.id] || false}
                          onCheckedChange={(checked) => 
                            setSelectedSources(prev => ({ ...prev, [source.id]: !!checked }))
                          }
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {source.display_name}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
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
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="flex-1 flex flex-col mt-4 mx-4">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-sidebar-foreground">Quick Actions</h3>
              
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Permit Template
                </Button>
                
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Settings className="w-4 h-4 mr-2" />
                  LLM Settings
                </Button>
                
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Data
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-sidebar-foreground">Statistics</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="font-medium">{sessions.length}</div>
                    <div className="text-muted-foreground">Sessions</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="font-medium">{sources.length}</div>
                    <div className="text-muted-foreground">Documents</div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ComponentErrorBoundary>
  );
};