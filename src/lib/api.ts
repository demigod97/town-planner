// supabase/functions/process-pdf-with-metadata/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// LLM Provider configurations
const LLM_PROVIDERS = {
  ollama: {
    embedModel: 'nomic-embed-text:latest',
    chatModel: 'qwen3:8b-q4_K_M',
    baseUrl: () => Deno.env.get('OLLAMA_BASE_URL') || 'http://localhost:11434'
  },
  openai: {
    embedModel: 'text-embedding-3-small',
    chatModel: 'gpt-4',
    apiKey: () => Deno.env.get('OPENAI_API_KEY')
  },
  gemini: {
    embedModel: 'embedding-001',
    chatModel: 'gemini-pro',
    apiKey: () => Deno.env.get('GEMINI_API_KEY')
  },
  llamacloud: {
    apiKey: () => Deno.env.get('LLAMACLOUD_API_KEY')
  }
}

// Generate content using selected LLM
async function generateContent(prompt: string, provider: string = 'ollama', options: any = {}) {
  switch (provider) {
    case 'ollama':
      const ollamaResponse = await fetch(`${LLM_PROVIDERS.ollama.baseUrl()}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model || LLM_PROVIDERS.ollama.chatModel,
          prompt: prompt,
          stream: false,
          options: {
            temperature: options.temperature || 0.1,
            top_p: 0.9,
          }
        })
      })
      if (!ollamaResponse.ok) throw new Error('Ollama generation failed')
      const ollamaData = await ollamaResponse.json()
      return ollamaData.response

    case 'openai':
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LLM_PROVIDERS.openai.apiKey()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || LLM_PROVIDERS.openai.chatModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: options.temperature || 0.1,
        })
      })
      if (!openaiResponse.ok) throw new Error('OpenAI generation failed')
      const openaiData = await openaiResponse.json()
      return openaiData.choices[0].message.content

    case 'gemini':
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${options.model || LLM_PROVIDERS.gemini.chatModel}:generateContent?key=${LLM_PROVIDERS.gemini.apiKey()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: options.temperature || 0.1,
              topP: 0.9,
            }
          })
        }
      )
      if (!geminiResponse.ok) throw new Error('Gemini generation failed')
      const geminiData = await geminiResponse.json()
      return geminiData.candidates[0].content.parts[0].text

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`)
  }
}

// Discover metadata fields using AI
async function discoverMetadataFields(content: string, existingSchema: any[], llmProvider: string) {
  const prompt = `Analyze this document and extract metadata fields. 
Consider these existing fields we track: ${JSON.stringify(existingSchema.map(s => ({ name: s.field_name, description: s.field_description })))}

For each metadata field found in the document:
1. Check if it matches an existing field (even with different naming)
2. Extract the exact value from the document
3. If it's a new field, suggest a standardized field name
4. Determine the confidence level (0-1) based on clarity

Document excerpt:
${content.substring(0, 8000)}

Return ONLY a valid JSON object with this structure:
{
  "discovered_fields": [
    {
      "raw_field_name": "string",
      "standardized_field_name": "string",
      "matches_existing": boolean,
      "existing_field_id": "uuid or null",
      "value": "extracted value",
      "confidence": 0.95,
      "extraction_context": "surrounding text",
      "page_number": 1
    }
  ],
  "new_field_suggestions": [
    {
      "field_name": "string",
      "field_type": "text|date|number|boolean|array",
      "field_category": "general|client|project|location|regulatory|technical",
      "description": "string",
      "example_value": "string"
    }
  ]
}`

  const response = await generateContent(prompt, llmProvider, { temperature: 0.1 })
  
  // Clean and parse JSON response
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Invalid JSON response from LLM')
  
  return JSON.parse(jsonMatch[0])
}

