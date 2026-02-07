# Architecture

This document describes the high-level architecture of **One for All** and how its main pieces fit together.

---

## High-level system architecture

```mermaid
flowchart TB
  subgraph UI["App (Next.js)"]
    Page[page.tsx]
    Sidebar[AppSidebar]
    Workflow[Workflow Canvas]
    Panels[Panels / Node Cards]
    CreateAI[Create with AI / Requirement Chat]
  end

  subgraph State["Zustand stores"]
    WS[workflow-store]
    RS[requirement-store]
    AK[api-key-store]
    CS[connections-store]
    OS[openapi-store]
    ES[examples-store]
  end

  subgraph Logic["Lib / business logic"]
    AI[ai.ts / Vercel AI SDK]
    ReqAI[requirement-ai.ts]
    Gen[workflow-generator.ts]
    API[api-discovery.ts / api-catalog]
    Compute[compute.ts]
    Export[export-n8n.ts]
  end

  Page --> Sidebar
  Page --> Workflow
  Workflow --> Panels
  Sidebar --> CreateAI

  Workflow --> WS
  CreateAI --> RS
  CreateAI --> ReqAI
  ReqAI --> AI
  ReqAI --> RS
  Gen --> API
  Gen --> WS
  Panels --> Compute
  Compute --> AK
  Compute --> CS
  WS --> Export
  CreateAI --> Gen
  Gen --> OS
  Gen --> ES
```

- **UI**: Next.js App Router, single main page with sidebar + React Flow canvas. “Create with AI” lives in the sidebar; the canvas shows nodes and edges.
- **State**: All persistent and runtime state is in Zustand stores (workflows, requirement chat, API keys, connections, OpenAPI catalog, examples).
- **Logic**: AI (Vercel AI SDK), requirement decomposition (`requirement-ai`), workflow generation (`workflow-generator`), API discovery/catalog, node execution (`compute`), and n8n export.

---

## Data flow: AI-driven workflow creation

```mermaid
sequenceDiagram
  participant User
  participant Chat as Requirement Chat UI
  participant RS as requirement-store
  participant ReqAI as requirement-ai
  participant LLM as LLM (Vercel AI SDK)
  participant Gen as workflow-generator
  participant API as api-discovery / api-catalog
  participant WS as workflow-store

  User->>Chat: Describe workflow in natural language
  Chat->>RS: Append message
  Chat->>ReqAI: Decompose or clarify
  ReqAI->>LLM: Generate steps or clarification
  LLM-->>ReqAI: JSON steps or questions
  ReqAI-->>RS: Update steps / clarifications
  Chat-->>User: Show steps or clarification form

  User->>Chat: (Optional) Answer clarifications, then "Generate workflow"
  Chat->>Gen: generateWorkflowFromRequirement(steps, options)
  Gen->>API: discoverOperations(step) for HTTP steps
  API-->>Gen: Catalog operation IDs / config
  Gen->>Gen: Map steps → nodes + edges
  Gen->>WS: setWorkflowContent(nodes, edges)
  WS-->>UI: Canvas updates with new workflow
```

1. User describes the process in the requirement chat.
2. `requirement-ai` calls the LLM to decompose into steps (or ask 1–2 clarifications).
3. Steps (and optional clarification answers) are stored in `requirement-store`.
4. On “Generate workflow”, `workflow-generator` turns steps into nodes/edges, uses `api-discovery` / `api-catalog` for HTTP steps, then writes to `workflow-store`.
5. The canvas (bound to `workflow-store`) shows the new workflow.

---

## Data flow: Run workflow (execute nodes)

```mermaid
sequenceDiagram
  participant User
  participant Canvas as Workflow Canvas
  participant WS as workflow-store
  participant Compute as compute.ts
  participant AK as api-key-store
  participant CS as connections-store
  participant External as Gmail / Slack / HTTP APIs

  User->>Canvas: Click "Run" on trigger or node
  Canvas->>WS: runFromNode(nodeId) / runWorkflow()
  WS->>Compute: computeNode(node, inputs)
  Compute->>AK: getKeys() for AI nodes
  Compute->>CS: getConnection() for Email/Slack
  Compute->>External: HTTP / Gmail / Slack API
  External-->>Compute: Response
  Compute-->>WS: Node output / error
  WS-->>Canvas: Update node data (loading, output, error)
```

- Execution is triggered from the UI; `workflow-store` drives run (e.g. `runFromNode` / `runWorkflow`).
- `compute.ts` runs each node type (AI, HTTP, email, Slack, delay, condition, approval, etc.), using `api-key-store` and `connections-store` for secrets.
- Results and errors are written back into workflow state so the canvas and panels can show output and “Debug with AI” can use them.

---

## Project structure (key areas)

```mermaid
flowchart LR
  subgraph app
    layout[layout.tsx]
    page[page.tsx]
  end

  subgraph components
    workflow[workflow.tsx]
    sidebar[app-sidebar]
    nodes[nodes/*]
    ui[ui/*]
  end

  subgraph lib
    stores["*-store.ts"]
    ai[requirement-ai, workflow-edit-ai, debug-ai]
    gen[workflow-generator, api-discovery]
    compute[compute.ts, compute-actions]
  end

  page --> sidebar
  page --> workflow
  workflow --> nodes
  sidebar --> ui
  lib --> components
```

| Path | Purpose |
|------|--------|
| `app/` | Next.js App Router: `layout`, `page` (loads sidebar + workflow canvas). |
| `components/` | `workflow.tsx` (React Flow + node types), `app-sidebar.tsx`, `requirement-chat`, `panels`, `nodes/*` (per-type UI), `ui/*` (shadcn). |
| `lib/` | Zustand stores (`workflow-store`, `requirement-store`, `api-key-store`, `connections-store`, `openapi-store`, `examples-store`), AI modules (`requirement-ai`, `workflow-edit-ai`, `debug-ai`), workflow generation (`workflow-generator`, `api-discovery`, `api-catalog`), execution (`compute`, `compute-actions`), export (`export-n8n`). |
| `hooks/` | Shared hooks (e.g. `use-mobile`). |
| `fixtures/` | Sample OpenAPI spec for tests/demos. |
| `public/` | Static assets (e.g. logo). |

---

## Component → store usage

| Component / feature | Primary store(s) | Other lib deps |
|--------------------|------------------|----------------|
| Workflow canvas | `workflow-store` | `compute`, node types |
| Create with AI / requirement chat | `requirement-store` | `requirement-ai`, `workflow-generator` |
| API Keys panel | `api-key-store` | — |
| Connections (Gmail, Slack) | `connections-store` | — |
| Endpoints / OpenAPI | `openapi-store` | `openapi-ingest`, `api-discovery` |
| Edit in NL / Debug with AI | `workflow-store` | `workflow-edit-ai`, `debug-ai` |
| Export to n8n | `workflow-store` | `export-n8n` |

---

## Summary

- **Single-page app**: sidebar + React Flow canvas; all workflow and AI flows stay in the client.
- **State**: Zustand stores hold workflows, requirement conversation, API keys, connections, OpenAPI catalog, and examples.
- **AI**: Vercel AI SDK for LLM calls; `requirement-ai` for decomposition/clarification; `workflow-generator` for steps → graph; `workflow-edit-ai` and `debug-ai` for edits and debugging.
- **Execution**: `compute` runs nodes using keys and connections; results flow back into `workflow-store` and the UI.

For more on usage and setup, see the [README](../README.md).
