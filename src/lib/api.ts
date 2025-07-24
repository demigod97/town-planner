import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import { 
  uploadFileWithErrorHandling,
  sendChatWithErrorHandling,
  updateUserSettingsWithErrorHandling,
  createNotebookWithErrorHandling,
  fetchWithErrorHandling
} from './api-with-error-handling'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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

export async function uploadFile(file: File, notebookId: string, userQuery?: string) {
  return await uploadFileWithErrorHandling(file, notebookId, userQuery)
}

async function uploadAndProcessFile(
  file: File,
  notebookId: string,
  userQuery?: string
): Promise<{ uploadId: string; jobId: string }> {
  try {
    // 1. Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Not authenticated')

    // 2. Sanitize file name to remove special characters
    const sanitizedFileName = file.name.replace(/[\[\]]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileName = `${user.id}/${Date.now()}-${sanitizedFileName}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('sources')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    // 3. Create source record in database
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .insert({
        user_id: user.id,
        notebook_id: notebookId,
        file_url: uploadData.path,
        file_name: sanitizedFileName,
        display_name: file.name.replace(/\.[^/.]+$/, ''),
        file_size: file.size,
        mime_type: file.type,
        processing_status: 'pending',
        metadata_extracted: false
      })
      .select()
      .single()

    if (sourceError) throw sourceError

    // 4. Store user query if provided
    if (userQuery) {
      // Store user query in source metadata for now
      await supabase
        .from('sources')
        .update({
          extracted_metadata: { user_query: userQuery }
        })
        .eq('id', source.id)
    }

    // 5. Call edge function to trigger n8n ingest webhook with explicit URL
    const { data: processingResult, error: processingError } = await supabase.functions
      .invoke('trigger-n8n', {
        body: {
          webhook_type: 'ingest',
          webhook_url: import.meta.env.VITE_N8N_INGEST_URL || 'https://n8n.coralshades.ai/webhook-test/ingest',
          payload: {
            source_id: source.id,
            file_path: uploadData.path,
            notebook_id: notebookId,
            user_query: userQuery,
            file_name: file.name,
            file_size: file.size,
            user_id: user.id
          }
        }
      })

    if (processingError) {
      console.error('Edge function error:', processingError)
      // Don't throw here - file is uploaded, just processing failed
    }

    return {
      uploadId: source.id,
      jobId: source.id // Using source ID as job ID for simplicity
    }
  } catch (error) {
    console.error('Upload error:', error)
    throw error
  }
}

// Monitor processing job status
export async function getProcessingJobStatus(jobId: string): Promise<ProcessingJob | null> {
  const { data, error } = await supabase
    .from('sources')
    .select('id, processing_status, error_message')
    .eq('id', jobId)
    .single()

  if (error) {
    console.error('Error fetching job status:', error)
    return null
  }

  return {
    id: data.id,
    status: data.processing_status as any,
    progress: data.processing_status === 'completed' ? 100 : 
              data.processing_status === 'processing' ? 50 : 0,
    error_message: data.error_message
  }
}

// =====================================================
// Chat Functionality
// =====================================================

export async function createChatSession(
  notebookId: string,
  sourceIds: string[] = []
): Promise<string> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: user.id,
      notebook_id: notebookId,
      title: `Chat - ${new Date().toLocaleString()}`,
      source_ids: sourceIds
    })
    .select()
    .single()

  if (error) throw error
  return data.id
}

export async function sendChatMessage(
  sessionId: string,
  message: string
): Promise<ChatMessage> {
  const result = await sendChatWithErrorHandling(sessionId, message)
  return {
    role: 'assistant',
    content: result.aiMessage.content
  }
}

// =====================================================
// Source Management
// =====================================================

export async function deleteAllSources(notebookId: string): Promise<void> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Not authenticated')

    // Get all sources for this notebook and user
    const { data: sources, error: sourcesError } = await supabase
      .from('sources')
      .select('id, file_url')
      .eq('notebook_id', notebookId)
      .eq('user_id', user.id)

    if (sourcesError) throw sourcesError

    if (sources && sources.length > 0) {
      // Delete files from storage
      const filePaths = sources.map(source => source.file_url).filter(Boolean)
      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('sources')
          .remove(filePaths)
        
        if (storageError) {
          console.warn('Some files could not be deleted from storage:', storageError)
        }
      }

      // Delete source records from database
      const { error: deleteError } = await supabase
        .from('sources')
        .delete()
        .eq('notebook_id', notebookId)
        .eq('user_id', user.id)

      if (deleteError) throw deleteError
    }
  } catch (error) {
    console.error('Error deleting all sources:', error)
    throw error
  }
}

// =====================================================
// Citation Management
// =====================================================

export async function fetchCitation(citationId: string): Promise<{ title: string; excerpt: string }> {
  // Mock implementation for now - replace with actual API call when backend is ready
  return {
    title: `Citation ${citationId}`,
    excerpt: `This is a sample excerpt for citation ${citationId}. In a real implementation, this would fetch actual citation data from the backend.`
  }
}

// =====================================================
// Notebook Management
// =====================================================

export async function createNotebook(
  name: string,
  projectType: string = 'general'
): Promise<string> {
  return await createNotebookWithErrorHandling(name, projectType)
}

export async function getNotebooks() {
  return await fetchWithErrorHandling(
    async () => {
      const { data, error } = await supabase
        .from('notebooks')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
    'notebooks',
    [] // fallback to empty array
  )
}

export async function getDefaultNotebook(): Promise<string> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Not authenticated')

  // Check for existing default notebook
  const { data: notebooks } = await supabase
    .from('notebooks')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', 'Default Notebook')
    .limit(1)

  if (notebooks && notebooks.length > 0) {
    return notebooks[0].id
  }

  // Create default notebook
  return await createNotebook('Default Notebook', 'general')
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
        table: 'sources',
        filter: `id=eq.${jobId}`
      },
      (payload) => {
        const source = payload.new as any
        onUpdate({
          id: source.id,
          status: source.processing_status,
          progress: source.processing_status === 'completed' ? 100 : 
                   source.processing_status === 'processing' ? 50 : 0,
          error_message: source.error_message
        })
      }
    )
    .subscribe()
}

// =====================================================
// Compatibility Functions for Existing Components
// =====================================================

// For ChatStream.tsx
export async function sendChat(sessionId: string, message: string) {
  try {
    const response = await sendChatMessage(sessionId, message)
    
    return {
      userMessage: {
        id: Date.now().toString(),
        content: message
      },
      aiMessage: {
        id: (Date.now() + 1).toString(),
        content: response.content
      }
    }
  } catch (error) {
    console.error('sendChat error:', error)
    throw error
  }
}

// For PermitDrawer.tsx
export async function template() {
  const { data, error } = await supabase
    .from('report_templates')
    .select('*')
    .eq('is_active', true)
  
  if (error) throw error
  return data
}

export async function genTemplate(params: {
  permitType: string
  address: string
  applicant: string
  sessionId: string
}) {
  try {
    // Call edge function to trigger template generation
    const { data, error } = await supabase.functions
      .invoke('trigger-n8n', {
        body: {
          webhook_type: 'template',
          webhook_url: import.meta.env.VITE_N8N_TEMPLATE_URL || 'https://n8n.coralshades.ai/webhook-test/template',
          payload: {
            permit_type: params.permitType,
            address: params.address,
            applicant: params.applicant,
            session_id: params.sessionId,
            timestamp: new Date().toISOString()
          }
        }
      })

    if (error) throw error

    return {
      docx_url: data?.download_url || '#',
      preview_url: data?.preview_url || '#'
    }
  } catch (error) {
    console.error('genTemplate error:', error)
    throw error
  }
}

// =====================================================
// Report Management Functions
// =====================================================

export async function getReports(notebookId: string) {
  return await fetchWithErrorHandling(
    async () => {
      const { data, error } = await supabase
        .from('report_generations')
        .select('*')
        .eq('notebook_id', notebookId)
        .eq('file_format', 'markdown')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
    `reports_${notebookId}`,
    [] // fallback to empty array
  )
}

export async function getReportContent(filePath: string): Promise<string> {
  return await fetchWithErrorHandling(
    async () => {
      const { data, error } = await supabase.storage
        .from('reports')
        .download(filePath)
      
      if (error) throw error
      
      const text = await data.text()
      return text
    },
    `report_content_${filePath}`,
    'Report content not available' // fallback content
  )
}

export async function downloadReportFile(filePath: string, fileName: string): Promise<void> {
  try {
    const { data, error } = await supabase.storage
      .from('reports')
      .download(filePath)
    
    if (error) throw error

    // Create download link
    const blob = new Blob([data], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Download failed:', error)
    throw error
  }
}

// Enhanced report management with better error handling
export async function getReportsByNotebook(notebookId: string) {
  return await fetchWithErrorHandling(
    async () => {
      const { data, error } = await supabase
        .from('report_generations')
        .select(`
          id,
          title,
          topic,
          address,
          status,
          file_path,
          file_format,
          file_size,
          progress,
          created_at,
          completed_at,
          error_message
        `)
        .eq('notebook_id', notebookId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
    },
    `reports_detailed_${notebookId}`,
    []
  )
}

export async function downloadReportAsMarkdown(reportId: string, title: string): Promise<void> {
  try {
    const { data: report, error: reportError } = await supabase
      .from('report_generations')
      .select('file_path')
      .eq('id', reportId)
      .single()

    if (reportError) throw reportError
    if (!report?.file_path) throw new Error('Report file not found')

    const { data, error } = await supabase.storage
      .from('reports')
      .download(report.file_path)
    
    if (error) throw error

    // Create download link
    const blob = new Blob([data], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Download failed:', error)
    throw error
  }
}

// =====================================================
// LLM Connection Testing
// =====================================================

export async function testLLMConnection(provider: string, settings: LLMSettings): Promise<{ success: boolean }> {
  try {
    // For now, return true as a placeholder
    // This can be expanded to actually test the connection
    console.log('Testing LLM connection with provider:', provider, 'settings:', settings)
    return { success: true }
  } catch (error) {
    console.error('LLM connection test failed:', error)
    return { success: false }
  }
}

// Update user settings
export async function updateUserSettings(settings: LLMSettings): Promise<void> {
  return await updateUserSettingsWithErrorHandling(settings)
}