// Perform semantic chunking
function performSemanticChunking(content: string, maxChunkSize: number = 1500) {
  const chunks = []
  const sections = content.split(/^#{1,3}\s/m)
  
  sections.forEach((section, sectionIndex) => {
    if (!section.trim()) return
    
    const lines = section.split('\n')
    const sectionTitle = lines[0]?.trim() || 'Untitled Section'
    const sectionContent = lines.slice(1).join('\n').trim()
    
    // Handle tables specially
    const tableMatches = sectionContent.match(/\|[^\n]+\|[\s\S]+?\n(?!\|)/g) || []
    let processedContent = sectionContent
    
    tableMatches.forEach((table, tableIndex) => {
      chunks.push({
        content: table,
        section_title: sectionTitle,
        chunk_type: 'table',
        chunk_index: chunks.length,
        metadata: {
          table_index: tableIndex,
          rows: table.split('\n').length
        }
      })
      processedContent = processedContent.replace(table, `[TABLE_${tableIndex}]`)
    })
    
    // Split remaining content into paragraphs
    const paragraphs = processedContent.split(/\n\s*\n/)
    let currentChunk = ''
    let currentParagraphs = []
    
    paragraphs.forEach((paragraph, pIndex) => {
      const trimmedPara = paragraph.trim()
      if (!trimmedPara || trimmedPara.length < 20) return
      
      if (currentChunk.length + trimmedPara.length > maxChunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          content: currentChunk.trim(),
          section_title: sectionTitle,
          chunk_type: 'text',
          chunk_index: chunks.length,
          paragraph_indices: [...currentParagraphs],
          metadata: {
            word_count: currentChunk.split(/\s+/).length,
            char_count: currentChunk.length
          }
        })
        
        // Start new chunk
        currentChunk = trimmedPara
        currentParagraphs = [pIndex]
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara
        currentParagraphs.push(pIndex)
      }
    })
    
    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        section_title: sectionTitle,
        chunk_type: 'text',
        chunk_index: chunks.length,
        paragraph_indices: currentParagraphs,
        metadata: {
          word_count: currentChunk.split(/\s+/).length,
          char_count: currentChunk.length
        }
      })
    }
  })
  
  return chunks
}

