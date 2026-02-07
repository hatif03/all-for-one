---
name: User data and API-aware workflow generation
overview: Apply user clarification answers to generated nodes, add per-node comments, strengthen edge-case handling, and improve API-spec-aware discovery so endpoints and parameters (including from previous steps) are auto-filled correctly.
todos: []
isProject: false
---

# User Data, Per-Node Comments, Edge Cases, and API-Aware Generation

## Current gaps

- **User answers ignored:** [components/app-sidebar.tsx](components/app-sidebar.tsx) receives `clarificationValues` as `_clarificationValues` and never passes them to the generator. [lib/workflow-generator.ts](lib/workflow-generator.ts) has no parameter for user-provided values, so subject/body/delay/recipient etc. stay as placeholders.
- **No per-node explanation:** Only one workflow-level annotation exists. There is no "why this node" comment on each node ([lib/base-node.ts](lib/base-node.ts) has no `comment`/`reason`; [lib/workflow-generator.ts](lib/workflow-generator.ts) does not attach a reason per node).
- **Edge cases:** The requirement AI prompt already asks for scenarios; the generator does not enforce or validate branches (e.g. approval rejected, empty list, retry).
- **API spec underused:** [lib/api-discovery-ai.ts](lib/api-discovery-ai.ts) `selectOperationByAI` gets only the step description and the operations list. It does not receive user answers or prior-step context, so it cannot fill params from "all customers" or "3 days" or from previous step outputs. When no OpenAPI operation matches, [lib/api-discovery.ts](lib/api-discovery.ts) falls back to a generic HTTP op (e.g. [lib/api-catalog.ts](lib/api-catalog.ts) placeholder with empty or generic URL), so nodes show `https://api.` instead of a real endpoint.

---

## 1. Apply user clarification answers to generated workflow

**Goal:** Values the user types into the clarification inputs (email subject, delay, segment, etc.) must appear in the generated nodes instead of defaults.

**Approach:**

- **Clarification schema:** Extend the AI output and [lib/requirement-store.ts](lib/requirement-store.ts) `RequirementClarification` with an optional `**targetField**` (e.g. `"subject"`, `"body"`, `"to"`, `"delayHours"`, `"channel"`). In [lib/requirement-ai.ts](lib/requirement-ai.ts) system prompt, instruct the model to include `targetField` in each clarification when possible so we know which node field to fill. Parse and store it in the existing clarifications flow.
- **Pass values into generator:** In [components/app-sidebar.tsx](components/app-sidebar.tsx), pass `clarificationValues` (and clarifications list for mapping) into `generateWorkflowFromSteps`. Extend `generateWorkflowFromSteps` in [lib/workflow-generator.ts](lib/workflow-generator.ts) to accept an optional `options: { clarificationValues?: Record<string, string>; clarifications?: { stepId: string; targetField?: string }[] }` (or a single structure that includes both; clarifications in the store already have stepId and we can add targetField).
- **Apply in generator:** When building each action node (email, slack, delay, http), resolve which clarification values belong to that step. Keys in `clarificationValues` are currently `stepId-index` (e.g. `"2-0"`, `"2-1"`). For each clarification with a matching stepId (and optional targetField), set the corresponding node data field from `clarificationValues[key]` instead of the placeholder. Map targetField to node data keys: e.g. `subject` -> email node `subject`, `delayHours` -> delay node `delayHours`, and for HTTP use `catalogParamValues` or body. If `targetField` is missing, use heuristics (e.g. question contains "subject" -> subject) as fallback.
- **Chat UI:** No change to input keys (`stepId-index`); the generator will receive the same keys and the clarifications array (with optional targetField) to know which key applies to which field. If the AI does not output targetField yet, the first iteration can rely on order (e.g. first clarification for step 2 -> first editable field for that step type) or simple keyword match on question text.

**Files:** [lib/requirement-store.ts](lib/requirement-store.ts), [lib/requirement-ai.ts](lib/requirement-ai.ts) (prompt + parse), [lib/workflow-generator.ts](lib/workflow-generator.ts), [components/app-sidebar.tsx](components/app-sidebar.tsx).

