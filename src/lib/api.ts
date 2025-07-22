import { supabase } from "@/integrations/supabase/client";

// API functions for town planning system with n8n integration
export async function uploadFile(file: File, notebookId: string) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  // Upload to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('hh_pdf_library')
    .upload(filePath, file);

  if (uploadError) {
    throw uploadError;
  }

  // Create source record
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

  if (sourceError) {
    throw sourceError;
  }

  // Trigger n8n file processing workflow instead of direct processing
  const { data: triggerResult, error: triggerError } = await supabase.functions.invoke(
    'trigger-file-processing-workflow',
    {
      body: {
        sourceId: sourceData.id,
        filePath: filePath,
        notebookId: notebookId,
        fileName: file.name,
        fileSize: file.size
      }
    }
  );

  if (triggerError) {
    console.error('Failed to trigger file processing workflow:', triggerError);
    // Don't throw here - file is uploaded, processing will be retried
  }

  return { uploadData, sourceData, triggerResult };
}

export async function sendChatMessage(sessionId: string, content: string) {
  // Add user message first
  const { data: userMessage, error: userError } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      message_type: 'human',
      content
    })
    .select()
    .single();

  if (userError) {
    throw userError;
  }

  // Get session to find notebook for context
  const { data: session, error: sessionError } = await supabase
    .from('chat_sessions')
    .select('notebook_id')
    .eq('id', sessionId)
    .single();

  if (sessionError) {
    throw sessionError;
  }

  // Trigger n8n chat workflow instead of direct AI processing
  const { data: triggerResult, error: triggerError } = await supabase.functions.invoke(
    'trigger-chat-workflow',
    {
      body: {
        sessionId: sessionId,
        messageId: userMessage.id,
        userMessage: content,
        notebookId: session.notebook_id
      }
    }
  );

  if (triggerError) {
    console.error('Failed to trigger chat workflow:', triggerError);
    // Don't throw here - message is saved, AI response will be handled by n8n
  }

  return { 
    userMessage, 
    triggerResult,
    // Return a placeholder for immediate UI update
    aiMessage: null // Will be updated via real-time subscription
  };
}

export async function generateReport(params: {
  notebook_id: string;
  template_id: string;
  topic: string;
  address?: string;
  additional_context?: string;
}) {
  const { data, error } = await supabase.functions.invoke('generate-report', {
    body: params
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

export async function getNotebooks() {
  const { data, error } = await supabase
    .from('notebooks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function createNotebook(notebook: {
  title: string;
  client_name?: string;
  project_type?: string;
  address?: string;
  contact_email?: string;
  contact_phone?: string;
}) {
  const { data, error } = await supabase
    .from('notebooks')
    .insert(notebook)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getSources(notebookId: string) {
  const { data, error } = await supabase
    .from('sources')
    .select(`
      *,
      pdf_metadata (*)
    `)
    .eq('notebook_id', notebookId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function getReportGenerations(notebookId: string) {
  const { data, error } = await supabase
    .from('report_generations')
    .select(`
      *,
      report_templates (display_name),
      report_sections (*)
    `)
    .eq('notebook_id', notebookId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function getChatSessions(notebookId: string) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('notebook_id', notebookId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function createChatSession(notebookId: string, sessionName?: string) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      notebook_id: notebookId,
      session_name: sessionName || 'New Chat Session'
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getChatMessages(sessionId: string) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

// Legacy compatibility functions
export async function sendChat(sessionId: string, question: string) {
  return sendChatMessage(sessionId, question);
}

export async function genTemplate(params: {
  sessionId: string;
  permitType: string;
  address: string;
  applicant: string;
}) {
  const { data: session, error: sessionError } = await supabase
    .from('chat_sessions')
    .select('notebook_id')
    .eq('id', params.sessionId)
    .single();

  if (sessionError) {
    throw sessionError;
  }

  const templates = await getReportTemplates();
  if (!templates || templates.length === 0) {
    throw new Error('No report templates available');
  }

  return generateReport({
    notebook_id: session.notebook_id,
    template_id: templates[0].id,
    topic: params.permitType,
    address: params.address,
    additional_context: `Applicant: ${params.applicant}`
  });
}

export async function template(sessionId: string, permitType: string, address: string, applicant: string) {
  return genTemplate({ sessionId, permitType, address, applicant });
}
