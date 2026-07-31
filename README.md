# Opsmith

**Opsmith turns a small business's messy spreadsheets into working internal tools — powered by AI.**

---

## The Problem

Small physical businesses — workshops, HVAC contractors, bakeries, clinics — run on
tangled spreadsheets and manual steps stitched together with tribal knowledge. They
can't afford custom software, and off-the-shelf tools don't map to their exact
processes. Their spreadsheets already contain the logic; it just needs to be made
usable.

---

## How It Works

```
Upload spreadsheet (.xlsx)
        │
        ▼
Backend parses with SheetJS → raw grid (2-D array)
        │
        ▼
LLM (via OpenRouter) reads the grid and infers a ToolSchema JSON
    • fields: id, label, type (text / number / currency / percent / select / date / boolean)
    • computed: label, expression (expr-eval), type
        │
        ▼
Frontend renders the ToolSchema as an interactive table
    • Live computed columns evaluated client-side with expr-eval (sandboxed)
        │
        ▼
Owner types a plain-language instruction: "add a 10% rush surcharge"
        │
        ▼
LLM receives current schema + instruction → returns updated schema JSON
    • Schema is validated (Zod), persisted to SQLite, re-rendered live
        │
        ▼
Export to CSV (server-side: all fields + evaluated computed columns)
```

### Why schema-driven?

The **ToolSchema JSON is the single source of truth**. Plain-language edits change
the schema, never generated code. This means:

- The LLM can never produce executable code that runs in the user's context.
- Computed expressions are evaluated by `expr-eval` (a sandboxed expression parser),
  not `eval()` or `new Function()`.
- Any schema that fails Zod validation is rejected before it touches the database.
- The whole app degrades gracefully: invalid schemas are skipped with a warning;
  the UI never crashes on a bad expression.

---

## Architecture

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│   Frontend              │        │   Backend (Hono / Node)       │
│   Vite + React          │  HTTP  │                               │
│   Tailwind + shadcn/ui  │◄──────►│   POST /api/upload  (SheetJS) │
│   expr-eval (sandboxed) │        │   POST /api/tools/generate    │
│                         │        │   POST /api/tools/:id/edit    │
│   SchemaRenderer        │        │   GET  /api/tools/:id/export  │
│   (table + computed     │        │   SQLite via better-sqlite3   │
│    columns live)        │        │                               │
└─────────────────────────┘        └──────────────┬───────────────┘
                                                  │ server-side only
                                                  ▼
                                   ┌──────────────────────────┐
                                   │   OpenRouter             │
                                   │   Model: OPENROUTER_MODEL│
                                   │   (default: gpt-4o-mini) │
                                   └──────────────────────────┘
```

**SQLite tables:** `tools(id, name, description, schema_json, created_at)` and
`tool_rows(id, tool_id, data_json)`. The schema JSON is the persisted ToolSchema;
data rows are stored as individual JSON objects keyed by field id.

---

## Local Setup

### Prerequisites

- Node 18+

### 1. Install dependencies

```bash
cd shared   && npm install && cd ..
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Configure environment

**Backend** (copy and fill in your OpenRouter key):

```bash
cp backend/.env.example backend/.env
```

| Variable             | Default               | Description                          |
|----------------------|-----------------------|--------------------------------------|
| `OPENROUTER_API_KEY` | *(required for AI)*   | Your key from openrouter.ai          |
| `OPENROUTER_MODEL`   | `openai/gpt-4o-mini`  | Any model available on OpenRouter    |
| `PORT`               | `8787`                | Port the backend listens on          |

**Frontend** (optional — only needed if your backend runs on a different port):

```bash
cp frontend/.env.example frontend/.env
```

| Variable        | Default                 | Description            |
|-----------------|-------------------------|------------------------|
| `VITE_API_URL`  | `http://localhost:8787` | Backend base URL       |

> **Offline / demo mode:** if `OPENROUTER_API_KEY` is unset, upload + generate
> returns the hardcoded "Inventory Reorder & Pricing" sample tool so the app works
> without a network connection or API key.

### 3. Start both apps

**Terminal 1 — backend:**

```bash
cd backend && npm run dev
```

→ API at **http://localhost:8787**

**Terminal 2 — frontend:**

```bash
cd frontend && npm run dev
```

→ UI at **http://localhost:5173**

On first backend start, `opsmith.db` is created and seeded with the sample
"Inventory Reorder & Pricing" tool (3 rows). The tool appears immediately in the
sidebar without any upload needed.

### 4. Demo reset

If you want to wipe user-generated tools and return to the clean seeded state:

```bash
curl -X POST http://localhost:8787/api/tools/demo/reset
```

