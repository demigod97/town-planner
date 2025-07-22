# Comprehensive Jira Issues Breakdown - Town Planning RAG System

## Epic Structure

### EPIC-001: Town Planning RAG System Development
**Description:** Complete development of AI-powered town planning assistant with PDF processing, metadata extraction, and report generation capabilities.

---

## Phase 1: Database & Infrastructure Setup

### TP-001: Database Schema Migration
**Type:** Task  
**Priority:** Highest  
**Story Points:** 8  
**Assignee:** Backend Developer  

**Description:**
Implement complete database schema for town planning RAG system including all tables, indexes, functions, and policies.

**Acceptance Criteria:**
- [ ] All new tables created (pdf_metadata, report_templates, report_generations, chunks_metadata, report_sections, chat_sessions, chat_messages)
- [ ] Enhanced existing tables (notebooks, sources) with new columns
- [ ] All indexes created for optimal performance
- [ ] RLS policies implemented for multi-tenant security
- [ ] Database functions created (match_documents, get_report_status, etc.)
- [ ] Sample report templates inserted
- [ ] Migration script tested on staging environment

**Technical Requirements:**
- PostgreSQL with vector extension
- Proper foreign key constraints
- Optimized indexes for vector searches
- Row-level security policies

**Definition of Done:**
- [ ] Migration script runs successfully
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Code reviewed and approved

---

### TP-002: Supabase Storage Configuration
**Type:** Task  
**Priority:** High  
**Story Points:** 3  
**Assignee:** Backend Developer  

**Description:**
Set up Supabase storage buckets and policies for PDF files and generated reports.

**Acceptance Criteria:**
- [ ] 'sources' bucket created for PDF storage
- [ ] 'reports' bucket created for generated reports
- [ ] Storage policies configured for authenticated access
- [ ] File upload size limits configured
- [ ] CORS policies set up correctly

**Definition of Done:**
- [ ] Buckets created and configured
- [ ] Policies tested with different user roles
- [ ] File upload/download working correctly

---

### TP-003: Environment Configuration Setup
**Type:** Task  
**Priority:** High  
**Story Points:** 2  
**Assignee:** DevOps/Backend Developer  

**Description:**
Configure all required environment variables and secrets for the system.

**Acceptance Criteria:**
- [ ] Supabase secrets configured (LLAMACLOUD_API_KEY, OLLAMA_BASE_URL, N8N_WEBHOOK_BASE_URL)
- [ ] Local environment template created
- [ ] Production environment variables documented
- [ ] Secure secret management implemented
- [ ] Environment validation added

**Definition of Done:**
- [ ] All secrets securely stored
- [ ] Environment variables documented
- [ ] Validation scripts working

---

## Phase 2: External Service Integration

### TP-004: LlamaCloud API Integration
**Type:** Story  
**Priority:** Highest  
**Story Points:** 13  
**Assignee:** Backend Developer  

**Description:**
Integrate LlamaCloud API for advanced PDF parsing and metadata extraction.

**Acceptance Criteria:**
- [ ] LlamaCloud API client implemented
- [ ] PDF upload and parsing functionality
- [ ] Metadata extraction patterns implemented
- [ ] Error handling and retry logic
- [ ] Timeout and rate limiting handled
- [ ] Response validation and sanitization

**Technical Requirements:**
- Handle various PDF formats
- Extract specific metadata fields (prepared_for, prepared_by, address, etc.)
- Structured content output in markdown format
- Robust error handling
- Async processing support

**Subtasks:**
- TP-004.1: API client implementation
- TP-004.2: Metadata extraction patterns
- TP-004.3: Error handling and retries
- TP-004.4: Testing with sample PDFs

---

### TP-005: Ollama Local Model Integration
**Type:** Story  
**Priority:** High  
**Story Points:** 8  
**Assignee:** Backend Developer  

**Description:**
Set up and integrate Ollama for local LLM and embedding model serving.