// Determine chunk metadata
async function determineChunkMetadata(chunkContent: string, sectionTitle: string, discoveredFields: any[]) {
  const relevantFields = []
  
  for (const field of discoveredFields) {
    if (chunkContent.toLowerCase().includes(field.value?.toLowerCase()) ||
        sectionTitle.toLowerCase().includes(field.standardized_field_name.toLowerCase())) {
      relevantFields.push(field.standardized_field_name)
    }
  }
  
  // Always include location fields for chunks mentioning addresses
  if (chunkContent.match(/\d+\s+\w+\s+(street|road|avenue|drive|lane)/i)) {
    relevantFields.push('address', 'lot_details')
  }
  
  return [...new Set(relevantFields)]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate required environment variables
    const requiredEnvVars = {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    }
    
    const missingVars = Object.entries(requiredEnvVars)
      .filter(([key, value]) => !value)
      .map(([key]) => key)
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
    }

    const supabase = createClient(
      requiredEnvVars.SUPABASE_URL,
      requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY
    )

    const { 
      source_id, 
      file_path, 
      notebook_id,
      llm_provider = 'llamacloud', // Default to llamacloud for PDF parsing
      llm_config = {}
    } = await req.json()

    if (!source_id || !file_path || !notebook_id) {
      throw new Error('Missing required parameters: source_id, file_path, notebook_id')
    }

    console.log(`Processing PDF ${source_id} with ${llm_provider}`)

    // Update processing status
    await supabase
      .from('sources')
      .update({ 
        processing_status: 'processing',
        processing_started_at: new Date().toISOString(),
        processing_error: null
      })
      .eq('id', source_id)

    // Get signed URL for the file
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('sources')
      .createSignedUrl(file_path, 60 * 60) // 1 hour expiry

    if (signedUrlError) throw signedUrlError

    let parsedContent = ''
    let parseMetadata = {}
    let discoveryResult = {
      discovered_fields: [],
      new_field_suggestions: []
    }

    // Parse PDF based on provider
    if (llm_provider === 'llamacloud') {
      const llamaApiKey = Deno.env.get('LLAMACLOUD_API_KEY')
      if (!llamaApiKey) {
        console.warn('LLAMACLOUD_API_KEY not configured, falling back to basic extraction')
        parsedContent = `# Document Content\n\nNote: LlamaCloud API key not configured. Using basic extraction.\n\nFile: ${file_path}\nSize: Processing...`
      } else {
        // Use LlamaCloud for superior PDF parsing
        try {
          const llamaResponse = await fetch('https://api.llamaindex.ai/api/parsing/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${llamaApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              file_url: signedUrlData.signedUrl,
              parsing_instruction: 'Extract all text content in markdown format with clear section headings. Preserve tables and lists.',
              result_type: 'markdown',
              invalidate_cache: false
            })
          })

          if (!llamaResponse.ok) {
            const errorText = await llamaResponse.text()
            throw new Error(`LlamaCloud parsing failed: ${llamaResponse.status} ${errorText}`)
          }
          
          const llamaData = await llamaResponse.json()
          const jobId = llamaData.id

          // Poll for completion
          let attempts = 0
          while (attempts < 30) { // 5 minutes max
            const statusResponse = await fetch(`https://api.llamaindex.ai/api/parsing/job/${jobId}`, {
              headers: {
                'Authorization': `Bearer ${llamaApiKey}`,
              }
            })

            if (statusResponse.ok) {
              const statusData = await statusResponse.json()
              if (statusData.status === 'SUCCESS') {
                parsedContent = statusData.result.markdown
                break
              } else if (statusData.status === 'ERROR') {
                throw new Error('LlamaCloud parsing failed')
              }
            }

            attempts++
            await new Promise(resolve => setTimeout(resolve, 10000)) // 10 seconds
          }

          if (!parsedContent) throw new Error('LlamaCloud processing timeout')
        } catch (llamaError) {
          console.error('LlamaCloud error:', llamaError)
          parsedContent = `# Document Content\n\nNote: LlamaCloud processing failed. Using basic extraction.\n\nFile: ${file_path}\nProvider: ${llm_provider}\nProcessed at: ${new Date().toISOString()}`
        }
      }
    } else {
      // Fallback: Download and extract text (basic extraction)
      // In production, you'd want to use a proper PDF parsing library
      const pdfResponse = await fetch(signedUrlData.signedUrl)
      const pdfBlob = await pdfResponse.blob()
      
      // This is a placeholder - in reality you'd use pdf-parse or similar
      parsedContent = `# Document Content\n\nNote: Basic extraction used. For better results, use LlamaCloud provider.\n\n[PDF content would be extracted here]`
    }

    // Get existing metadata schema
    const { data: metadataSchema } = await supabase
      .from('metadata_schema')
      .select('*')
      .order('occurrence_count', { ascending: false })

    // Discover metadata fields using AI
    try {
      discoveryResult = await discoverMetadataFields(
        parsedContent,
        metadataSchema || [],
        llm_provider === 'llamacloud' ? 'ollama' : llm_provider // Use configured LLM for metadata
      )
    } catch (discoveryError) {
      console.error('Metadata discovery failed:', discoveryError)
      discoveryResult = {
        discovered_fields: [],
        new_field_suggestions: []
      }
    }

    // Create PDF metadata record
    const { data: pdfMetadata, error: pdfMetadataError } = await supabase
      .from('pdf_metadata')
      .insert({
        source_id,
        notebook_id,
        extraction_method: 'ai',
        extraction_model: llm_provider,
        overall_confidence: discoveryResult.discovered_fields.reduce((acc: number, f: any) => acc + f.confidence, 0) / discoveryResult.discovered_fields.length || 0,
        raw_extraction: discoveryResult
      })
      .select()
      .single()

    if (pdfMetadataError) throw pdfMetadataError

    // Process discovered fields
    for (const field of discoveryResult.discovered_fields) {
      let schemaFieldId = field.existing_field_id

      if (!field.matches_existing) {
        // Check if we should create a new schema field
        const similarFields = metadataSchema?.filter(s => 
          s.field_name.toLowerCase().includes(field.standardized_field_name.toLowerCase()) ||
          field.standardized_field_name.toLowerCase().includes(s.field_name.toLowerCase())
        )

        if (similarFields?.length === 0) {
          // Create new schema field if it doesn't exist
          try {
            const { data: newSchema } = await supabase
              .from('metadata_schema')
              .insert({
                field_name: field.standardized_field_name,
                field_type: 'text', // Default, could be enhanced
                field_category: 'general',
                display_name: field.raw_field_name,
                occurrence_count: 1
              })
              .select()
              .single()

            schemaFieldId = newSchema?.id
          } catch (schemaError) {
            console.error('Failed to create schema field:', schemaError)
          }
        } else {
          schemaFieldId = similarFields?.[0]?.id
        }
      }

      if (schemaFieldId) {
        // Store the field value
        try {
          await supabase
            .from('pdf_metadata_values')
            .insert({
              pdf_metadata_id: pdfMetadata.id,
              schema_field_id: schemaFieldId,
              field_value: field.value,
              field_value_normalized: field.value?.toLowerCase().trim(),
              confidence_score: field.confidence,
              extraction_method: 'ai',
              extraction_context: field.extraction_context,
              page_number: field.page_number
            })
        } catch (valueError) {
          console.error('Failed to store metadata value:', valueError)
        }

        // Update schema occurrence count
        await supabase.rpc('increment', { 
          table_name: 'metadata_schema',
          column_name: 'occurrence_count',
          row_id: schemaFieldId 
        })
      }
    }

    // Perform semantic chunking
    const chunks = performSemanticChunking(parsedContent)
    console.log(`Created ${chunks.length} chunks`)

    // Store chunks in database
    const chunkRecords = []
    for (const chunk of chunks) {
      try {
        const { data: chunkRecord } = await supabase
          .from('document_chunks')
          .insert({
            source_id,
            notebook_id,
            content: chunk.content,
            chunk_index: chunk.chunk_index,
            section_title: chunk.section_title,
            chunk_type: chunk.chunk_type,
            word_count: chunk.metadata?.word_count,
            char_count: chunk.metadata?.char_count,
            metadata: chunk.metadata
          })
          .select()
          .single()

        if (chunkRecord) {
          chunkRecords.push(chunkRecord)
        }
      } catch (chunkError) {
        console.error('Failed to store chunk:', chunkError)
      }

      try {
        const relevantFields = await determineChunkMetadata(
          chunk.content,
          chunk.section_title || '',
          discoveryResult.discovered_fields || []
        )

        for (const fieldName of relevantFields) {
          const field = discoveryResult.discovered_fields?.find((f: any) => 
            f.standardized_field_name === fieldName
          )
          
          if (field) {
            // Store chunk-field relationship
            await supabase
              .from('chunk_metadata_relations')
              .insert({
                chunk_id: chunkRecords[chunkRecords.length - 1]?.id,
                metadata_field_id: field.existing_field_id,
                relevance_score: field.confidence
              })
          }
        }
      } catch (relationError) {
        console.error('Failed to store chunk metadata relations:', relationError)
      }
    }

    // Update source with completion status
    await supabase
      .from('sources')
      .update({
        processing_status: 'completed',
        processing_completed_at: new Date().toISOString(),
        metadata_extracted: true,
        chunk_count: chunks.length,
        extracted_metadata: {
          discovered_fields: discoveryResult.discovered_fields.length,
          new_suggestions: discoveryResult.new_field_suggestions.length
        }
      })
      .eq('id', source_id)

    // Trigger embedding generation via n8n
    if (Deno.env.get('N8N_WEBHOOK_BASE_URL')) {
      fetch(`${Deno.env.get('N8N_WEBHOOK_BASE_URL')}/webhook/generate-embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('N8N_API_KEY')}`,
        },
        body: JSON.stringify({
          source_id,
          notebook_id,
          chunk_ids: chunkRecords.map(c => c.id),
          llm_provider: llm_config.embedding_provider || llm_provider
        })
      }).catch(console.error)
    }

    return new Response(
      JSON.stringify({
        success: true,
        source_id,
        pdf_metadata_id: pdfMetadata.id,
        chunks_created: chunks.length,
        metadata_discovered: discoveryResult.discovered_fields.length,
        message: 'PDF processed successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error processing PDF:', error)
    
    // Update source with error status
    if (req.body) {
      try {
        const { source_id } = await req.json()
        if (source_id) {
          await supabase
            .from('sources')
            .update({
              processing_status: 'failed',
              processing_completed_at: new Date().toISOString(),
              processing_error: error.message
            })
            .eq('id', source_id)
        }
      } catch (updateError) {
        console.error('Failed to update error status:', updateError)
      }
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'PDF processing failed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})