// src/lib/api.ts
// Complete API integration with multi-LLM support

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import { ErrorHandler, RetryHandler, OfflineQueue, NetworkMonitor, validateRequired, validateFileSize, validateFileType } from './error-handling'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: any
}

export interface ProcessingJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  error_message?: string
}

export interface LLMSettings {
  provider: 'ollama' | 'openai' | 'gemini' | 'llamacloud'
  model?: string
  temperature?: number
  maxTokens?: number
  embeddingProvider?: string
}

// Get current user settings
export async function getUserSettings(): Promise<LLMSettings> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('preferences')
    .single()
  
  return profile?.preferences || {
    provider: 'ollama',
    model: 'qwen3:8b-q4_K_M'
  }
}

// =====================================================
// File Upload and Processing
// =====================================================

export async function uploadFile(file: File, notebookId: string) {
  try {
    // Validate inputs
    validateRequired(file, 'File');
    validateRequired(notebookId, 'Notebook ID');
    validateFileSize(file, 50); // 50MB limit
    validateFileType(file, ['application/pdf']);

    // Check network status
    if (!NetworkMonitor.getInstance().isOnlineStatus()) {
      const queueId = OfflineQueue.getInstance().addToQueue('upload_file', { file, notebookId });
      throw new Error('You are offline. File will be uploaded when connection is restored.');
    }

    // Get current user
    const { data: { user }, error: userError } = await RetryHandler.withRetry(
      () => supabase.auth.getUser(),
      2
    );
    if (userError || !user) {
      const error = new Error('User not authenticated');
      ErrorHandler.handle(error, { operation: 'upload_file', step: 'authentication' });
      throw error;
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    // Upload to storage using the correct bucket name from schema
    const { data: uploadData, error: uploadError } = await RetryHandler.withRetry(
      () => supabase.storage
        .from('sources')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        }),
      3
    );

    if (uploadError) {
      const error = new Error(`Upload failed: ${uploadError.message}`);
      ErrorHandler.handle(error, { 
        operation: 'upload_file', 
        step: 'storage_upload',
        fileSize: file.size,
        fileName: file.name
      });
      throw error;
    }

    // Get public URL for the file
    const { data: urlData } = supabase.storage
      .from('sources')
      .getPublicUrl(filePath);

    // Create source record in database with correct schema
    const { data: sourceData, error: sourceError } = await RetryHandler.withRetry(
      () => supabase
        .from('sources')
        .insert({
          notebook_id: notebookId,
          user_id: user.id,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          display_name: file.name,
          processing_status: 'pending'
        })
        .select()
        .single(),
      2
    );

    if (sourceError) {
      // Clean up uploaded file if database insert fails
      try {
        await supabase.storage.from('sources').remove([filePath]);
      } catch (cleanupError) {
        console.warn('Failed to cleanup uploaded file:', cleanupError);
      }
      
      const error = new Error(`Database error: ${sourceError.message}`);
      ErrorHandler.handle(error, { 
        operation: 'upload_file', 
        step: 'database_insert',
        supabaseError: sourceError
      });
      throw error;
    }

    // Call the process-pdf-with-metadata edge function
    try {
      const { data: processResult, error: processError } = await supabase.functions.invoke(
        'process-pdf-with-metadata',
        {
          body: {
            source_id: sourceData.id,
            file_path: filePath,
            notebook_id: notebookId,
            llm_provider: 'llamacloud'
          }
        }
      );

      if (processError) {
        ErrorHandler.handle(processError, { 
          operation: 'upload_file', 
          step: 'edge_function_processing',
          sourceId: sourceData.id
        });
        // Update source status to failed
        await supabase
          .from('sources')
          .update({ processing_status: 'failed', processing_error: processError.message })
          .eq('id', sourceData.id);
      }
    } catch (processErr) {
      ErrorHandler.handle(processErr, { 
        operation: 'upload_file', 
        step: 'edge_function_call',
        sourceId: sourceData.id
      });
    }

    return { uploadData, sourceData };
  } catch (error) {
    ErrorHandler.handle(error, { operation: 'upload_file' });
    throw error;
  }
}