Or click **Reset demo** in the bottom-left corner of the sidebar.

---

## API Reference

| Method | Path                          | Description                                              |
|--------|-------------------------------|----------------------------------------------------------|
| GET    | `/api/health`                 | Liveness check → `{ ok: true }`                          |
| POST   | `/api/upload`                 | Multipart `.xlsx` → `{ grid, sheetName }` (2-D array)   |
| GET    | `/api/tools`                  | List all tools                                           |
| GET    | `/api/tools/:id`              | Get tool schema + data rows                              |
| POST   | `/api/tools`                  | Upsert a tool schema                                     |
| POST   | `/api/tools/generate`         | Generate a ToolSchema from a grid via OpenRouter         |
| POST   | `/api/tools/:id/edit`         | Refine schema with a plain-language instruction          |
| GET    | `/api/tools/:id/export`       | Download CSV (all fields + evaluated computed columns)   |
| POST   | `/api/tools/demo/reset`       | Reset to clean seeded state                              |

---

## Tech Stack

| Layer        | Technology                                           |
|--------------|------------------------------------------------------|
| Frontend     | Vite · React 18 · TypeScript · Tailwind CSS · shadcn/ui |
| Expressions  | expr-eval (sandboxed, no `eval`)                     |
| Backend      | Hono · `@hono/node-server` · TypeScript              |
| Database     | SQLite via `better-sqlite3`                          |
| File parsing | SheetJS (`xlsx`)                                     |
| Runtime AI   | OpenRouter (server-side only)                        |
| Schema       | Zod (shared between frontend and backend)            |
| Dev runtime  | tsx (watch mode)                                     |

---

## Built with IBM Bob

This project was built end-to-end using **IBM Bob** as the AI software development
lifecycle tool across seven iterative steps:

**Step 1 — Scaffold**
Bob generated the complete project structure: `shared/`, `backend/`, `frontend/`
monorepo layout; Hono server with CORS, SheetJS upload, SQLite schema with seed data,
Vite + React + Tailwind + shadcn/ui dashboard shell, and the shared Zod `ToolSchema`
type used by both apps.

**Step 2 — Deterministic computed columns**
Bob added `expr-eval` to the frontend and implemented the `evaluateExpression` helper
(numeric string coercion, try/catch, NaN/Infinity guard). The `SchemaRenderer`
component was updated to evaluate per-row and format by type (currency, boolean badge,
percent, number).

**Step 3 — OpenRouter generation**
Bob wired the real `POST /api/tools/generate` endpoint: hardened the `callOpenRouter`
helper (60s AbortController timeout, `stripFences()` for markdown code fences), wrote
the structured system prompt for schema inference, added Zod validation with one
repair retry, and persisted the generated schema and grid rows to SQLite. The frontend
"Generate tool" button and grid preview were connected end-to-end.

**Step 4 — Plain-language schema refinement**
Bob implemented `POST /api/tools/:id/edit`: loads the current schema, sends it with
the instruction to OpenRouter, validates, forces `id` stability, and persists the
update without touching existing rows. The frontend Refine input, loading states, and
newly-added column highlight (2-second green flash) were added in the same step.

**Step 5 — Demo polish**
Bob added the empty state, rotating generate labels ("Reading your sheet…" /
"Inferring columns…" / "Building tool…"), a minimal toast system, CSV export
(server-side evaluation via shared `evaluateExpression`), sticky table headers,
numeric column right-alignment with `tabular-nums`, computed column background tint,
and the Export CSV button.

**Step 6 — Hardening**
Bob wrapped `SchemaRenderer` in a React `ErrorBoundary`, added NaN/±Infinity guards
to both evaluators (frontend and backend), hardened the upload route to reject
non-spreadsheet files with clear 400 messages, added Hono `onError` global handlers,
made `GET /api/tools` skip Zod-invalid schemas with a console warning, and implemented
the `POST /api/tools/demo/reset` endpoint.

**Step 7 — Docs and submission**
Bob produced this README, the `.gitignore`, and confirmed no secrets were committed.

**Design decisions made with Bob:**
- Schema-first architecture: the ToolSchema JSON is the unit of change, not code.
  This was established in Step 1 and held throughout — the LLM edits data, not logic.
- `expr-eval` over `eval()`/`new Function()`: deliberate choice for sandbox safety,
  decided in Step 2 and reused for the server-side CSV evaluator in Step 5.
- One repair retry for OpenRouter: keeps latency predictable while handling
  occasional malformed model output, decided in Step 3.
- Shared `tool-schema.ts`: the Zod schema is imported by both apps via a TS path
  alias, making the contract between frontend and backend compile-time verified.
