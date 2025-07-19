# AGENTS.MD - AI Agent Development Guide

## 📋 Project Overview

**HHLM (Town Planning AI Assistant)** is a comprehensive RAG (Retrieval-Augmented Generation) system designed for town planning firms. The system enables natural language querying of 20,000+ PDF documents and generates permit application templates through AI-powered workflows.

### Current State
- **Phase**: Proof of Concept (PoC) 
- **Document Scope**: 100-500 PDFs for validation
- **Goal**: Validate RAG vs fine-tuning approaches with <5s response latency
- **Platform**: Built on Lovable.dev initially, now transitioning to self-hosted infrastructure

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
- **HTTP Client**: Native fetch API
- **File Upload**: React Dropzone
- **Icons**: Lucide React

### Backend & Infrastructure
- **Database**: Supabase (PostgreSQL with vector extensions)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (PDF files)
- **Edge Functions**: Supabase Edge Functions (Deno runtime)
- **Workflow Engine**: n8n automation platform
- **AI/LLM**: OpenAI API / Ollama (configurable)

### Development Tools
- **Linting**: ESLint with TypeScript support
- **Testing**: Cypress (E2E and component testing)
- **Package Manager**: npm
- **Code Quality**: TypeScript strict mode (relaxed configuration)

---

## 📁 Project Structure

```
hhlm/
├── src/                          # React frontend application
│   ├── components/               # React components
│   │   ├── ui/                  # shadcn/ui base components
│   │   ├── ChatStream.tsx       # Main chat interface
│   │   ├── SettingsModal.tsx    # Configuration panel
│   │   └── SourcesSidebar.tsx   # PDF management sidebar
│   ├── hooks/                   # Custom React hooks
│   │   ├── useSettings.tsx      # Settings context & persistence
│   │   ├── useAuth.ts          # Supabase authentication
│   │   └── useSession.tsx      # Chat session management
│   ├── lib/                     # Utilities & API layer
│   │   ├── api.ts              # Proxy function calls
│   │   ├── utils.ts            # Helper utilities
│   │   └── supabase.ts         # Supabase client setup
│   ├── pages/                   # Route components
│   └── types/                   # TypeScript type definitions
├── supabase/                    # Supabase configuration
│   ├── functions/              # Edge functions
│   │   └── proxy/              # API proxy router
│   └── migrations/             # Database migrations
├── DOC/                        # Project documentation
│   └── schemas/               # Database schema docs
├── public/                     # Static assets
│   └── lottie/                # Animation files
├── .github/                    # GitHub workflows
└── scripts/                    # Build and utility scripts
```

---

## 🏗️ Development Guidelines

### Component Development Standards

#### File Naming Conventions
- **Components**: PascalCase (e.g., `ChatStream.tsx`, `SettingsModal.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useSettings.tsx`, `useAuth.ts`)
- **Utilities**: camelCase (e.g., `api.ts`, `utils.ts`)
- **Types**: PascalCase interfaces/types (e.g., `ChatMessage`, `SessionData`)

#### Component Structure
```typescript
// Standard component template
import React from 'react';
import { SomeType } from '@/types';

interface ComponentProps {
  prop1: string;
  prop2?: number;
}

export const ComponentName: React.FC<ComponentProps> = ({ 
  prop1, 
  prop2 = defaultValue 
}) => {
  // Component logic here
  
  return (
    <div className="tailwind-classes">
      {/* JSX content */}
    </div>
  );
};
```

#### Styling Guidelines
- **Primary CSS Framework**: Tailwind CSS with custom design tokens
- **Component Library**: shadcn/ui for consistent UI components
- **Theme Variables**: CSS custom properties defined in `src/index.css`
- **Responsive Design**: Mobile-first approach using Tailwind breakpoints

### State Management Standards

#### Settings Management
```typescript
// useSettings hook pattern
interface Settings {
  chatUrl: string;
  ingestUrl: string;
  templateUrl: string;
  n8nBaseUrl: string;
  llmProvider: 'OPENAI' | 'OLLAMA';
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
}

// Persist to localStorage automatically
const { settings, updateSettings } = useSettings();
```

#### Session Management
```typescript
// Chat session pattern
const { 
  currentSession, 
  sessions, 
  createSession, 
  updateSession 
} = useSession();
```

