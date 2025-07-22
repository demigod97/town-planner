# HHLM - Town Planning AI Assistant

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

A comprehensive AI-powered RAG (Retrieval-Augmented Generation) system designed specifically for town planning firms. HHLM enables natural language querying of 20,000+ PDF documents and generates intelligent permit application templates through automated workflows.

## 🎯 Project Overview

HHLM (Town Planning AI Assistant) addresses the challenge of efficiently accessing and utilizing vast amounts of regulatory documentation in the town planning industry. The system combines modern web technologies with AI workflows to provide contextually accurate answers and automate permit template generation.

### Key Features

- 🤖 **Intelligent Document Query**: Natural language chat interface for querying planning documents
- 📄 **PDF Knowledge Base**: Efficient ingestion and processing of planning regulations and codes  
- 🔍 **RAG Implementation**: Advanced retrieval-augmented generation for accurate, cited responses
- 📋 **Template Generation**: AI-powered permit application template creation
- 🔒 **Secure Authentication**: User-based access control with row-level security
- ⚡ **Real-time Processing**: Sub-5 second response times for document queries
- 🛠️ **Automated Workflows**: n8n-powered background processing for document ingestion

### Current Status: Proof of Concept

- **Phase**: PoC validation with 100-500 PDFs
- **Goal**: Validate RAG vs fine-tuning approaches
- **Target**: <5s response latency with high accuracy
- **Scaling**: Architecture designed for 20,000+ document expansion

## 🏗️ Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   React UI  │◄──►│  Supabase    │◄──►│    n8n      │◄──►│   AI/LLM     │
│  (Frontend) │    │  (Backend)   │    │ (Workflows) │    │ (OpenAI/     │
│             │    │              │    │             │    │  Ollama)     │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                           │
                           ▼
                   ┌──────────────┐
                   │ Vector Store │
                   │ (pgvector)   │
                   └──────────────┘
```

### Technology Stack

#### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5.4.1 
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: React Context + Local Storage
- **Routing**: React Router DOM 6.26.2
- **File Handling**: React Dropzone 14.3.8

#### Backend & Infrastructure  
- **Database**: Supabase (PostgreSQL with pgvector)
- **Authentication**: Supabase Auth with RLS
- **Storage**: Supabase Storage (PDF documents)
- **Edge Functions**: Supabase Edge Functions (Deno)
- **Workflows**: n8n Automation Platform
- **AI/ML**: OpenAI API / Ollama (configurable)

#### Development Tools
- **Language**: TypeScript 5.5.3
- **Linting**: ESLint with React hooks
- **Testing**: Cypress (E2E + Component)
- **Package Manager**: npm

## 🚀 Quick Start

### Prerequisites

- **Node.js**: 18+ with npm
- **Docker**: For local n8n and AI services
- **Supabase Account**: For database and auth
- **AI Provider**: OpenAI API key or local Ollama setup

### Installation

1. **Clone the Repository**
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
   ```
   
   Configure your `.env.local` file:
   ```bash
   # Core Supabase Configuration (Required)
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   
   # n8n Workflow Integration (Required)
   VITE_N8N_CHAT_WEBHOOK=http://localhost:5678/webhook/hhlm-chat
   VITE_N8N_INGEST_URL=http://localhost:5678/webhook/ingest
   VITE_N8N_TEMPLATE_URL=http://localhost:5678/webhook/template
   VITE_N8N_BASE_URL=http://localhost:5678
   VITE_N8N_API_KEY=your-n8n-api-key
   
   # AI/LLM Configuration (Choose one)
   VITE_LLM_PROVIDER=OPENAI  # or OLLAMA
   VITE_OPENAI_API_KEY=your-openai-key
   # OR for local Ollama
   VITE_OLLAMA_BASE_URL=http://localhost:11434
   ```

4. **Database Setup**
   
   Create a Supabase project and run the provided migrations:
   ```bash
   # Ensure your Supabase project is created
   # Apply database migrations from supabase/migrations/
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```
   
   The application will be available at `http://localhost:8080`

### n8n Workflow Setup

For full functionality, you'll need to set up the n8n workflows:

1. **Start n8n** (via Docker or local installation)
   ```bash
   docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n
   ```

2. **Import Workflows**
   - Access n8n at `http://localhost:5678`
   - Import the workflow files from the `n8n/` directory
   - Configure credentials for Supabase, Ollama/OpenAI
   - Activate all imported workflows

3. **Configure Webhooks**
   - Copy webhook URLs from n8n
   - Update your `.env.local` with the webhook URLs
   - Restart the development server

## 📁 Project Structure

```
hhlm/
├── src/                          # React frontend application
│   ├── components/               # React components
│   │   ├── ui/                  # shadcn/ui base components
│   │   ├── ChatStream.tsx       # Main chat interface
│   │   ├── SettingsModal.tsx    # Configuration panel
│   │   └── SourcesSidebar.tsx   # PDF management
│   ├── hooks/                   # Custom React hooks
│   │   ├── useSettings.tsx      # Settings management
│   │   ├── useAuth.ts          # Authentication
│   │   └── useSession.tsx      # Chat sessions
│   ├── lib/                     # Utilities & API
│   │   ├── api.ts              # API proxy functions
│   │   ├── utils.ts            # Helper utilities
│   │   └── supabase.ts         # Supabase client
│   └── pages/                   # Route components
├── supabase/                    # Backend configuration
│   ├── functions/              # Edge functions
│   │   └── proxy/              # API proxy router
│   └── migrations/             # Database migrations
├── n8n/                        # Workflow definitions
├── DOC/                        # Documentation
├── public/                     # Static assets
└── scripts/                    # Build scripts
```

