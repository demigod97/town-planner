import { supabase } from "@/integrations/supabase/client";

// API functions for town planning system
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

  // Trigger PDF processing
  const { data: processResult, error: processError } = await supabase.functions.invoke(
    'process-pdf-with-metadata',
    {
      body: {
        source_id: sourceData.id,
        file_path: filePath,
        notebook_id: notebookId
      }
    }
  );

  if (processError) {
    throw processError;
  }

  return { uploadData, sourceData, processResult };
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

export async function sendChat(sessionId: string, question: string) {
  return sendChatMessage(sessionId, question);
}

export async function sendChatMessage(sessionId: string, content: string) {
  // Add user message
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

  // Get chat session to find notebook for context
  const { data: session, error: sessionError } = await supabase
    .from('chat_sessions')
    .select('notebook_id')
    .eq('id', sessionId)
    .single();

  if (sessionError) {
    throw sessionError;
  }

  // Search for relevant context
  const searchResult = await searchVectors([content], session.notebook_id);
  const relevantChunks = searchResult.results[0]?.results || [];

  // Build context
  const context = relevantChunks
    .map((chunk: any) => chunk.content)
    .join('\n\n');

  // Generate AI response using Ollama (this would be done via n8n in production)
  const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama3.1:8b',
      prompt: `Based on the following context from planning documents, answer this question: ${content}

Context:
${context}

Please provide a helpful and accurate response based on the context provided.`,
      stream: false
    })
  });

  let aiResponseContent = "I'm unable to process your request at the moment.";
  
  if (ollamaResponse.ok) {
    const ollamaData = await ollamaResponse.json();
    aiResponseContent = ollamaData.response;
  }

  // Add AI response
  const { data: aiMessage, error: aiError } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      message_type: 'ai',
      content: aiResponseContent,
      sources_used: relevantChunks.map((chunk: any) => chunk.source_id),
      chunks_used: relevantChunks.map((chunk: any) => chunk.id),
      citations: relevantChunks.map((chunk: any) => ({
        source_id: chunk.source_id,
        chunk_id: chunk.id,
        content: chunk.content.substring(0, 200) + '...'
      }))
    })
    .select()
    .single();

  if (aiError) {
    throw aiError;
  }

  return { 
    userMessage, 
    aiMessage, 
    history: [
      { role: 'user', content: userMessage.content },
      { role: 'assistant', content: aiMessage.content }
    ]
  };
}

export async function genTemplate(params: {
  sessionId: string;
  permitType: string;
  address: string;
  applicant: string;
}) {
  // Get session to find notebook
  const { data: session, error: sessionError } = await supabase
    .from('chat_sessions')
    .select('notebook_id')
    .eq('id', params.sessionId)
    .single();

  if (sessionError) {
    throw sessionError;
  }

  // Get first available template
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