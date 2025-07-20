# GEMINI.MD - AI Agent Development Guide

## 📋 Project Overview

**HHLM (Town Planning AI Assistant)** is a comprehensive RAG (Retrieval-Augmented Generation) system designed for town planning firms. The system enables natural language querying of 20,000+ PDF documents and generates permit application templates through AI-powered workflows.

### Current State
- **Phase**: Proof of Concept (PoC) / Development
- **Document Scope**: 100-500 PDFs for validation, scaling to 20,000+
- **Goal**: Validate RAG vs fine-tuning approaches with <5s response latency.
- **Platform**: Built on Lovable.dev initially, now transitioning to self-hosted infrastructure with a complete backend setup.

### Key Capabilities
- ✅ Natural language chat interface for document queries
- ✅ PDF document ingestion and processing
- ✅ User authentication and session management
- ✅ Chat session persistence
- 🔧 AI-powered permit template generation (in development)
- 🔧 n8n workflow automation (partially implemented)
- 🔧 Vector search and RAG implementation (in development)

---

## 🛠️ Tech Stack

### Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5.4.1
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React Context + Local Storage
- **Routing**: React Router DOM 6.26.2
- **HTTP Client**: Native `fetch` API
- **File Upload**: React Dropzone
- **Icons**: Lucide React

### Backend & Infrastructure
- **Database**: Supabase (PostgreSQL with `pgvector` extension)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (for PDF files)
- **Edge Functions**: Supabase Edge Functions (Deno runtime)
- **Workflow Engine**: n8n automation platform
- **AI/LLM**: OpenAI API / Ollama (configurable via environment variables)

### Development Tools
- **Linting**: ESLint with TypeScript support
- **Testing**: Cypress (for E2E and component testing)
- **Package Manager**: npm
- **Code Quality**: TypeScript strict mode (relaxed configuration)
- **Automation**: Node.js scripts for task automation and health checks.

---

## 📁 Project Structure

```
hhlm/
├── .automation/                # Development automation scripts
├── .claude/                    # Configuration for Claude/Gemini AI agents
├── claude-tasks/               # Scripts for AI-driven development tasks
├── src/                        # React frontend application
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui base components
│   │   ├── ChatStream.tsx      # Main chat interface
│   │   ├── SettingsModal.tsx   # Configuration panel
│   │   └── SourcesSidebar.tsx  # PDF management sidebar
│   ├── hooks/                  # Custom React hooks (useSettings, useAuth, etc.)
│   ├── lib/                    # Utilities & API layer (api.ts, supabase.ts)
│   └── pages/                  # Route components
├── supabase/                   # Supabase backend configuration
│   ├── functions/              # Edge Functions (n8n-proxy, trigger-n8n, etc.)
│   └── migrations/             # Database migrations
├── DOC/                        # Project documentation
├── public/                     # Static assets
└── TASKS.md                    # Main task backlog
```

---

## 🏗️ Development Guidelines

### Component Development Standards
- **File Naming**:
    - Components: `PascalCase.tsx` (e.g., `ChatStream.tsx`)
    - Hooks: `useCamelCase.tsx` (e.g., `useSettings.tsx`)
    - Utilities: `camelCase.ts` (e.g., `api.ts`)
- **Styling**: Use Tailwind CSS for styling. Leverage `shadcn/ui` for core UI components.
- **State Management**: Prefer local state (`useState`). Use React Context for shared state (`useSettings`, `useSession`).

### API Service Standards
- **Proxy Pattern**: All external API calls (n8n, AI/LLM) **must** be routed through Supabase Edge Functions for security and centralization. The primary proxy is `n8n-proxy`.
- **Error Handling**: Implement robust `try...catch` blocks for all asynchronous operations and API calls. Use UI toasts to provide user feedback on errors.

---

## ⚙️ Environment Setup

### Prerequisites
- Node.js (18+)
- npm
- Docker (for local n8n/Ollama)
- Supabase account

### Installation Steps

1.  **Clone Repository**: `git clone <repository-url>`
2.  **Install Dependencies**: `npm install`
3.  **Environment Configuration**:
    -   Copy `.env.example` to `.env.local`.
    -   Fill in the required values:
        ```bash
        # Core Supabase Configuration (Required)
        VITE_SUPABASE_URL=https://your-project.supabase.co
        VITE_SUPABASE_ANON_KEY=your-anon-key

        # n8n Workflow Integration (Required)
        VITE_N8N_BASE_URL=http://localhost:5678
        VITE_N8N_API_KEY=your-n8n-api-key
        # Webhook URLs are typically derived from the base URL in the app
        
        # AI/LLM Configuration (Choose one)
        VITE_LLM_PROVIDER=OPENAI # or OLLAMA
        VITE_OPENAI_API_KEY=your-openai-key
        VITE_OLLAMA_BASE_URL=http://localhost:11434
        ```