## 🗄️ Database Schema

### Core Tables

#### Chat Sessions (`hh_chat_sessions`)
```sql
id          UUID PRIMARY KEY
title       TEXT NOT NULL DEFAULT 'New Chat'
user_id     UUID REFERENCES auth.users(id)
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

#### File Uploads (`hh_uploads`)
```sql
id          UUID PRIMARY KEY  
filename    TEXT NOT NULL
file_path   TEXT
file_size   BIGINT NOT NULL
user_id     UUID REFERENCES auth.users(id)
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

### Planned Extensions
- `hh_chat_messages` - Chat history storage
- `hh_templates` - Generated permit templates
- `hh_pdf_vectors` - Document embeddings
- `hh_telemetry` - Usage analytics

### Security
- **Row Level Security (RLS)** enabled on all tables
- User-specific access policies
- Private storage buckets with signed URLs

## 🔧 Development Workflow

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production  
npm run preview      # Preview production build
npm run lint         # Run ESLint

# Testing
npm run test         # Run test suite (when implemented)
npx cypress open     # Open Cypress test runner
```

### Development Guidelines

#### Component Standards
- Use TypeScript with proper interface definitions
- Follow React functional component patterns
- Implement proper error boundaries
- Use shadcn/ui for consistent UI components

#### State Management
- Prefer local state over global state
- Use React Context for shared application state
- Persist user preferences to localStorage
- Implement proper cleanup in useEffect hooks

#### API Integration
- All external API calls go through Supabase Edge Functions
- Use proper error handling and loading states
- Implement retry logic for failed requests
- Type all API responses with TypeScript interfaces

## 🔌 n8n Workflow Integration

### Workflow Endpoints

| Workflow | Endpoint | Purpose |
|----------|----------|---------|
| Chat | `/webhook/chat` | Process user queries → RAG → LLM response |
| Ingest | `/webhook/ingest` | PDF upload → OCR → chunking → embeddings |
| Template | `/webhook/template` | Context → permit template generation |

### Expected Data Formats

#### Chat Request
```typescript
{
  "query": "What are the setback requirements?",
  "sessionId": "uuid",
  "sources": ["fileId1", "fileId2"]
}
```

#### Chat Response
```typescript
{
  "response": "The setback requirements are...",
  "citations": [
    {
      "fileId": "uuid",
      "filename": "zoning_code.pdf",
      "page": 15,
      "text": "Referenced text..."
    }
  ],
  "tokenUsage": {...}
}
```

## 🚀 Deployment

### Production Build

```bash
# Build optimized production version
npm run build

# Output directory: dist/
# Contains optimized static files ready for deployment
```

### Environment Variables for Production

Ensure all required environment variables are set:

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_N8N_*` - n8n workflow endpoints
- `VITE_LLM_PROVIDER` - AI provider configuration

### Deployment Options

1. **Static Hosting** (Vercel, Netlify, etc.)
   - Deploy the `dist/` folder
   - Configure environment variables in hosting platform
   - Set up custom domain (optional)

2. **Docker Deployment**
   ```bash
   # Build Docker image
   docker build -t hhlm .
   
   # Run container
   docker run -p 8080:80 hhlm
   ```

3. **Self-Hosted with n8n**
   - Deploy alongside n8n instance
   - Configure reverse proxy (nginx/Caddy)
   - Set up SSL certificates

## 🔍 Troubleshooting

### Common Issues

#### Chat Not Working
- Verify n8n workflows are activated
- Check webhook URLs in settings
- Ensure API keys are correctly configured
- Review browser console for errors

#### File Upload Failures  
- Check Supabase storage bucket permissions
- Verify file size limits (50MB default)
- Ensure user authentication is working
- Review n8n ingest workflow logs

#### Settings Not Persisting
- Clear browser localStorage and reconfigure
- Verify all required fields are filled
- Check browser console for validation errors

#### n8n Connection Issues
- Ensure n8n is running and accessible
- Verify webhook URLs are correct
- Check n8n workflow execution logs
- Test API credentials in n8n

### Debug Mode

Enable debug logging by setting localStorage:
```javascript
localStorage.setItem('debug', 'true');
```

## 🤝 Contributing

We welcome contributions to improve HHLM! Here's how to get started:

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes following the development guidelines
4. Test your changes thoroughly
5. Submit a pull request

### Code Standards
- Follow TypeScript best practices
- Use meaningful commit messages
- Add JSDoc comments for complex functions
- Ensure all tests pass before submitting
- Update documentation as needed

### Pull Request Process
1. Ensure your PR addresses a specific issue or feature
2. Include a clear description of changes
3. Add or update tests as appropriate
4. Update documentation if needed
5. Request review from maintainers

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **n8n Team** - For the powerful workflow automation platform
- **Supabase Team** - For the excellent backend-as-a-service platform  
- **React Community** - For the robust frontend framework and ecosystem
- **shadcn** - For the beautiful and accessible UI components

## 📞 Support

For questions, issues, or feature requests:

1. **Check the Documentation** - Review this README and the DOC/ folder
2. **Search Issues** - Look for existing GitHub issues
3. **Create an Issue** - Submit a detailed bug report or feature request
4. **Join Discussions** - Participate in GitHub Discussions

## 🔗 Related Resources

- [Supabase Documentation](https://supabase.com/docs)
- [n8n Documentation](https://docs.n8n.io/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)

---

**Built with ❤️ for the town planning community**