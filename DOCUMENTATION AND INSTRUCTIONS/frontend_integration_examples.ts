// =====================================================
// Frontend Integration Examples - Complete Implementation
// =====================================================

// =====================================================
// 1. Enhanced PDF Upload Component with Metadata Display
// File: components/EnhancedPDFUpload.tsx
// =====================================================

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { createClient } from '@supabase/supabase-js';
import { Upload, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  metadata?: {
    prepared_for?: string;
    prepared_by?: string;
    address?: string;
    report_issued_date?: string;
    document_title?: string;
    document_type?: string;
  };
  error?: string;
}

interface EnhancedPDFUploadProps {
  notebookId: string;
  onUploadComplete?: (files: UploadedFile[]) => void;
}

export function EnhancedPDFUpload({ notebookId, onUploadComplete }: EnhancedPDFUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      id: `${Date.now()}-${file.name}`,
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0
    }));
    
    setUploadedFiles(prev => [...prev, ...newFiles]);

    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      const fileRecord = newFiles[i];
      
      try {
        // 1. Upload file to Supabase storage
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `${notebookId}/${fileName}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('sources')
          .upload(filePath, file, {
            onUploadProgress: (progress) => {
              const percentage = (progress.loaded / progress.total) * 100;
              setUploadedFiles(prev => 
                prev.map(f => 
                  f.id === fileRecord.id 
                    ? { ...f, progress: Math.min(percentage, 90) }
                    : f
                )
              );
            }
          });

        if (uploadError) throw uploadError;

        // 2. Create source record
        const { data: sourceData, error: sourceError } = await supabase
          .from('sources')
          .insert({
            notebook_id: notebookId,
            display_name: file.name,
            file_path: filePath,
            file_size: file.size,
            document_type: 'pdf',
            processing_status: 'pending'
          })
          .select()
          .single();

        if (sourceError) throw sourceError;

        // 3. Update file status to processing
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === fileRecord.id 
              ? { ...f, status: 'processing', progress: 95 }
              : f
          )
        );

        // 4. Trigger processing via edge function
        const { data: processData, error: processError } = await supabase.functions
          .invoke('process-pdf-with-metadata', {
            body: {
              source_id: sourceData.id,
              file_path: filePath,
              notebook_id: notebookId
            }
          });

        if (processError) throw processError;

        // 5. Start polling for completion
        pollForCompletion(sourceData.id, fileRecord.id);

      } catch (error) {
        console.error('Upload error:', error);
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === fileRecord.id 
              ? { ...f, status: 'failed', error: (error as Error).message }
              : f
          )
        );
      }
    }
    
    setIsUploading(false);
  }, [notebookId]);

  const pollForCompletion = async (sourceId: string, fileId: string) => {
    const maxAttempts = 30; // 5 minutes with 10-second intervals
    let attempts = 0;

    const poll = async () => {
      try {
        const { data: sourceData, error } = await supabase
          .from('sources')
          .select(`
            *,
            pdf_metadata (*)
          `)
          .eq('id', sourceId)
          .single();

        if (error) throw error;

        if (sourceData.processing_status === 'completed') {
          setUploadedFiles(prev => 
            prev.map(f => 
              f.id === fileId 
                ? { 
                    ...f, 
                    status: 'completed', 
                    progress: 100,
                    metadata: sourceData.pdf_metadata?.[0] || undefined
                  }
                : f
            )
          );
          return;
        }
        
        if (sourceData.processing_status === 'failed') {
          setUploadedFiles(prev => 
            prev.map(f => 
              f.id === fileId 
                ? { 
                    ...f, 
                    status: 'failed',
                    error: sourceData.error_message || 'Processing failed'
                  }
                : f
            )
          );
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000); // Poll every 10 seconds
        } else {
          throw new Error('Processing timeout');
        }
      } catch (error) {
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'failed', error: (error as Error).message }
              : f
          )
        );
      }
    };

    poll();
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true,
    disabled: isUploading
  });

  useEffect(() => {
    if (onUploadComplete) {
      const completedFiles = uploadedFiles.filter(f => f.status === 'completed');
      if (completedFiles.length > 0) {
        onUploadComplete(completedFiles);
      }
    }
  }, [uploadedFiles, onUploadComplete]);

  return (
    <div className="space-y-6">
      {/* Upload Dropzone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        {isDragActive ? (
          <p className="text-lg text-blue-600">Drop the PDF files here...</p>
        ) : (
          <div>
            <p className="text-lg text-gray-600 mb-2">
              Drag & drop PDF files here, or click to select
            </p>
            <p className="text-sm text-gray-500">
              Supports multiple files. Each file will be processed for metadata extraction.
            </p>
          </div>
        )}
      </div>

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Uploaded Files</h3>
          {uploadedFiles.map((file) => (
            <FileCard key={file.id} file={file} />
          ))}
        </div>
      )}
    </div>
  );
}

// File Card Component
function FileCard({ file }: { file: UploadedFile }) {
  const getStatusIcon = () => {
    switch (file.status) {
      case 'uploading':
      case 'processing':
        return <Loader className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (file.status) {
      case 'uploading':
        return `Uploading... ${Math.round(file.progress)}%`;
      case 'processing':
        return 'Processing and extracting metadata...';
      case 'completed':
        return 'Processing completed';
      case 'failed':
        return `Failed: ${file.error}`;
      default:
        return 'Unknown status';
    }
  };

  return (
    <div className="bg-white border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <p className="font-medium text-gray-900">{file.name}</p>
            <p className="text-sm text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
        <span className="text-sm text-gray-600">{getStatusText()}</span>
      </div>

      {/* Progress Bar */}
      {(file.status === 'uploading' || file.status === 'processing') && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${file.progress}%` }}
          ></div>
        </div>
      )}

      {/* Extracted Metadata */}
      {file.status === 'completed' && file.metadata && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Extracted Metadata</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {file.metadata.document_title && (
              <div>
                <span className="font-medium">Title:</span> {file.metadata.document_title}
              </div>
            )}
            {file.metadata.document_type && (
              <div>
                <span className="font-medium">Type:</span> {file.metadata.document_type}
              </div>
            )}
            {file.metadata.prepared_for && (
              <div>
                <span className="font-medium">Prepared for:</span> {file.metadata.prepared_for}
              </div>
            )}
            {file.metadata.prepared_by && (
              <div>
                <span className="font-medium">Prepared by:</span> {file.metadata.prepared_by}
              </div>
            )}
            {file.metadata.address && (
              <div>
                <span className="font-medium">Address:</span> {file.metadata.address}
              </div>
            )}
            {file.metadata.report_issued_date && (
              <div>
                <span className="font-medium">Date:</span> {file.metadata.report_issued_date}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// 2. Report Generation Component
// File: components/ReportGenerator.tsx
// =====================================================

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { FileText, Download, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ReportTemplate {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  structure: {
    sections: Array<{
      name: string;
      title: string;
      order: number;
      subsections?: Array<{
        name: string;
        title: string;
      }>;
    }>;
  };
}

interface ReportGeneration {
  id: string;
  topic: string;
  address?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  file_path?: string;
  created_at: string;
  completed_at?: string;
  template: ReportTemplate;
}

export function ReportGenerator({ notebookId }: { notebookId: string }) {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [address, setAddress] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [recentReports, setRecentReports] = useState<ReportGeneration[]>([]);

  // Load report templates
  useEffect(() => {
    loadTemplates();
    loadRecentReports();
  }, [notebookId]);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .eq('is_active', true)
        .order('display_name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadRecentReports = async () => {
    try {
      const { data, error } = await supabase
        .from('report_generations')
        .select(`
          *,
          report_templates (*)
        `)
        .eq('notebook_id', notebookId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentReports(data || []);
    } catch (error) {
      console.error('Error loading recent reports:', error);
    }
  };

  const generateReport = async () => {
    if (!selectedTemplate || !topic.trim()) {
      alert('Please select a template and enter a topic');
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: {
          notebook_id: notebookId,
          template_id: selectedTemplate,
          topic: topic.trim(),
          address: address.trim() || null,
          additional_context: additionalContext.trim() || null
        }
      });

      if (error) throw error;

      // Start polling for updates
      if (data.report_generation_id) {
        pollReportStatus(data.report_generation_id);
      }

      // Reset form
      setTopic('');
      setAddress('');
      setAdditionalContext('');
      setSelectedTemplate('');

      // Reload recent reports
      loadRecentReports();

    } catch (error) {
      console.error('Error generating report:', error);
      alert(`Error generating report: ${(error as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const pollReportStatus = async (reportId: string) => {
    const maxAttempts = 60; // 10 minutes with 10-second intervals
    let attempts = 0;

    const poll = async () => {
      try {
        const { data, error } = await supabase
          .from('report_generations')
          .select(`
            *,
            report_templates (*)
          `)
          .eq('id', reportId)
          .single();

        if (error) throw error;

        // Update recent reports list
        setRecentReports(prev => 
          prev.map(report => 
            report.id === reportId ? data : report
          )
        );

        if (data.status === 'completed' || data.status === 'failed') {
          return; // Stop polling
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000); // Poll every 10 seconds
        }
      } catch (error) {
        console.error('Error polling report status:', error);
      }
    };

    poll();
  };

  const downloadReport = async (reportId: string, filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('reports')
        .download(filePath);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${reportId}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Error downloading report');
    }
  };

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);

  return (
    <div className="space-y-8">
      {/* Report Generation Form */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-6">Generate Town Planning Report</h2>
        
        <div className="space-y-4">
          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Report Type</label>
            <select 
              value={selectedTemplate} 
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select report type...</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.display_name}
                </option>
              ))}
            </select>
            {selectedTemplateData && (
              <p className="text-sm text-gray-600 mt-1">
                {selectedTemplateData.description}
              </p>
            )}
          </div>

          {/* Topic */}
          <div>
            <label className="block text-sm font-medium mb-2">Topic *</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Residential Extension, Commercial Development"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium mb-2">Address (Optional)</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., 123 Main Street, Sydney NSW"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Additional Context */}
          <div>
            <label className="block text-sm font-medium mb-2">Additional Context (Optional)</label>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Any additional information or specific requirements for the report..."
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Template Structure Preview */}
          {selectedTemplateData && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Report Structure Preview</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {selectedTemplateData.structure.sections.map((section, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">{index + 1}.</span>
                    <div>
                      <span className="font-medium">{section.title}</span>
                      {section.subsections && section.subsections.length > 0 && (
                        <ul className="ml-4 mt-1 space-y-1">
                          {section.subsections.map((subsection, subIndex) => (
                            <li key={subIndex} className="text-gray-500">
                              {index + 1}.{subIndex + 1} {subsection.title}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={generateReport}
            disabled={!selectedTemplate || !topic.trim() || isGenerating}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isGenerating ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>

      {/* Recent Reports */}
      {recentReports.length > 0 && (
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Reports</h3>
          <div className="space-y-3">
            {recentReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onDownload={() => report.file_path && downloadReport(report.id, report.file_path)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Report Card Component
function ReportCard({ 
  report, 
  onDownload 
}: { 
  report: ReportGeneration;
  onDownload: () => void;
}) {
  const getStatusIcon = () => {
    switch (report.status) {
      case 'pending':
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (report.status) {
      case 'pending':
        return 'Queued for processing';
      case 'processing':
        return `Processing... ${report.progress}%`;
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown status';
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <p className="font-medium text-gray-900">{report.topic}</p>
            <p className="text-sm text-gray-500">
              {report.template?.display_name || 'Unknown Template'}
              {report.address && ` • ${report.address}`}
            </p>
            <p className="text-xs text-gray-400">
              Created: {new Date(report.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">{getStatusText()}</span>
          {report.status === 'completed' && report.file_path && (
            <button
              onClick={onDownload}
              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center"
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {report.status === 'processing' && (
        <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${report.progress}%` }}
          ></div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// 3. Enhanced Chat Component with Report Integration
// File: components/EnhancedChat.tsx
// =====================================================

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Send, FileText, Bot, User } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ChatMessage {
  id: string;
  message_type: 'human' | 'ai' | 'system';
  content: string;
  sources_used?: string[];
  chunks_used?: string[];
  citations?: Array<{
    chunk_index: number;
    chunk_source_id: string;
    chunk_lines_from: number;
    chunk_lines_to: number;
  }>;
  created_at: string;
}

interface ChatSession {
  id: string;
  session_name?: string;
  context_type: string;
  active_report_id?: string;
}

export function EnhancedChat({ notebookId }: { notebookId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeSession();
  }, [notebookId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeSession = async () => {
    try {
      // Create new chat session
      const { data: session, error } = await supabase
        .from('chat_sessions')
        .insert({
          notebook_id: notebookId,
          session_name: `Chat ${new Date().toLocaleString()}`,
          context_type: 'general'
        })
        .select()
        .single();

      if (error) throw error;
      setSessionId(session.id);
      
      // Load existing messages if any
      loadMessages(session.id);
    } catch (error) {
      console.error('Error initializing session:', error);
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at');

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading || !sessionId) return;

    const userMessage = currentMessage.trim();
    setCurrentMessage('');
    setIsLoading(true);

    try {
      // Add user message to UI immediately
      const userMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        message_type: 'human',
        content: userMessage,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMsg]);

      // Check if this is a report generation request
      const isReportRequest = userMessage.toLowerCase().includes('generate report') ||
                             userMessage.toLowerCase().includes('create report');

      if (isReportRequest) {
        // Handle report generation request
        const aiResponse: ChatMessage = {
          id: `ai-${Date.now()}`,
          message_type: 'ai',
          content: "I can help you generate a town planning report! Please use the Report Generator tool to specify the report type, topic, and other details. You can access it from the main dashboard.",
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiResponse]);
        
        // Save messages to database
        await Promise.all([
          supabase.from('chat_messages').insert({
            session_id: sessionId,
            message_type: 'human',
            content: userMessage
          }),
          supabase.from('chat_messages').insert({
            session_id: sessionId,
            message_type: 'ai',
            content: aiResponse.content
          })
        ]);
      } else {
        // Regular chat - send to existing chat endpoint
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage,
            session_id: sessionId,
            notebook_id: notebookId
          })
        });

        if (!response.ok) throw new Error('Chat request failed');

        const data = await response.json();
        
        if (data.success && data.response) {
          // Parse the response if it's structured
          let responseContent = data.response;
          let citations = [];
          
          if (typeof responseContent === 'string') {
            try {
              const parsed = JSON.parse(responseContent);
              if (parsed.output && Array.isArray(parsed.output)) {
                responseContent = parsed.output.map((item: any) => item.text).join('\n\n');
                citations = parsed.output.flatMap((item: any) => item.citations || []);
              }
            } catch (e) {
              // If parsing fails, use the raw response
            }
          }

          const aiResponse: ChatMessage = {
            id: `ai-${Date.now()}`,
            message_type: 'ai',
            content: responseContent,
            citations: citations,
            created_at: new Date().toISOString()
          };
          
          setMessages(prev => [...prev, aiResponse]);

          // Save messages to database
          await Promise.all([
            supabase.from('chat_messages').insert({
              session_id: sessionId,
              message_type: 'human',
              content: userMessage
            }),
            supabase.from('chat_messages').insert({
              session_id: sessionId,
              message_type: 'ai',
              content: responseContent,
              citations: citations
            })
          ]);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        message_type: 'ai',
        content: 'Sorry, I encountered an error while processing your message. Please try again.',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border rounded-lg">
      {/* Chat Header */}
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold">AI Assistant</h3>
        <p className="text-sm text-gray-600">
          Ask questions about your documents or request report generation
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex items-center space-x-2 text-gray-500">
            <Bot className="h-5 w-5" />
            <span>AI is thinking...</span>
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <textarea
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question or type 'generate report' to create a planning report..."
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
          />
          <button
            onClick={sendMessage}
            disabled={!currentMessage.trim() || isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.message_type === 'human';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-3xl ${isUser ? 'order-2' : 'order-1'}`}>
        <div className="flex items-center space-x-2 mb-1">
          {isUser ? (
            <User className="h-4 w-4 text-gray-600" />
          ) : (
            <Bot className="h-4 w-4 text-blue-600" />
          )}
          <span className="text-xs text-gray-500">
            {new Date(message.created_at).toLocaleTimeString()}
          </span>
        </div>
        
        <div
          className={`
            px-4 py-2 rounded-lg
            ${isUser 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-900'
            }
          `}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
          
          {/* Citations */}
          {message.citations && message.citations.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-300">
              <p className="text-xs font-medium mb-1">Sources:</p>
              <div className="space-y-1">
                {message.citations.map((citation, index) => (
                  <div key={index} className="text-xs text-gray-600">
                    [{citation.chunk_index}] Lines {citation.chunk_lines_from}-{citation.chunk_lines_to}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// 4. API Route for Chat Integration
// File: pages/api/chat.ts
// =====================================================

import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, session_id, notebook_id } = req.body;

    if (!message || !session_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Forward to your n8n webhook endpoint
    const n8nResponse = await fetch(`${process.env.N8N_WEBHOOK_BASE_URL}/webhook/enhanced-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.N8N_API_KEY}`,
      },
      body: JSON.stringify({
        message,
        session_id,
        notebook_id
      })
    });

    if (!n8nResponse.ok) {
      throw new Error(`n8n request failed: ${n8nResponse.status}`);
    }

    const data = await n8nResponse.json();
    
    res.status(200).json({
      success: true,
      response: data.output?.content || data.message || 'No response generated'
    });

  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}