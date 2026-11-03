# CarFit AI — Agent Instructions

## Quickstart

### Docker (Recommended)
```bash
docker compose up --build
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### Local Development
```bash
# Backend
cd backend && npm install && cp .env.example .env && npm run seed && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

## Key Commands

| Task | Command |
|------|---------|
| Backend dev server | `cd backend && npm run dev` |
| Frontend dev server | `cd frontend && npm run dev` |
| Seed database (250 listings) | `cd backend && npm run seed` |
| Syntax check all backend files | `cd backend && npm run check` |
| Lint frontend | `cd frontend && npm run lint` |
| Build frontend | `cd frontend && npm run build` |
| Run individual MCP servers | `cd backend && npm run mcp:marketplace` (or `:booking`, `:checkout`) |

## Environment Variables

Edit `backend/.env` — choose **one** LLM provider:

- **Groq** (free): `GROQ_API_KEY` + `GROQ_MODEL=llama-3.3-70b-versatile`
- **Gemini** (free): `GEMINI_API_KEY` + `GEMINI_MODEL=gemini-2.0-flash`
- **OpenAI**: `OPENAI_API_KEY` + `OPENAI_MODEL=gpt-4o-mini`
- **Ollama** (local fallback): `ENABLE_OLLAMA=true` + `OLLAMA_MODEL=qwen2.5:7b`

Required: `MONGO_URI` (MongoDB connection string)

Optional observability: `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`

## Architecture Overview

```
Frontend (React 19 + Vite + A2UI) 
    ↔ Express 5 API Gateway (port 5000)
    ↔ MongoDB (sessions, listings, bookings)
    ↔ DeepAgents Orchestrator (LangGraph)
    ↔ MCP Servers (Stdio transport):
        - roam-marketplace: search_listing tool
        - roam-booking: create_booking tool + booking form resource
        - roam-checkout: mock_checkout tool + checkout form resource
```

## Critical Files

- **Backend entry**: `backend/src/server.js`
- **Agent core**: `backend/src/agent/car-agent.js` (multi-provider LLM factory + DeepAgents)
- **Interview logic**: `backend/src/agent/interview.js` (6-slot elicitation state machine)
- **MCP clients**: `backend/src/mcp/clients.js` (StdioClientTransport with telemetry)
- **Ranking**: `backend/src/marketplace/ranking.js` (100-point multi-attribute formula)
- **A2UI builder**: `backend/src/a2ui/builder.js` (protocol event serialization)
- **Frontend renderer**: `frontend/src/a2ui/renderer.jsx` (A2UI protocol reducer)

## Elicitation Slots (6 required before search)

1. `transactionType` — "rent" or "buy"
2. `location` — city/pickup location
3. `category` — vehicle category (SUV, Sedan, Electric, etc.)
4. `maxBudget` — daily rate (rent) or price (buy) in INR
5. `startDate` — YYYY-MM-DD
6. `passengers` — seat capacity

## Ranking Formula (100 points)

```
Score = round(100 × [
  0.30 × S_budget + 0.20 × S_category + 0.10 × S_fuel +
  0.15 × S_seats + 0.15 × S_features + 0.10 × S_rating
])
```

## Testing & Verification

No automated test suite exists. Verify manually:
1. `npm run check` — syntax validates all backend modules
2. `npm run seed` — populates 250 listings across 10 categories × 10 brands
3. Start backend + frontend, open chat, complete full flow: interview → search → select → booking → checkout

## Gotchas

- **ESM only** — all `.js` files use `import`/`export`; `package.json` has `"type": "module"`
- **MCP servers run as child processes** — Stdio transport; they must be spawned from the agent/API, not run standalone in production
- **Ollama fallback** requires local Ollama server running (`ollama serve`) with model pulled (`ollama pull qwen2.5:7b`)
- **CORS** allows any `http://localhost:*` or `http://127.0.0.1:*` origin; `CLIENT_URL` env var overrides
- **Docker compose** seeds database on backend startup automatically
- **Port mapping**: Docker frontend serves on 3000 (nginx:80), backend on 5000