---

## 2. Per-node comment explaining why the node is there

**Goal:** Every generated node has a short comment explaining why it is in the workflow (for the user and for debugging).

**Approach:**

- **Step-level reason from AI:** In [lib/requirement-ai.ts](lib/requirement-ai.ts), extend the steps JSON schema so each step can include an optional `**reason**` (e.g. "Sends the initial offer to the segment chosen by the user"). Update the system prompt to ask the model to add a one-sentence `reason` per step when outputting steps.
- **Generator attaches reason to node data:** In [lib/workflow-generator.ts](lib/workflow-generator.ts), when building each node, set `data.reason = step.reason ?? shortLabel(step.description)` (or similar). If the AI does not return a reason, fall back to the step description.
- **Node data schema:** Add optional `**reason?: string**` to [lib/base-node.ts](lib/base-node.ts) (or to the node-type-specific schemas in [lib/node-types.ts](lib/node-types.ts)) so all action/control nodes can carry a reason.
- **UI:** In the node card components (e.g. [components/nodes/action-email-node.tsx](components/nodes/action-email-node.tsx), [components/nodes/action-http-node.tsx](components/nodes/action-http-node.tsx), control nodes), render a small muted line (e.g. below the title or in a tooltip) when `data.reason` is present: "Why: {reason}".

**Files:** [lib/base-node.ts](lib/base-node.ts) or [lib/node-types.ts](lib/node-types.ts), [lib/requirement-ai.ts](lib/requirement-ai.ts), [lib/workflow-generator.ts](lib/workflow-generator.ts), and each generated node component that should show the reason (action-email, action-http, action-slack, control-approval, control-delay, control-condition, etc.).

---

## 3. Stronger edge-case handling and workflow robustness

**Goal:** Generated workflows explicitly handle failure paths, empty data, and alternatives so they feel "well thought out."

**Approach:**

- **Prompt tightening:** In [lib/requirement-ai.ts](lib/requirement-ai.ts), make the scenario phase more concrete: require the model to add steps for "what happens if approval is rejected," "what if the list is empty," "retry or notify on API failure," and to use condition/approval/delay where appropriate. Ask for a short `reason` that mentions the scenario (e.g. "If approval rejected, notify requester").
- **Validation (optional):** After parsing steps, an optional lightweight check or second LLM call could verify "missing branch for rejection" or "no step for empty result" and either suggest one more question to the user or append a suggested step. This can be a follow-up iteration.
- **Node types:** Keep existing control nodes (condition, approval, delay). No new node types are strictly required for the first pass; better steps and reasons from the AI plus applying user data should improve perceived quality. If we later see a need for a dedicated "retry" or "error handler" node, we can add it.

**Files:** [lib/requirement-ai.ts](lib/requirement-ai.ts).

---

## 4. API spec processing: auto-fill endpoint and parameters

**Goal:** When the AI infers from the step (and user context) that an API endpoint should be used, the generated node is filled with that endpoint, method, and parameters; parameters can be literals from user answers or variables from previous steps.

**Approach:**