4.  **Database Setup**:
    -   Link the project to your Supabase instance: `supabase link --project-ref <your-project-ref>`
    -   Push the database schema and migrations: `supabase db push`
    -   Alternatively, run the consolidated schema file: `psql -h <db_host> -U postgres -d postgres -f complete-database-schema.sql`
5.  **Start Development Server**: `npm run dev`

---

## 🚀 Development & Debugging Workflow

### 1. Understand the Goal
- Review the main objective in `README.md`.
- Check the active tasks and critical issues in `TASKS.md`.

### 2. Check System Health
- Before starting, run the health check to ensure all services are operational.
    ```bash
    npm run claude:health 
    ```
    *(Note: The `claude:*` scripts are now used for Gemini agent tasks).*

### 3. Identify Relevant Files
- Use the project structure and file descriptions in this document to locate relevant files.
- For debugging, start with the UI component, then trace the logic through hooks, API libraries (`src/lib/api.ts`), and finally to the Supabase Edge Function.

### 4. Debugging Steps
A typical debugging process for a critical issue (e.g., "Chat send button not working"):

1.  **Frontend Analysis**:
    -   Check the browser's developer console for any client-side errors.
    -   Inspect the Network tab to see the request being made to the Supabase Edge Function (`/functions/v1/n8n-proxy/chat`). Verify the payload and headers.
    -   Add `console.log` statements in the relevant React component (`ChatStream.tsx`) and API call function (`src/lib/api.ts`) to trace the data flow.

2.  **Edge Function Analysis**:
    -   Check the logs for the specific Edge Function.
        ```bash
        npm run functions:logs:n8n-proxy
        ```
    -   Add `console.log` statements within the Edge Function (`supabase/functions/n8n-proxy/index.ts`) to inspect the incoming request, environment variables, and the request being forwarded to n8n.
    -   Deploy the updated function: `npm run functions:deploy:n8n-proxy`.

3.  **Backend Service Analysis (n8n)**:
    -   Check the n8n workflow execution logs to see if it received the request from the Edge Function.
    -   Use a tool like `curl` or Postman to send a direct request to the n8n webhook URL to isolate the issue.

### 5. Implement Changes
- Adhere strictly to the coding conventions outlined in this document and `AGENTS.MD`.
- Modify existing code rather than introducing new patterns unless necessary.

---

## 🧪 Testing

### E2E Testing
- Cypress is used for End-to-End testing.
- Run tests interactively: `npx cypress open`
- Run tests headlessly: `npx cypress run`
- Test files are located in `cypress/e2e/`.

### Integration & Health Checks
- Use the provided npm scripts to validate integrations and service health.
    - `npm run test:supabase`: Tests Supabase integration.
    - `npm run claude:check`: Validates the project setup for AI agent development.
    - `npm run claude:health`: Checks Supabase and n8n service status.

### Manual Testing Steps for Core Features

1.  **Settings Configuration**:
    -   Open the Settings modal.
    -   Enter valid and invalid credentials for n8n and the chosen LLM provider.
    -   Verify that the "Test Connection" button provides accurate feedback.
    -   Confirm that settings are persisted in `localStorage`.

2.  **File Upload and Processing**:
    -   Upload a PDF file via the "Sources" sidebar.
    -   Verify the file appears in the Supabase Storage bucket.
    -   Check the `hh_uploads` table for a new entry.
    -   **(Critical)** Confirm that the `n8n-proxy` ingest workflow is triggered. Check for processing status updates in the UI (Note: This is a planned feature).

3.  **Chat Functionality**:
    -   Send a message in the chat.
    -   Verify the request is sent to the `n8n-proxy` chat endpoint.
    -   Confirm the n8n chat workflow executes and returns a response.
    -   Check that the `hh_chat_messages` table is updated with the user message and the assistant's response (Note: This is a planned feature).

---

## 🗄️ Database

The full database schema is defined in `complete-database-schema.sql`.

### Key Tables:
-   `hh_chat_sessions`: Stores metadata for each chat conversation.
-   `hh_chat_messages`: Stores the history of messages for each session.
-   `hh_uploads`: Tracks uploaded PDF files.
-   `hh_pdf_vectors`: Stores text chunks and their vector embeddings for RAG.
-   `user_profiles`: Manages user data.

### Migrations
- Database changes should be managed via Supabase migrations in the `supabase/migrations` directory.
- Apply migrations using `supabase db push`.

---

##  critical_tasks

The primary task list is maintained in `TASKS.md`.

### Current Critical Issues:
1.  **Chat Send Button Not Working**: The button does not trigger the n8n workflow. Debugging should follow the path: `ChatStream.tsx` -> `api.ts` -> `n8n-proxy` function -> `n8n` workflow.
2.  **File Upload Not Triggering Processing**: Uploads are successful, but the n8n ingest workflow is not initiated.
3.  **Settings Not Working**: The settings modal saves to `localStorage`, but the values are not being used in API calls. The connection test gives false positives.

*This document should be treated as the primary source of truth for Gemini agent development on the HHLM project.*