#### Authentication State
```typescript
// Supabase auth integration
const { user, signIn, signOut, loading } = useAuth();
```

### API Service Standards

#### Proxy Pattern
All external API calls go through Supabase Edge Functions for security:

```typescript
// src/lib/api.ts
export const proxyRequest = async (
  endpoint: string, 
  data: any
): Promise<Response> => {
  return fetch(`/functions/v1/proxy/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};
```

#### Error Handling
```typescript
// Consistent error handling pattern
try {
  const response = await proxyRequest('chat', payload);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return await response.json();
} catch (error) {
  console.error('Request failed:', error);
  throw error;
}
```

---

## ⚙️ Environment Setup

### Required Environment Variables

```bash
# Core Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# n8n Workflow Integration
VITE_N8N_CHAT_WEBHOOK=http://localhost:5678/webhook/chat
VITE_N8N_INGEST_URL=http://localhost:5678/webhook/ingest
VITE_N8N_TEMPLATE_URL=http://localhost:5678/webhook/template
VITE_N8N_BASE_URL=http://localhost:5678
VITE_N8N_API_KEY=your-n8n-api-key

# AI/LLM Configuration
VITE_LLM_PROVIDER=OPENAI  # or OLLAMA
VITE_OPENAI_API_KEY=your-openai-key (if using OpenAI)
VITE_OLLAMA_BASE_URL=http://localhost:11434 (if using Ollama)
```

### Installation Steps

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd hhlm
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your actual values
   ```

4. **Database Setup**
   ```bash
   # Ensure Supabase project is created
   # Run migrations (if using local Supabase)
   supabase db reset
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   # Application available at http://localhost:8080
   ```

---

## 🗄️ Database Schema

### Core Tables

#### `hh_chat_sessions`
```sql
CREATE TABLE public.hh_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'New Chat',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `hh_uploads`
```sql
CREATE TABLE public.hh_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  file_path TEXT,
  file_size BIGINT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Planned Schema Extensions
- `hh_chat_messages` - Chat history storage
- `hh_templates` - Generated permit templates  
- `hh_pdf_vectors` - Document embeddings for RAG
- `hh_telemetry` - Usage analytics

### Storage Buckets
- **`hh_pdf_library`**: Private bucket for uploaded PDF documents
- **Row Level Security (RLS)**: Enabled on all tables with user-specific policies

---

## 🚀 Development Workflow

### Local Development
```bash
# Start development server
npm run dev

# Run linting
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing Strategy

#### Unit Testing (Planned)
```typescript
// Example test structure using Jest/Vitest
describe('ChatStream Component', () => {
  it('should render chat interface correctly', () => {
    // Test implementation
  });
  
  it('should handle message sending', () => {
    // Test implementation
  });
});
```

#### E2E Testing with Cypress
```bash
# Run E2E tests
npx cypress open

# Run headless tests
npx cypress run
```

### Performance Optimization

#### Code Splitting
```typescript
// Lazy load components
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const SourcesSidebar = lazy(() => import('./components/SourcesSidebar'));
```

#### Memory Optimization
- Implement proper cleanup in useEffect hooks
- Use React.memo for expensive components
- Optimize image loading with lazy loading
- Implement proper error boundaries

---

## 🔧 n8n Workflow Integration

### Workflow Endpoints
- **Chat Workflow**: `/webhook/chat` - Processes user queries → RAG retrieval → LLM response
- **Ingest Workflow**: `/webhook/ingest` - PDF upload → OCR → chunking → embedding → storage
- **Template Workflow**: `/webhook/template` - Session context → permit form generation

### Expected I/O Formats
```typescript
// Chat workflow input
{
  "query": "What are the setback requirements?",
  "sessionId": "uuid",
  "sources": ["fileId1", "fileId2"]
}