- **Richer discovery input:** Extend [lib/api-discovery-ai.ts](lib/api-discovery-ai.ts) `selectOperationByAI` to accept optional **workflow context**: e.g. `userSummary?: string` (concise summary of user answers like "segment: all customers, delay: 3 days") and `previousSteps?: { description: string; outputs?: string[] }[]`. Pass the full operation list including `urlTemplate` and param names/descriptions (already done in `formatOperation`). Update the system prompt to: (1) pick the best endpoint that provides or accepts the data the step needs; (2) fill `paramMapping` with literal values from the user summary when relevant (e.g. segment -> `segment=all_customers`); (3) use `{{stepId.outputKey}}` or similar when the value should come from a previous step (e.g. "send email to each from list" -> to: `{{trigger.rows}}` or from a prior "get customers" step).
- **Discovery passes context:** In [lib/api-discovery.ts](lib/api-discovery.ts), when calling `selectOperationByAI`, build a short `userSummary` from the clarification values (and optionally from the last user message) and pass `previousSteps` from the steps already processed so the AI can suggest param mappings from previous outputs. This may require `discoverOperations` to receive `clarificationValues` and `steps` (and possibly the full steps list with descriptions) so it can pass a summary into the AI.
- **Generator passes clarifications into discovery:** So that discovery can build `userSummary`, `generateWorkflowFromSteps` should pass the same `clarificationValues` (and clarifications list) into `discoverOperations`. Discovery then passes a compact summary into `selectOperationByAI` (e.g. "User inputs: subject=Special Offer...; delay=3 days; segment=all customers").
- **Fallback URL:** In [lib/api-catalog.ts](lib/api-catalog.ts), ensure the generic HTTP fallback operation has a non-empty `urlTemplate` (e.g. `"https://api.example.com/action"`) so generated nodes never show a broken `https://api.` when no spec matches. In [lib/workflow-generator.ts](lib/workflow-generator.ts) we already use `step.operation?.urlTemplate ?? "https://api.example.com/action"`; ensure the catalog entry used in discovery for "no match" also has a sensible default.

**Files:** [lib/api-discovery-ai.ts](lib/api-discovery-ai.ts), [lib/api-discovery.ts](lib/api-discovery.ts), [lib/workflow-generator.ts](lib/workflow-generator.ts), [lib/api-catalog.ts](lib/api-catalog.ts) (if fallback URL is missing).

---

## Data flow (high level)

```mermaid
sequenceDiagram
  participant User
  participant Chat
  participant Sidebar
  participant Generator
  participant Discovery
  participant DiscoveryAI

  User->>Chat: Answer clarifications, click Generate
  Chat->>Sidebar: onGenerateWorkflow(steps, clarificationValues)
  Sidebar->>Generator: generateWorkflowFromSteps(steps, name, onProgress, clarificationValues, clarifications)
  Generator->>Discovery: discoverOperations(steps, onProgress, clarificationValues, clarifications)
  loop For each step
    Discovery->>DiscoveryAI: selectOperationByAI(stepDesc, ops, userSummary, previousSteps)
    DiscoveryAI-->>Discovery: operationId, paramMapping with literals or variables
  end
  Discovery-->>Generator: discovered steps with paramMapping
  Generator->>Generator: Build nodes: apply clarificationValues to fields by targetField; set reason per node
  Generator-->>Sidebar: nodes, edges
```



---

## Implementation order

1. **Clarification targetField and apply in generator** – Extend clarification schema and prompt; pass clarificationValues + clarifications from sidebar into generator; apply values to node data (email subject/body/to, delay, slack channel/message, HTTP params).
2. **Per-node reason** – Add `reason` to steps JSON and base/node schemas; generator sets `data.reason`; node cards display it.
3. **Edge-case prompt** – Tighten requirement-ai prompt for rejection path, empty list, retry/notify.
4. **API discovery context** – Pass userSummary and previousSteps into selectOperationByAI; discovery builds summary from clarificationValues; generator passes clarifications into discovery; ensure fallback URL in catalog.

---

## Summary


| Area                         | Change                                                                                                                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User answers in workflow** | Add optional `targetField` to clarifications; pass `clarificationValues` and clarifications from sidebar to generator; overlay values onto node data (subject, body, to, delayHours, channel, HTTP params) by step and targetField.       |
| **Per-node comment**         | Add optional `reason` to each step in AI output and to node data; generator sets `data.reason`; node UIs show "Why: {reason}".                                                                                                            |
| **Edge cases**               | Strengthen requirement-ai prompt to require steps for approval rejected, empty list, and failure/retry; add reasons that reference these scenarios.                                                                                       |
| **API spec**                 | Enrich selectOperationByAI with userSummary and previousSteps; discovery builds summary from clarificationValues and passes it; paramMapping can use literals and `{{stepId.key}}`; ensure generic HTTP fallback has a valid urlTemplate. |


