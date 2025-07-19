# HHLM Overview

## Goal
AI chatbot for town-planning firm that (1) answers NL questions from 20k+ PDFs and (2) generates permit templates.

## PoC Scope
Phase 1: 100–500 PDFs → validate RAG vs fine-tune, ≤ 5s latency.

## Key Technologies
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (database, auth, storage, edge functions)
- **Workflows**: n8n automation
- **AI**: OpenAI/Ollama (configurable)
- **Vector DB**: Supabase vector extensions

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│    Web UI   │◄──►│  /api/proxy/ │◄──►│     n8n     │◄──►│   Supabase   │
│  (React)    │    │ (Edge Funcs) │    │ (Workflows) │    │ (DB + Vector)│
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                           │
                           ▼
                   ┌──────────────┐
                   │  Vector DB   │
                   │ (Embeddings) │
                   └──────────────┘
```

## Folder Structure

```
hhlm/
├── src/                     # React frontend
│   ├── components/          # UI components
│   ├── hooks/              # React hooks
│   ├── lib/                # Utilities & API
│   └── pages/              # Route pages
├── supabase/               # Database & edge functions
│   ├── functions/          # Edge functions
│   └── migrations/         # DB migrations
├── DOC/                    # Documentation
├── public/                 # Static assets
└── .github/                # GitHub workflows
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | ✅ |
| `VITE_N8N_CHAT_WEBHOOK` | n8n chat webhook URL | ✅ |
| `VITE_LLM_PROVIDER` | AI provider (OPENAI/OLLAMA) | ✅ |

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your keys
   ```

3. **Start development**:
   ```bash
   npm run dev
   ```

4. **Seed data** (optional):
   ```bash
   # Upload PDFs via UI or use Supabase dashboard
   ```

## Docker Setup

```bash
# Start services
docker-compose up -d

# Seed database
npm run db:seed
```