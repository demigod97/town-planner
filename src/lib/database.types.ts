export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          chunks_retrieved: string[] | null
          completion_tokens: number | null
          content: string
          created_at: string | null
          id: string
          llm_model: string | null
          llm_provider: string | null
          prompt_tokens: number | null
          response_time_ms: number | null
          retrieval_metadata: Json | null
          role: string
          session_id: string | null
          sources_cited: string[] | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          chunks_retrieved?: string[] | null
          completion_tokens?: number | null
          content: string
          created_at?: string | null
          id?: string
          llm_model?: string | null
          llm_provider?: string | null
          prompt_tokens?: number | null
          response_time_ms?: number | null
          retrieval_metadata?: Json | null
          role: string
          session_id?: string | null
          sources_cited?: string[] | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          chunks_retrieved?: string[] | null
          completion_tokens?: number | null
          content?: string
          created_at?: string | null
          id?: string
          llm_model?: string | null
          llm_provider?: string | null
          prompt_tokens?: number | null
          response_time_ms?: number | null
          retrieval_metadata?: Json | null
          role?: string
          session_id?: string | null
          sources_cited?: string[] | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          last_message_at: string | null
          llm_config: Json | null
          llm_model: string | null
          llm_provider: string | null
          notebook_id: string | null
          source_ids: string[] | null
          title: string | null
          total_messages: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          llm_config?: Json | null
          llm_model?: string | null
          llm_provider?: string | null
          notebook_id?: string | null
          source_ids?: string[] | null
          title?: string | null
          total_messages?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          llm_config?: Json | null
          llm_model?: string | null
          llm_provider?: string | null
          notebook_id?: string | null
          source_ids?: string[] | null
          title?: string | null
          total_messages?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "v_document_stats"
            referencedColumns: ["notebook_id"]
          },
        ]
      }
      chunk_embeddings: {
        Row: {
          chunk_id: string | null
          created_at: string | null
          embedding: string | null
          embedding_dimension: number
          embedding_model: string
          id: string
          metadata: Json | null
          notebook_id: string | null
          updated_at: string | null
        }
        Insert: {
          chunk_id?: string | null
          created_at?: string | null
          embedding?: string | null
          embedding_dimension: number
          embedding_model: string
          id?: string
          metadata?: Json | null
          notebook_id?: string | null
          updated_at?: string | null
        }
        Update: {
          chunk_id?: string | null
          created_at?: string | null
          embedding?: string | null
          embedding_dimension?: number
          embedding_model?: string
          id?: string
          metadata?: Json | null
          notebook_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chunk_embeddings_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "document_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunk_embeddings_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunk_embeddings_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "v_document_stats"
            referencedColumns: ["notebook_id"]
          },
        ]
      }
      chunk_metadata_associations: {
        Row: {
          association_type: string | null
          chunk_id: string | null
          created_at: string | null
          id: string
          relevance_score: number | null
          schema_field_id: string | null
        }
        Insert: {
          association_type?: string | null
          chunk_id?: string | null
          created_at?: string | null
          id?: string
          relevance_score?: number | null
          schema_field_id?: string | null
        }
        Update: {
          association_type?: string | null
          chunk_id?: string | null
          created_at?: string | null
          id?: string
          relevance_score?: number | null
          schema_field_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chunk_metadata_associations_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "document_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunk_metadata_associations_schema_field_id_fkey"
            columns: ["schema_field_id"]
            isOneToOne: false
            referencedRelation: "metadata_schema"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          char_count: number | null
          chunk_index: number
          chunk_type: string | null
          content: string
          content_hash: string | null
          created_at: string | null
          embedding_generated: boolean | null
          embedding_generated_at: string | null
          embedding_model: string | null
          end_page: number | null
          hierarchy_level: number | null
          id: string
          metadata: Json | null
          notebook_id: string | null
          parent_chunk_id: string | null
          related_chunks: string[] | null
          search_text: unknown | null
          section_title: string | null
          source_id: string | null
          start_page: number | null
          subsection_title: string | null
          updated_at: string | null
          word_count: number | null
        }
        Insert: {
          char_count?: number | null
          chunk_index: number
          chunk_type?: string | null
          content: string
          content_hash?: string | null
          created_at?: string | null
          embedding_generated?: boolean | null
          embedding_generated_at?: string | null
          embedding_model?: string | null
          end_page?: number | null
          hierarchy_level?: number | null
          id?: string
          metadata?: Json | null
          notebook_id?: string | null
          parent_chunk_id?: string | null
          related_chunks?: string[] | null
          search_text?: unknown | null
          section_title?: string | null
          source_id?: string | null
          start_page?: number | null
          subsection_title?: string | null
          updated_at?: string | null
          word_count?: number | null
        }
        Update: {
          char_count?: number | null
          chunk_index?: number
          chunk_type?: string | null
          content?: string
          content_hash?: string | null
          created_at?: string | null
          embedding_generated?: boolean | null
          embedding_generated_at?: string | null
          embedding_model?: string | null
          end_page?: number | null
          hierarchy_level?: number | null
          id?: string
          metadata?: Json | null
          notebook_id?: string | null
          parent_chunk_id?: string | null
          related_chunks?: string[] | null
          search_text?: unknown | null
          section_title?: string | null
          source_id?: string | null
          start_page?: number | null
          subsection_title?: string | null
          updated_at?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "v_document_stats"
            referencedColumns: ["notebook_id"]
          },
          {
            foreignKeyName: "document_chunks_parent_chunk_id_fkey"
            columns: ["parent_chunk_id"]
            isOneToOne: false
            referencedRelation: "document_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      metadata_schema: {
        Row: {
          average_confidence: number | null
          created_at: string | null
          default_value: string | null
          display_name: string | null
          example_values: Json | null
          extraction_patterns: Json | null
          extraction_rules: Json | null
          extraction_success_rate: number | null
          field_category: string | null
          field_description: string | null
          field_name: string
          field_type: string
          id: string
          is_displayable: boolean | null
          is_required: boolean | null
          is_searchable: boolean | null
          last_seen: string | null
          occurrence_count: number | null
          updated_at: string | null
          validation_rules: Json | null
        }
        Insert: {
          average_confidence?: number | null
          created_at?: string | null
          default_value?: string | null
          display_name?: string | null
          example_values?: Json | null
          extraction_patterns?: Json | null
          extraction_rules?: Json | null
          extraction_success_rate?: number | null
          field_category?: string | null
          field_description?: string | null
          field_name: string
          field_type: string
          id?: string
          is_displayable?: boolean | null
          is_required?: boolean | null
          is_searchable?: boolean | null
          last_seen?: string | null
          occurrence_count?: number | null
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Update: {
          average_confidence?: number | null
          created_at?: string | null
          default_value?: string | null
          display_name?: string | null
          example_values?: Json | null
          extraction_patterns?: Json | null
          extraction_rules?: Json | null
          extraction_success_rate?: number | null
          field_category?: string | null
          field_description?: string | null
          field_name?: string
          field_type?: string
          id?: string
          is_displayable?: boolean | null
          is_required?: boolean | null
          is_searchable?: boolean | null
          last_seen?: string | null
          occurrence_count?: number | null
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Relationships: []
      }
      notebooks: {
        Row: {
          address: string | null
          client_name: string | null
          contact_email: string | null
          contact_phone: string | null
          council_area: string | null
          created_at: string | null
          description: string | null
          id: string
          lot_details: string | null
          metadata: Json | null
          name: string
          project_status: string | null
          project_type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          client_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          council_area?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          lot_details?: string | null
          metadata?: Json | null
          name: string
          project_status?: string | null
          project_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          client_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          council_area?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          lot_details?: string | null
          metadata?: Json | null
          name?: string
          project_status?: string | null
          project_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pdf_metadata: {
        Row: {
          created_at: string | null
          extracted_at: string | null
          extraction_method: string | null
          extraction_model: string | null
          id: string
          notebook_id: string | null
          overall_confidence: number | null
          raw_extraction: Json | null
          source_id: string | null
          updated_at: string | null
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
          validation_status: string | null
        }
        Insert: {
          created_at?: string | null
          extracted_at?: string | null
          extraction_method?: string | null
          extraction_model?: string | null
          id?: string
          notebook_id?: string | null
          overall_confidence?: number | null
          raw_extraction?: Json | null
          source_id?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?: string | null
        }
        Update: {
          created_at?: string | null
          extracted_at?: string | null
          extraction_method?: string | null
          extraction_model?: string | null
          id?: string
          notebook_id?: string | null
          overall_confidence?: number | null
          raw_extraction?: Json | null
          source_id?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdf_metadata_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdf_metadata_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "v_document_stats"
            referencedColumns: ["notebook_id"]
          },
          {
            foreignKeyName: "pdf_metadata_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_metadata_values: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          extraction_context: string | null
          extraction_method: string | null
          field_value: string | null
          field_value_normalized: string | null
          id: string
          is_validated: boolean | null
          page_number: number | null
          pdf_metadata_id: string | null
          schema_field_id: string | null
          updated_at: string | null
          validation_notes: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          extraction_context?: string | null
          extraction_method?: string | null
          field_value?: string | null
          field_value_normalized?: string | null
          id?: string
          is_validated?: boolean | null
          page_number?: number | null
          pdf_metadata_id?: string | null
          schema_field_id?: string | null
          updated_at?: string | null
          validation_notes?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          extraction_context?: string | null
          extraction_method?: string | null
          field_value?: string | null
          field_value_normalized?: string | null
          id?: string
          is_validated?: boolean | null
          page_number?: number | null
          pdf_metadata_id?: string | null
          schema_field_id?: string | null
          updated_at?: string | null
          validation_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdf_metadata_values_pdf_metadata_id_fkey"
            columns: ["pdf_metadata_id"]
            isOneToOne: false
            referencedRelation: "pdf_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdf_metadata_values_schema_field_id_fkey"
            columns: ["schema_field_id"]
            isOneToOne: false
            referencedRelation: "metadata_schema"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          completed_at: string | null
          config: Json | null
          created_at: string | null
          current_step: string | null
          error_details: Json | null
          error_message: string | null
          id: string
          job_type: string
          max_retries: number | null
          notebook_id: string | null
          progress: number | null
          result: Json | null
          retry_count: number | null
          scheduled_at: string | null
          source_id: string | null
          started_at: string | null
          status: string | null
          total_steps: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          config?: Json | null
          created_at?: string | null
          current_step?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          job_type: string
          max_retries?: number | null
          notebook_id?: string | null
          progress?: number | null
          result?: Json | null
          retry_count?: number | null
          scheduled_at?: string | null
          source_id?: string | null
          started_at?: string | null
          status?: string | null
          total_steps?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          config?: Json | null
          created_at?: string | null
          current_step?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          job_type?: string
          max_retries?: number | null
          notebook_id?: string | null
          progress?: number | null
          result?: Json | null
          retry_count?: number | null
          scheduled_at?: string | null
          source_id?: string | null
          started_at?: string | null
          status?: string | null
          total_steps?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_jobs_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "v_document_stats"
            referencedColumns: ["notebook_id"]
          },
          {
            foreignKeyName: "processing_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      report_generations: {
        Row: {
          additional_context: string | null
          address: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          file_format: string | null
          file_path: string | null
          file_size: number | null
          generated_content: string | null
          id: string
          llm_config: Json | null
          llm_model: string
          llm_provider: string
          metadata: Json | null
          notebook_id: string | null
          progress: number | null
          started_at: string | null
          status: string | null
          template_id: string | null
          title: string
          topic: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          additional_context?: string | null
          address?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          file_format?: string | null
          file_path?: string | null
          file_size?: number | null
          generated_content?: string | null
          id?: string
          llm_config?: Json | null
          llm_model: string
          llm_provider: string
          metadata?: Json | null
          notebook_id?: string | null
          progress?: number | null
          started_at?: string | null
          status?: string | null
          template_id?: string | null
          title: string
          topic: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          additional_context?: string | null
          address?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          file_format?: string | null
          file_path?: string | null
          file_size?: number | null
          generated_content?: string | null
          id?: string
          llm_config?: Json | null
          llm_model?: string
          llm_provider?: string
          metadata?: Json | null
          notebook_id?: string | null
          progress?: number | null
          started_at?: string | null
          status?: string | null
          template_id?: string | null
          title?: string
          topic?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_generations_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_generations_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "v_document_stats"
            referencedColumns: ["notebook_id"]
          },
          {
            foreignKeyName: "report_generations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      report_sections: {
        Row: {
          chunks_retrieved: string[] | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          generated_content: string | null
          id: string
          metadata: Json | null
          query_used: string | null
          report_generation_id: string | null
          retrieval_scores: number[] | null
          section_name: string
          section_order: number
          started_at: string | null
          status: string | null
          subsection_name: string | null
          word_count: number | null
        }
        Insert: {
          chunks_retrieved?: string[] | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          generated_content?: string | null
          id?: string
          metadata?: Json | null
          query_used?: string | null
          report_generation_id?: string | null
          retrieval_scores?: number[] | null
          section_name: string
          section_order: number
          started_at?: string | null
          status?: string | null
          subsection_name?: string | null
          word_count?: number | null
        }
        Update: {
          chunks_retrieved?: string[] | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          generated_content?: string | null
          id?: string
          metadata?: Json | null
          query_used?: string | null
          report_generation_id?: string | null
          retrieval_scores?: number[] | null
          section_name?: string
          section_order?: number
          started_at?: string | null
          status?: string | null
          subsection_name?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "report_sections_report_generation_id_fkey"
            columns: ["report_generation_id"]
            isOneToOne: false
            referencedRelation: "report_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          default_config: Json | null
          description: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string
          structure: Json
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          default_config?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name: string
          structure: Json
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          default_config?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string
          structure?: Json
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      sources: {
        Row: {
          chunk_count: number | null
          created_at: string | null
          display_name: string | null
          embedding_count: number | null
          extracted_metadata: Json | null
          file_hash: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          metadata_extracted: boolean | null
          mime_type: string | null
          notebook_id: string | null
          page_count: number | null
          processing_completed_at: string | null
          processing_error: string | null
          processing_started_at: string | null
          processing_status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          chunk_count?: number | null
          created_at?: string | null
          display_name?: string | null
          embedding_count?: number | null
          extracted_metadata?: Json | null
          file_hash?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          metadata_extracted?: boolean | null
          mime_type?: string | null
          notebook_id?: string | null
          page_count?: number | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          processing_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          chunk_count?: number | null
          created_at?: string | null
          display_name?: string | null
          embedding_count?: number | null
          extracted_metadata?: Json | null
          file_hash?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          metadata_extracted?: boolean | null
          mime_type?: string | null
          notebook_id?: string | null
          page_count?: number | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          processing_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "v_document_stats"
            referencedColumns: ["notebook_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          organization: string | null
          preferences: Json | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          organization?: string | null
          preferences?: Json | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          organization?: string | null
          preferences?: Json | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_active_jobs: {
        Row: {
          completed_at: string | null
          config: Json | null
          created_at: string | null
          current_step: string | null
          error_details: Json | null
          error_message: string | null
          file_name: string | null
          id: string | null
          job_type: string | null
          max_retries: number | null
          notebook_id: string | null
          notebook_name: string | null
          progress: number | null
          result: Json | null
          retry_count: number | null
          scheduled_at: string | null
          source_id: string | null
          started_at: string | null
          status: string | null
          total_steps: number | null
          updated_at: string | null
          user_email: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_jobs_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "v_document_stats"
            referencedColumns: ["notebook_id"]
          },
          {
            foreignKeyName: "processing_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      v_document_stats: {
        Row: {
          chunk_count: number | null
          embedding_count: number | null
          last_upload: string | null
          notebook_id: string | null
          notebook_name: string | null
          source_count: number | null
          total_file_size: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      get_metadata_field_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          field_id: string
          field_name: string
          occurrence_count: number
          avg_confidence: number
          unique_values_count: number
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      match_embeddings: {
        Args: {
          query_embedding: string
          match_count?: number
          filter_notebook_id?: string
          filter_source_ids?: string[]
          similarity_threshold?: number
        }
        Returns: {
          chunk_id: string
          content: string
          similarity: number
          metadata: Json
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