**Acceptance Criteria:**
- [ ] Ollama server configured and running
- [ ] Required models downloaded (qwen3:8b-q4_K_M, nomic-embed-text)
- [ ] API client for embeddings implemented
- [ ] API client for text generation implemented
- [ ] Performance monitoring added
- [ ] Health checks implemented

**Subtasks:**
- TP-005.1: Ollama server setup
- TP-005.2: Model download and configuration
- TP-005.3: Embedding API integration
- TP-005.4: Text generation API integration

---

### TP-006: n8n Workflow Integration
**Type:** Story  
**Priority:** High  
**Story Points:** 8  
**Assignee:** Backend Developer  

**Description:**
Update existing n8n workflows and create new ones for enhanced PDF processing and report generation.

**Acceptance Criteria:**
- [ ] Enhanced PDF processing workflow updated
- [ ] New report generation workflow created
- [ ] Webhook endpoints configured
- [ ] Authentication set up between systems
- [ ] Error handling and monitoring added

**Subtasks:**
- TP-006.1: Update existing PDF processing workflow
- TP-006.2: Create report generation workflow
- TP-006.3: Configure webhook authentication
- TP-006.4: Add monitoring and error handling

---

## Phase 3: Core Edge Functions Development

### TP-007: Process PDF with Metadata Edge Function
**Type:** Story  
**Priority:** Highest  
**Story Points:** 21  
**Assignee:** Backend Developer  

**Description:**
Implement the core edge function that processes PDFs using LlamaCloud and extracts metadata.

**Acceptance Criteria:**
- [ ] Edge function deployed and accessible
- [ ] LlamaCloud integration working
- [ ] Metadata extraction implemented
- [ ] Semantic chunking functionality
- [ ] Database storage of metadata and chunks
- [ ] n8n workflow triggering
- [ ] Comprehensive error handling
- [ ] Performance optimization

**Technical Requirements:**
- Handle large PDF files (up to 100MB)
- Extract all required metadata fields
- Perform semantic chunking
- Store chunk metadata with relationships
- Update source processing status
- Trigger vector embedding workflow

**Subtasks:**
- TP-007.1: Core function structure and routing
- TP-007.2: LlamaCloud API integration
- TP-007.3: Metadata extraction logic
- TP-007.4: Semantic chunking implementation
- TP-007.5: Database storage operations
- TP-007.6: n8n workflow triggering
- TP-007.7: Error handling and logging
- TP-007.8: Performance optimization
- TP-007.9: Unit and integration testing

---

### TP-008: Batch Vector Search Edge Function
**Type:** Story  
**Priority:** High  
**Story Points:** 13  
**Assignee:** Backend Developer  

**Description:**
Implement efficient batch vector search functionality for multiple queries.

**Acceptance Criteria:**
- [ ] Batch embedding generation
- [ ] Parallel vector searches
- [ ] Notebook-based filtering
- [ ] Results aggregation and formatting
- [ ] Performance optimization
- [ ] Error handling for individual query failures

**Subtasks:**
- TP-008.1: Batch embedding generation
- TP-008.2: Parallel search implementation
- TP-008.3: Results formatting and aggregation
- TP-008.4: Performance testing and optimization

---

### TP-009: Generate Report Edge Function
**Type:** Story  
**Priority:** Highest  
**Story Points:** 21  
**Assignee:** Backend Developer  

**Description:**
Implement the main report generation orchestration function.

**Acceptance Criteria:**
- [ ] Report generation record creation
- [ ] Template structure loading
- [ ] Query generation for sections
- [ ] Background processing triggering
- [ ] Status tracking implementation
- [ ] Error handling and rollback

**Subtasks:**
- TP-009.1: Report generation record management
- TP-009.2: Template structure processing
- TP-009.3: Query generation logic
- TP-009.4: Background processing coordination
- TP-009.5: Status tracking and updates
- TP-009.6: Error handling and recovery