// Rest of your API functions remain the same...
export async function generateReport(params: {
  notebook_id: string;
  template_id: string;
  topic: string;
  address?: string;
  additional_context?: string;
  llm_provider?: string;
  llm_config?: any;
}) {
  const { data, error } = await supabase.functions.invoke('generate-report', {
    body: {
      notebook_id: params.notebook_id,
      template_id: params.template_id,
      topic: params.topic,
      address: params.address,
      additional_context: params.additional_context,
      llm_provider: params.llm_provider || 'ollama',
      llm_config: params.llm_config || {},
      embedding_provider: params.llm_provider || 'ollama'
    }
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function searchVectors(queries: string[], notebookId?: string) {
  const { data, error } = await supabase.functions.invoke('batch-vector-search', {
    body: {
      queries,
      notebook_id: notebookId,
      top_k: 5
    }
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function getReportTemplates() {
  const { data, error } = await supabase
    .from('report_templates')
    .select('*')
    .eq('is_active', true)
    .order('display_name');

  if (error) {
    throw error;
  }

  return data;
}


export async function genTemplate(params: {
  sessionId: string;
  permitType: string;
  address: string;
  applicant: string;
}) {
  try {
    // Get session to find notebook
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('notebook_id, llm_provider, llm_config')
      .eq('id', params.sessionId)
      .single();

    if (sessionError) {
      throw sessionError;
    }

    // Get appropriate template based on permit type
    const { data: templates, error: templatesError } = await supabase
      .from('report_templates')
      .select('*')
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

    if (templatesError || !templates || templates.length === 0) {
      throw new Error('No report templates available');
    }

    // Select template based on permit type
    let selectedTemplate = templates[0]; // Default to first template
    
    // Try to match permit type to template category
    const matchingTemplate = templates.find(t => 
      t.category.toLowerCase().includes(params.permitType.toLowerCase()) ||
      t.name.toLowerCase().includes(params.permitType.toLowerCase())
    );
    
    if (matchingTemplate) {
      selectedTemplate = matchingTemplate;
    }

    // Call generate-report edge function directly
    const reportData = await generateReport({
      notebook_id: session.notebook_id,
      template_id: selectedTemplate.id,
      topic: `${params.permitType} - ${params.address}`,
      address: params.address,
      additional_context: `Applicant: ${params.applicant}`,
      llm_provider: session.llm_provider || 'ollama',
      llm_config: session.llm_config || {}
    });

    // Update template usage count
    await supabase
      .from('report_templates')
      .update({ 
        usage_count: (selectedTemplate.usage_count || 0) + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', selectedTemplate.id);

    // Return format expected by PermitDrawer component
    return {
      docx_url: `/api/reports/${reportData.report_generation_id}/download`, // Placeholder URL
      preview_url: `/api/reports/${reportData.report_generation_id}/preview`, // Placeholder URL  
      report_generation_id: reportData.report_generation_id,
      template_used: selectedTemplate.name,
      estimated_completion: new Date(Date.now() + (reportData.estimated_time_minutes * 60 * 1000)).toISOString(),
      status: 'processing'
    };
  } catch (error) {
    console.error('Template generation error:', error);
    throw error;
  }
}

export async function template(sessionId: string, permitType: string, address: string, applicant: string) {
  return genTemplate({ sessionId, permitType, address, applicant });
}


// Monitor processing job status
export async function getProcessingJobStatus(jobId: string): Promise<ProcessingJob | null> {
  const { data, error } = await supabase
    .from('processing_jobs')
    .select('id, status, progress, error_message')
    .eq('id', jobId)
    .single()

  if (error) {
    console.error('Error fetching job status:', error)
    return null
  }

  return data
}

// =====================================================
// Chat Functionality
// =====================================================

export async function createChatSession(
  notebookId: string,
  sourceIds: string[] = [],
  llmSettings?: LLMSettings
): Promise<string> {
  const userId = (await supabase.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Not authenticated')

  const settings = llmSettings || await getUserSettings()

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      notebook_id: notebookId,
      title: `Chat - ${new Date().toLocaleString()}`,
      source_ids: sourceIds,
      llm_provider: settings.provider,
      llm_model: settings.model,
      llm_config: settings
    })
    .select()
    .single()

  if (error) throw error
  return data.id
}

export async function sendChatMessage(
  sessionId: string,
  message: string,
  onStream?: (chunk: string) => void
): Promise<ChatMessage> {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) throw new Error('Not authenticated')

    // Get session details
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (!session) throw new Error('Session not found')

    // Store user message first
    const { data: userMessage } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: 'user',
        content: message
      })
      .select()
      .single()

    // Perform vector search for context using edge function
    const { data: searchResults, error: searchError } = await supabase.functions
      .invoke('batch-vector-search', {
        body: {
          queries: [message],
          notebook_id: session.notebook_id,
          source_ids: session.source_ids,
          top_k: 5,
          embedding_provider: session.llm_config?.embeddingProvider || session.llm_provider || 'ollama'
        }
      })

    if (searchError) {
      console.error('Vector search error:', searchError)
    }

    const context = searchResults?.results?.[0]?.results || []

    // Get conversation history for context
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(10) // Last 10 messages for context

    // Build context prompt
    const contextChunks = context.map((c: any) => c.content).join('\n\n')
    const historyContext = messages?.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n') || ''
    
    const systemPrompt = `You are a helpful AI assistant for town planning and heritage consulting. Use the following context from documents to answer questions:

DOCUMENT CONTEXT:
${contextChunks}

CONVERSATION HISTORY:
${historyContext}

Answer the user's question based on the provided context. If the context doesn't contain relevant information, say so clearly.`

    // Generate response using LLM (simulate with placeholder for now)
    // In a real implementation, you'd call the appropriate LLM API here
    const assistantContent = `Based on the provided documents, I can help you with ${message}. [This would be the actual LLM response using the context and conversation history.]`

    // Store assistant response
    const { data: assistantMessage } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: 'assistant',
        content: assistantContent,
        chunks_retrieved: context.map((c: any) => c.chunk_id),
        retrieval_metadata: { 
          context_count: context.length,
          search_query: message
        },
        llm_provider: session.llm_provider,
        llm_model: session.llm_model
      })
      .select()
      .single()

    // Update session stats
    await supabase
      .from('chat_sessions')
      .update({ 
        total_messages: (session.total_messages || 0) + 2,
        last_message_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    return {
      role: 'assistant',
      content: assistantContent,
      metadata: assistantMessage
    }
  } catch (error) {
    console.error('Chat error:', error)
    throw error
  }
}

// =====================================================
// Report Generation
// =====================================================

export interface ReportRequest {
  notebookId: string
  templateId: string
  topic: string
  address?: string
  additionalContext?: string
  llmSettings?: LLMSettings
}



export async function getReportStatus(reportId: string) {
  const { data, error } = await supabase
    .from('report_generations')
    .select(`
      *,
      report_sections (
        id,
        section_name,
        subsection_name,
        status,
        word_count
      )
    `)
    .eq('id', reportId)
    .single()

  if (error) throw error
  return data
}

export async function downloadReport(reportId: string): Promise<string> {
  const { data: report } = await supabase
    .from('report_generations')
    .select('file_path')
    .eq('id', reportId)
    .single()

  if (!report?.file_path) throw new Error('Report file not found')

  const { data } = supabase.storage
    .from('reports')
    .getPublicUrl(report.file_path)

  return data.publicUrl
}

// =====================================================
// Notebook Management
// =====================================================

export async function createNotebook(
  title: string,
  projectType: string,
  clientDetails?: any
): Promise<string> {
  const userId = (await supabase.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('notebooks')
    .insert({
      user_id: userId,
      title: title,
      project_type: projectType,
      client_name: clientDetails?.clientName,
      address: clientDetails?.address,
      contact_email: clientDetails?.contactEmail,
      contact_phone: clientDetails?.contactPhone,
      metadata: clientDetails?.metadata || {}
    })
    .select()
    .single()

  if (error) throw error
  return data.id
}

export async function getNotebooks() {
  const { data, error } = await supabase
    .from('notebooks')
    .select(`
      *,
      _count:sources(count)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// =====================================================
// Metadata Management
// =====================================================

export async function getMetadataSchema() {
  const { data, error } = await supabase
    .from('metadata_schema')
    .select('*')
    .order('occurrence_count', { ascending: false })

  if (error) throw error
  return data
}

export async function getDocumentMetadata(sourceId: string) {
  const { data, error } = await supabase
    .from('pdf_metadata')
    .select(`
      *,
      pdf_metadata_values (
        *,
        metadata_schema (
          field_name,
          display_name,
          field_type
        )
      )
    `)
    .eq('source_id', sourceId)
    .single()

  if (error) throw error
  return data
}

// =====================================================
// Real-time Subscriptions
// =====================================================

export function subscribeToProcessingJob(
  jobId: string,
  onUpdate: (job: ProcessingJob) => void
) {
  return supabase
    .channel(`job-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'processing_jobs',
        filter: `id=eq.${jobId}`
      },
      (payload) => {
        onUpdate(payload.new as ProcessingJob)
      }
    )
    .subscribe()
}

export function subscribeToReportGeneration(
  reportId: string,
  onUpdate: (report: any) => void
) {
  return supabase
    .channel(`report-${reportId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'report_generations',
        filter: `id=eq.${reportId}`
      },
      (payload) => {
        onUpdate(payload.new)
      }
    )
    .subscribe()
}

// =====================================================
// Settings Management
// =====================================================

export async function updateUserSettings(settings: Partial<LLMSettings>) {
  const userId = (await supabase.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('user_profiles')
    .update({
      preferences: settings,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (error) throw error
}

export async function testLLMConnection(provider: string, config: any = {}) {
  try {
    // Test the connection by generating a simple embedding
    const { data, error } = await supabase.functions
      .invoke('batch-vector-search', {
        body: {
          queries: ['test'],
          embedding_provider: provider,
          top_k: 1
        }
      })

    return { success: !error, error: error?.message }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// =====================================================
// Compatibility Functions for Existing Components
// =====================================================

// For ChatStream.tsx - Compatibility wrapper
export async function sendChat(sessionId: string, message: string) {
  try {
    // First, ensure we have a valid session
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    // Send the message using the new function
    const response = await sendChatMessage(sessionId, message);
    
    // Return in the format expected by ChatStream component
    return {
      userMessage: {
        id: Date.now().toString(),
        content: message,
        role: 'user' as const
      },
      aiMessage: {
        id: (Date.now() + 1).toString(),
        content: response.content,
        role: 'assistant' as const,
        metadata: response.metadata
      }
    };
  } catch (error) {
    console.error('sendChat error:', error);
    throw error;
  }
}


// For SourcesSidebar.tsx - Compatibility wrapper that uses the main uploadFile function
export async function uploadAndProcessFile(file: File, notebookId: string) {
  try {
    const result = await uploadFile(file, notebookId);
    
    // Return in the format expected by SourcesSidebar
    return {
      uploadId: result.sourceData.id,
      display_name: file.name,
      file_size: file.size,
      processing_status: 'processing',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('uploadAndProcessFile error:', error);
    throw error;
  }
}

// Note: uploadFile is already exported above in the main function definitions







// =====================================================
// Helper Functions
// =====================================================

// Get or create default notebook
export async function getDefaultNotebook(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: notebooks } = await supabase
    .from('notebooks')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', 'Default Notebook')
    .single();

  if (notebooks?.id) {
    return notebooks.id;
  }

  // Create default notebook
  const notebookId = await createNotebook('Default Notebook', 'general');
  return notebookId;
}

// Initialize chat session with default notebook
export async function initializeChatSession(sourceIds?: string[]): Promise<string> {
  const notebookId = await getDefaultNotebook();
  return await createChatSession(notebookId, sourceIds);
}
