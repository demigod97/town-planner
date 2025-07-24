import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'

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

export async function uploadAndProcessFile(
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
      await supabase
        .from('chat_messages')
        .insert({
          session_id: null, // Will be associated later
          content: userQuery,
          message_type: 'user',
          sources_used: [source.id]
        })
    }

    // 5. Call edge function to trigger n8n ingest webhook
    const { data: processingResult, error: processingError } = await supabase.functions
      .invoke('trigger-n8n', {
        body: {
          webhook_type: 'ingest',
          webhook_url: 'https://n8n.coralshades.ai/webhook-test/ingest',
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
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Not authenticated')

    // 1. Store user message in database
    const { data: userMessage, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        role: 'user',
        content: message,
      })
      .select()
      .single()

    if (messageError) throw messageError

    // 2. Get session context
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    // 3. Call edge function to trigger n8n chat webhook
    const { data: chatResponse, error: chatError } = await supabase.functions
      .invoke('trigger-n8n', {
        body: {
          webhook_type: 'chat',
          webhook_url: import.meta.env.VITE_N8N_CHAT_WEBHOOK || 'https://n8n.coralshades.ai/webhook-test/hhlm-chat',
          payload: {
            session_id: sessionId,
            message: message,
            user_id: user.id,
            notebook_id: session?.notebook_id,
            timestamp: new Date().toISOString()
          }
        }
      })

    if (chatError) {
      console.error('Chat webhook error:', chatError)
      throw new Error('Failed to process message')
    }

    // 4. Return success - n8n will handle storing the assistant response
    const assistantContent = chatResponse?.response || 'Message sent to AI assistant for processing...'

    return {
      role: 'assistant',
      content: assistantContent
    }
  } catch (error) {
    console.error('Chat error:', error)
    throw error
  }
}

// =====================================================
// Notebook Management
// =====================================================

export async function createNotebook(
  name: string,
  projectType: string = 'general'
): Promise<string> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('notebooks')
    .insert({
      user_id: user.id,
      name: name,
      project_type: projectType
    })
    .select()
    .single()

  if (error) throw error
  return data.id
}

export async function getNotebooks() {
  const { data, error } = await supabase
    .from('notebooks')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
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
          webhook_url: 'https://n8n.coralshades.ai/webhook-test/template',
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

// For SourcesSidebar.tsx
export async function uploadFile(file: File, notebookId: string, userQuery?: string) {
  try {
    const result = await uploadAndProcessFile(file, notebookId, userQuery)
    
    return {
      id: result.uploadId,
      display_name: file.name,
      file_size: file.size,
      processing_status: 'processing',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  } catch (error) {
    console.error('uploadFile error:', error)
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
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('user_profiles')
    .update({ preferences: settings })
    .eq('id', user.id)

  if (error) throw error
}