---

### TP-010: Process Report Sections Edge Function
**Type:** Story  
**Priority:** High  
**Story Points:** 21  
**Assignee:** Backend Developer  

**Description:**
Implement the background processing function that generates individual report sections.

**Acceptance Criteria:**
- [ ] Section-by-section processing
- [ ] Vector search integration
- [ ] Ollama content generation
- [ ] Progress tracking
- [ ] Final report assembly
- [ ] File storage and management

**Subtasks:**
- TP-010.1: Section processing loop
- TP-010.2: Vector search integration
- TP-010.3: Content generation with Ollama
- TP-010.4: Progress tracking implementation
- TP-010.5: Report assembly logic
- TP-010.6: File storage and URL generation

---

## Phase 4: Frontend Development

### TP-011: Enhanced PDF Upload Interface
**Type:** Story  
**Priority:** High  
**Story Points:** 13  
**Assignee:** Frontend Developer  

**Description:**
Enhance the existing PDF upload interface to support metadata extraction and processing status.

**Acceptance Criteria:**
- [ ] Drag and drop file upload
- [ ] Processing status indicators
- [ ] Metadata display after extraction
- [ ] Error handling and user feedback
- [ ] File format validation
- [ ] Progress tracking

**Subtasks:**
- TP-011.1: Enhanced upload component
- TP-011.2: Processing status tracking
- TP-011.3: Metadata display interface
- TP-011.4: Error handling and validation

---

### TP-012: Report Generation Interface
**Type:** Story  
**Priority:** Highest  
**Story Points:** 21  
**Assignee:** Frontend Developer  

**Description:**
Create a comprehensive interface for report generation with template selection and parameter input.

**Acceptance Criteria:**
- [ ] Template selection dropdown
- [ ] Topic and address input fields
- [ ] Additional context text area
- [ ] Report generation triggering
- [ ] Real-time status updates
- [ ] Progress visualization

**Subtasks:**
- TP-012.1: Template selection component
- TP-012.2: Parameter input forms
- TP-012.3: Generation triggering logic
- TP-012.4: Status tracking interface
- TP-012.5: Progress visualization
- TP-012.6: Error handling and feedback

---

### TP-013: Report Management Dashboard
**Type:** Story  
**Priority:** High  
**Story Points:** 13  
**Assignee:** Frontend Developer  

**Description:**
Create a dashboard for managing generated reports with download and preview capabilities.

**Acceptance Criteria:**
- [ ] Report list with status indicators
- [ ] Download functionality
- [ ] Report preview capability
- [ ] Search and filtering
- [ ] Status updates in real-time
- [ ] Regeneration options

**Subtasks:**
- TP-013.1: Report listing component
- TP-013.2: Download and preview functionality
- TP-013.3: Search and filtering features
- TP-013.4: Real-time status updates

---

### TP-014: Enhanced Chat Interface
**Type:** Story  
**Priority:** Medium  
**Story Points:** 13  
**Assignee:** Frontend Developer  

**Description:**
Enhance the existing chat interface to support report generation and better context display.

**Acceptance Criteria:**
- [ ] Report generation intent detection
- [ ] Context-aware responses
- [ ] Citation display improvements
- [ ] Chat session management
- [ ] Export chat functionality

**Subtasks:**
- TP-014.1: Report generation integration
- TP-014.2: Enhanced citation display
- TP-014.3: Session management features
- TP-014.4: Export functionality

---

### TP-015: Document Overview Dashboard
**Type:** Story  
**Priority:** Medium  
**Story Points:** 8  
**Assignee:** Frontend Developer  

**Description:**
Create a dashboard showing document overview with extracted metadata and processing status.

**Acceptance Criteria:**
- [ ] Document grid with metadata cards
- [ ] Processing status indicators
- [ ] Metadata filtering and search
- [ ] Bulk operations support
- [ ] Document details view

