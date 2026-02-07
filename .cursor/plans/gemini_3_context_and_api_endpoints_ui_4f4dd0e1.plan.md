---
name: Gemini 3 context and API endpoints UI
overview: "Upgrade to latest Gemini models (including Gemini 3 Pro/Flash with Thinking), make chat thinking UI even less noticeable, give the requirement AI full context (node types, connections, datasets, full endpoint list), and add API spec improvements: optional docs URL, a browsable \"View all endpoints\" UI, and clearer endpoint selection where needed."
todos: []
isProject: false
---

# Gemini 3, Chat UI, AI Context, and API Endpoints

## 1. Use latest Gemini models and prefer thinking models

**Goal:** The AI should "think more"; use the latest models from [Gemini API models](https://ai.google.dev/gemini-api/docs/models), which support **Thinking** (e.g. Gemini 3 Pro, Gemini 3 Flash, Gemini 2.5 Pro, Gemini 2.5 Flash).

**Approach:**

- In [lib/ai.ts](lib/ai.ts), extend the Google provider `models` array to include the new model IDs:
  - **Gemini 3**: `gemini-3-pro-preview`, `gemini-3-flash-preview` (both support Thinking).
  - Keep existing Gemini 2.5 and 2.0 entries for fallback.
- In [lib/requirement-ai.ts](lib/requirement-ai.ts), change the model selection in `getModel()` to **prefer a strong thinking model** when using Google: try in order `gemini-3-pro-preview` (or `gemini-3-flash-preview`), then `gemini-2.5-pro`, then `gemini-2.5-flash`, then first in list. This ensures the requirement/decomposition flow uses a model that supports extended reasoning.
- Ensure the Google model is created with reasoning enabled (already passed as third argument `true` in requirement-ai; confirm [lib/ai.ts](lib/ai.ts) Google `createModel` accepts it if needed for thinking config).

**Files:** [lib/ai.ts](lib/ai.ts), [lib/requirement-ai.ts](lib/requirement-ai.ts).

---

## 2. Make thinking UI even smaller and less noticeable

**Goal:** Chat stays intuitive; the thinking block should be easy to ignore until the user explicitly wants to see it.

**Approach:**

- In [components/requirement-chat.tsx](components/requirement-chat.tsx), refine the thinking block:
  - **Trigger:** Single line, no border by default: e.g. a small "Show thinking" text link only (no top border until expanded), and/or a very small icon (e.g. 8px) that expands on click. Use `text-[10px]` or smaller and `text-muted-foreground/50` so it reads as secondary.
  - **Content:** Keep collapsed by default; when expanded, keep existing muted styling (`bg-muted/20`, `text-muted-foreground/60`) and consider reducing max-height further (e.g. `max-h-24`) so it never dominates.
  - Optionally move the thinking block to the very bottom of the assistant bubble (below the main content) and style it as a thin divider + single-line trigger so the main reply/questions stay clearly on top.

**Files:** [components/requirement-chat.tsx](components/requirement-chat.tsx).

---

## 3. Give the AI access to all nodes and configuration

**Goal:** The requirement AI should be aware of: available node types, connected services (Gmail, Slack, etc.), datasets (CSVs/lists), and full API specs (all endpoints with method, path, params) so it can suggest accurate steps and reference real endpoints and data sources.

**Approach:**

- **Node types:** In [lib/requirement-ai.ts](lib/requirement-ai.ts) `getSystemPrompt()`, append a short bullet list of available node types and their purpose, e.g. from a single source of truth (e.g. a constant in [lib/node-types.ts](lib/node-types.ts) or a small list in requirement-ai): triggers (manual, webhook, schedule), actions (email, slack, http, document), control (condition, approval, delay), data (transform). One line each so the model knows what it can suggest.
- **Connections:** In `getSystemPrompt()`, read [lib/connections-store.ts](lib/connections-store.ts): which of Gmail, SendGrid, Slack have a token set. Append e.g. "Connected services: Gmail, Slack" (or "None" if empty) so the AI only suggests email/Slack steps when the user has connected them, and can say "Connect Gmail in the sidebar" when not.
- **Datasets:** In `getSystemPrompt()`, read [lib/datasets-store.ts](lib/datasets-store.ts): list dataset names (and optionally ids). Append e.g. "Available datasets (for list inputs): [names]. You can suggest steps that use a dataset by name." so the AI can reference "use the Contacts dataset" when relevant.
- **Full API spec:** Extend the existing "Available custom APIs" block to include, for each OpenAPI service and each operation: **method**, **path/urlTemplate**, and **param keys**. Today we only pass service name and operation names; adding method + path + params lets the AI suggest specific endpoints and parameter names. Keep the block concise (e.g. one line per operation: `GET /customers id=... name=...`).

**Files:** [lib/requirement-ai.ts](lib/requirement-ai.ts), optionally [lib/node-types.ts](lib/node-types.ts) or a small shared constant for node-type descriptions.

---

## 4. API spec: docs URL and view-all-endpoints UI

**Goal:** User can attach a documentation URL to an API; there is a clear UI to view all endpoints and choose one when needed.

**Approach:**

- **Docs URL:** Extend [lib/api-catalog.ts](lib/api-catalog.ts) `CatalogService` with optional `docsUrl?: string`. [lib/openapi-ingest.ts](lib/openapi-ingest.ts) does not need to change (ingest still returns CatalogService without docsUrl). In [components/connections-dialog.tsx](components/connections-dialog.tsx): when adding an API via URL or JSON, add an optional "Documentation URL" field; when calling `addService()`, pass a service object that includes `docsUrl` if provided. For existing services (already in store without docsUrl), consider an "Edit" or inline field to add docs URL later. In the "Your APIs" list, show a "View docs" link (opens in new tab) when `service.docsUrl` is set.
- **View all endpoints UI:** Add a dedicated section or modal that lists **all** endpoints the user can use:
  - Data source: `getMergedCatalog()` from [lib/http-node-catalog.ts](lib/http-node-catalog.ts) (built-in catalog + OpenAPI services). Flatten to a list of entries: service name, operation name, method, urlTemplate, param keys.
  - In [components/connections-dialog.tsx](components/connections-dialog.tsx), add an "Endpoints" or "View all endpoints" section (or a button that opens a sheet/dialog): show a table or list of (Service | Method | Endpoint | Name | Params). Allow simple search/filter by name or path so users can find an endpoint quickly. This gives one place to browse everything available.
- **Choosing an endpoint when necessary:** The HTTP node already uses a dropdown populated from `getMergedCatalog()` ([components/nodes/action-http-node.tsx](components/nodes/action-http-node.tsx)), so users can choose any endpoint there. The new "View all endpoints" UI complements this by letting users browse and discover endpoints; no change to the HTTP node dropdown is strictly required. Optionally, the endpoints view could support "Use in workflow" that focuses the canvas and adds an HTTP node with that operation pre-selected (nice-to-have).

**Files:** [lib/api-catalog.ts](lib/api-catalog.ts), [components/connections-dialog.tsx](components/connections-dialog.tsx), [lib/openapi-store.ts](lib/openapi-store.ts) (if we need to persist docsUrl per service; currently services are full CatalogService objects so adding docsUrl to the type is enough). New optional component or section for the endpoints list (e.g. inside connections-dialog or a shared EndpointsList).

---

## 5. Optional: API endpoint field and docs when adding spec

**Goal:** When adding an API, user can optionally specify a documentation URL and clearly see "endpoint" (spec URL) vs "docs" (documentation link).

**Approach:**

- In the "Add API (OpenAPI spec)" section of [components/connections-dialog.tsx](components/connections-dialog.tsx), label the current URL input as "Spec URL (OpenAPI JSON endpoint)" and add a second optional input "Documentation URL (e.g. link to API docs)". On "Load from URL", fetch the spec from the first URL; after ingesting, build the CatalogService and set `docsUrl` from the second field if provided. When adding via paste JSON, add an optional "Documentation URL" field next to it. Persist `docsUrl` as part of the service in the openapi store.

**Files:** [components/connections-dialog.tsx](components/connections-dialog.tsx), [lib/api-catalog.ts](lib/api-catalog.ts).

---

## Implementation order

1. **Gemini 3 and model preference** – Add new model IDs to ai.ts; prefer thinking models in requirement-ai getModel().
2. **Thinking UI** – Shrink and de-emphasize the thinking block in requirement-chat (smaller trigger, optional icon, no border by default).
3. **AI context** – Enrich getSystemPrompt() with node types, connections, datasets, and full endpoint details (method, path, params).
4. **CatalogService.docsUrl** – Add optional docsUrl; connections dialog: docs URL input when adding API, "View docs" link in API list.
5. **View all endpoints UI** – Section or dialog listing all endpoints from getMergedCatalog() with search; accessible from Connections or sidebar.

---

## Summary


| Area             | Change                                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Models**       | Add gemini-3-pro-preview, gemini-3-flash-preview to Google provider; requirement-ai prefers gemini-3-pro-preview then gemini-2.5-pro then gemini-2.5-flash for stronger thinking.              |
| **Thinking UI**  | Even smaller trigger (e.g. 8–10px link/icon), no border by default, thinking content more muted and compact.                                                                                   |
| **AI context**   | System prompt includes: list of node types and purpose; connected services (Gmail, SendGrid, Slack); dataset names from datasets-store; full API operations with method, path, and param keys. |
| **API docs**     | CatalogService.docsUrl optional; when adding API, optional "Documentation URL" field; "View docs" link in Your APIs list when set.                                                             |
| **Endpoints UI** | New "View all endpoints" list/table (from getMergedCatalog()) with optional search; user can browse and see method, path, name, params; HTTP node dropdown unchanged but discovery is easier.  |