// Chat workflow output
{
  "response": "The setback requirements...",
  "citations": [
    {
      "fileId": "uuid",
      "filename": "zoning_code.pdf",
      "page": 15,
      "text": "..."
    }
  ],
  "tokenUsage": {...}
}
```

---

## 🚦 Current Development Status

### ✅ Completed Features
- [x] React application foundation with TypeScript
- [x] Supabase integration (auth, database, storage)
- [x] Basic chat session management
- [x] PDF upload functionality
- [x] Settings management with persistence
- [x] Responsive UI with shadcn/ui components
- [x] Edge function proxy for API calls

### 🔧 In Progress
- [ ] n8n workflow integration (partially implemented)
- [ ] Chat message persistence in database
- [ ] RAG implementation with vector search
- [ ] PDF processing status indicators

### 📋 Planned Features
- [ ] Permit template generation
- [ ] Advanced chat features (message history, citations)
- [ ] Bulk PDF upload support
- [ ] User profile management
- [ ] Analytics and telemetry
- [ ] Performance monitoring

---

## 🛠️ Build and Deployment

### Production Build
```bash
# Build optimized version
npm run build

# Output directory: dist/
# Static files ready for deployment
```

### Docker Configuration (Future)
```dockerfile
# Planned Dockerfile structure
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 8080
CMD ["npm", "run", "preview"]
```

### Deployment Targets
- **Primary**: Lovable.dev platform
- **Alternative**: Self-hosted with Docker
- **CDN**: Static assets via Supabase Storage

---

## 🚨 Known Issues & Solutions

### Current Blockers

1. **n8n Integration Incomplete**
   - **Issue**: Webhook endpoints not fully functional
   - **Status**: Proxy implementation exists but needs workflow completion
   - **Solution**: Complete n8n workflow configuration and testing

2. **Vector Search Not Implemented**
   - **Issue**: RAG functionality missing vector database integration
   - **Status**: Supabase vector extension available but not configured
   - **Solution**: Implement pgvector with embedding generation

3. **Chat Persistence Missing**
   - **Issue**: Messages not stored in database
   - **Status**: Table schema exists but hooks not connected
   - **Solution**: Implement `hh_chat_messages` table integration

### Development Challenges

1. **Settings Persistence**
   - **Issue**: localStorage can be cleared unexpectedly
   - **Solution**: Consider server-side settings storage for production

2. **File Upload Size Limits**
   - **Issue**: Large PDF files may exceed Supabase limits
   - **Status**: Current limit ~50MB per file
   - **Solution**: Implement chunked upload for large files

3. **Real-time Features**
   - **Issue**: Chat streaming not implemented
   - **Solution**: Use Supabase Realtime or Server-Sent Events

### Performance Concerns

1. **Bundle Size**
   - Current size acceptable but monitor as features grow
   - Implement code splitting for route-level optimization

2. **Database Query Optimization**
   - Ensure proper indexing on vector columns
   - Implement pagination for large result sets

---

## 📚 Reference Resources

### Official Documentation
- [React 18 Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [n8n Documentation](https://docs.n8n.io/)

### Key Dependencies
- **@supabase/supabase-js**: ^2.52.0 - Supabase client
- **@tanstack/react-query**: ^5.56.2 - Server state management
- **react-dropzone**: ^14.3.8 - File upload handling
- **lottie-react**: ^2.4.1 - Animation library
- **lucide-react**: ^0.462.0 - Icon system

### Architecture References
- **RAG Implementation**: Consider LangChain integration patterns
- **Vector Database**: Supabase pgvector documentation
- **Authentication**: Supabase Auth helpers and RLS patterns
- **File Processing**: PDF.js for client-side processing
- **Real-time Features**: Supabase Realtime subscriptions

### Development Best Practices
- **TypeScript**: Strict mode configuration for production
- **Component Design**: Atomic design principles
- **State Management**: Minimize global state, prefer local state
- **Error Handling**: Implement proper error boundaries
- **Performance**: Use React Developer Tools for optimization

---

## 📝 Task Management

**⚠️ Important**: Always review `TASKS.md` before starting development work. This file contains the current backlog and priority items.

### Current Sprint Focus
1. Complete n8n workflow integration
2. Implement chat message persistence  
3. Add PDF processing status indicators
4. Test and debug proxy endpoints

### Next Sprint Planning
1. Implement vector search functionality
2. Add permit template generation
3. Enhance error handling and user feedback
4. Performance optimization and testing

---

*This document is maintained as the source of truth for AI agents working on the HHLM project. Update this file when significant architectural changes or new patterns are introduced.*