**Subtasks:**
- TP-015.1: Document grid component
- TP-015.2: Metadata display cards
- TP-015.3: Filtering and search functionality
- TP-015.4: Document details modal

---

## Phase 5: System Integration & Testing

### TP-016: End-to-End Integration Testing
**Type:** Story  
**Priority:** High  
**Story Points:** 13  
**Assignee:** QA Engineer  

**Description:**
Comprehensive testing of the entire system flow from PDF upload to report generation.

**Acceptance Criteria:**
- [ ] PDF upload and processing flow tested
- [ ] Metadata extraction accuracy verified
- [ ] Report generation flow tested
- [ ] Vector search performance validated
- [ ] Error scenarios tested
- [ ] Performance benchmarks established

**Test Scenarios:**
- Various PDF formats and sizes
- Different report templates
- Edge cases and error conditions
- Performance with large document sets
- Concurrent user operations

---

### TP-017: Performance Optimization
**Type:** Story  
**Priority:** High  
**Story Points:** 13  
**Assignee:** Backend Developer  

**Description:**
Optimize system performance for handling large document sets and concurrent operations.

**Acceptance Criteria:**
- [ ] Database query optimization
- [ ] Vector search performance tuning
- [ ] Caching implementation
- [ ] Background job optimization
- [ ] Memory usage optimization
- [ ] API response time improvements

**Subtasks:**
- TP-017.1: Database query optimization
- TP-017.2: Vector search tuning
- TP-017.3: Caching layer implementation
- TP-017.4: Background processing optimization

---

### TP-018: Security Audit and Hardening
**Type:** Story  
**Priority:** High  
**Story Points:** 8  
**Assignee:** Security Engineer  

**Description:**
Comprehensive security review and hardening of the system.

**Acceptance Criteria:**
- [ ] RLS policies audit
- [ ] API security review
- [ ] Data encryption verification
- [ ] Access control testing
- [ ] Vulnerability scanning
- [ ] Security documentation

---

## Phase 6: Documentation & Deployment

### TP-019: System Documentation
**Type:** Task  
**Priority:** Medium  
**Story Points:** 8  
**Assignee:** Technical Writer  

**Description:**
Create comprehensive system documentation for users and administrators.

**Acceptance Criteria:**
- [ ] User guide for report generation
- [ ] Administrator setup guide
- [ ] API documentation
- [ ] Troubleshooting guide
- [ ] System architecture documentation

---

### TP-020: Production Deployment
**Type:** Task  
**Priority:** High  
**Story Points:** 13  
**Assignee:** DevOps Engineer  

**Description:**
Deploy the system to production environment with proper monitoring and backup.

**Acceptance Criteria:**
- [ ] Production environment setup
- [ ] Database migration to production
- [ ] Edge functions deployment
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery procedures
- [ ] Performance monitoring setup

---

## Phase 7: Advanced Features

### TP-021: Advanced Report Templates
**Type:** Story  
**Priority:** Medium  
**Story Points:** 13  
**Assignee:** Business Analyst + Backend Developer  

**Description:**
Create additional specialized report templates for different planning scenarios.

**Acceptance Criteria:**
- [ ] Environmental Impact Assessment template
- [ ] Traffic Impact Assessment template
- [ ] Heritage Conservation Management template
- [ ] Subdivision Planning template
- [ ] Zoning Compliance template

---

### TP-022: Report Template Editor
**Type:** Story  
**Priority:** Low  
**Story Points:** 21  
**Assignee:** Full Stack Developer  

**Description:**
Create an interface for administrators to create and edit report templates.

**Acceptance Criteria:**
- [ ] Template structure editor
- [ ] Section and subsection management
- [ ] Query customization interface
- [ ] Template testing functionality
- [ ] Version control for templates

---

### TP-023: Advanced Analytics Dashboard
**Type:** Story  
**Priority:** Low  
**Story Points:** 13  
**Assignee:** Frontend Developer  

**Description:**
Create analytics dashboard showing system usage, processing statistics, and performance metrics.

**Acceptance Criteria:**
- [ ] Document processing statistics
- [ ] Report generation metrics
- [ ] User activity analytics
- [ ] System performance monitoring
- [ ] Custom date range filtering

---

### TP-024: API Rate Limiting and Monitoring
**Type:** Story  
**Priority:** Medium  
**Story Points:** 8  
**Assignee:** Backend Developer  

**Description:**
Implement comprehensive API rate limiting and monitoring for external service usage.

**Acceptance Criteria:**
- [ ] Rate limiting for LlamaCloud API
- [ ] Usage monitoring for Ollama
- [ ] Cost tracking for external services
- [ ] Alert system for quota limits
- [ ] Usage analytics dashboard

---

## Bugs and Technical Debt

### TP-025: Frontend-Backend Integration Issues
**Type:** Bug  
**Priority:** High  
**Story Points:** 5  
**Assignee:** Full Stack Developer  

**Description:**
Fix existing integration issues between frontend and Supabase/n8n backend mentioned in the repository.

**Acceptance Criteria:**
- [ ] Supabase connection properly configured
- [ ] n8n webhook endpoints working
- [ ] Authentication flow fixed
- [ ] Data synchronization issues resolved

---

### TP-026: Existing Workflow Enhancement
**Type:** Task  
**Priority:** Medium  
**Story Points:** 8  
**Assignee:** Backend Developer  

**Description:**
Enhance existing n8n workflows to work with the new system architecture.

**Acceptance Criteria:**
- [ ] Chat workflow updated for new schema
- [ ] Extract text workflow enhanced
- [ ] Generate notebook details workflow improved
- [ ] Process additional sources workflow updated

---

## Story Point Summary

**Total Story Points: 312**

- **Phase 1 (Infrastructure):** 13 points
- **Phase 2 (External Services):** 37 points  
- **Phase 3 (Core Functions):** 76 points
- **Phase 4 (Frontend):** 68 points
- **Phase 5 (Integration/Testing):** 34 points
- **Phase 6 (Documentation/Deployment):** 21 points
- **Phase 7 (Advanced Features):** 55 points
- **Bugs/Technical Debt:** 13 points

## Recommended Sprint Planning

### Sprint 1 (2 weeks): Foundation
- TP-001: Database Schema Migration
- TP-002: Supabase Storage Configuration  
- TP-003: Environment Configuration Setup
- TP-025: Frontend-Backend Integration Issues

### Sprint 2 (2 weeks): External Integrations
- TP-004: LlamaCloud API Integration
- TP-005: Ollama Local Model Integration

### Sprint 3 (2 weeks): Core Edge Functions (Part 1)
- TP-007: Process PDF with Metadata Edge Function

### Sprint 4 (2 weeks): Core Edge Functions (Part 2)  
- TP-008: Batch Vector Search Edge Function
- TP-009: Generate Report Edge Function

### Sprint 5 (2 weeks): Core Edge Functions (Part 3)
- TP-010: Process Report Sections Edge Function
- TP-006: n8n Workflow Integration

### Sprint 6 (2 weeks): Frontend Development (Part 1)
- TP-011: Enhanced PDF Upload Interface
- TP-012: Report Generation Interface

### Sprint 7 (2 weeks): Frontend Development (Part 2)
- TP-013: Report Management Dashboard
- TP-014: Enhanced Chat Interface
- TP-015: Document Overview Dashboard

### Sprint 8 (2 weeks): Integration & Testing
- TP-016: End-to-End Integration Testing
- TP-017: Performance Optimization
- TP-026: Existing Workflow Enhancement

### Sprint 9 (2 weeks): Security & Deployment
- TP-018: Security Audit and Hardening
- TP-019: System Documentation  
- TP-020: Production Deployment

This breakdown ensures comprehensive coverage of all system components while maintaining manageable sprint sizes and logical dependencies.