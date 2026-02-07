# One for All

<p align="center">
  <img src="public/all-might.png" alt="One for All" width="200" />
</p>

<h4 align="center">
  AI-Powered Business Workflow Generator
</h4>

<p align="center">
  Turn natural language into production-ready workflows. Describe what you need in plain English—get executable workflows with email, Slack, approvals, and more. No code required.
</p>

<p align="center">
  <a href="https://github.com/hatif03/one-for-all/blob/main/LICENSE">
    <img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  </a>
</p>

---

## What Problem It Solves

Business teams know what they want to automate—onboarding, approvals, notifications—but building workflows usually means waiting on developers. **One for All** bridges that gap: describe your process in plain English, and the AI turns it into a working workflow you can run, edit in natural language, and export to tools like n8n.

You can still build from scratch with a full node-based canvas, chain AI steps for content and analysis, and reuse everything. One app for both conversational workflow generation and hands-on automation design.

---

## Features

### Create with AI

- **Natural language to workflow** — Describe your process (e.g. “When a new employee is hired, send a welcome email, add them to Slack, and schedule training”). The AI clarifies if needed, breaks it into steps, and generates a workflow on the canvas.
- **Intent-based API discovery** — Steps are mapped to actions (email, Slack, HTTP, approvals, delays) from a catalog so the right “nodes” are chosen from your description.
- **Human in the loop** — Review the generated workflow, **edit in natural language** (“Add a delay before the reminder”), and **Approve & deploy** when you’re ready. No automatic deployment without your OK.
- **Self-debugging** — If a node fails when you run the workflow, use **Debug with AI** to send the error and workflow to the model; it suggests a fix and you can re-run.
- **Learning from examples** — Save successful workflows as templates so future generations follow similar patterns (few-shot in the AI).

### Build from Scratch

- **Infinite canvas** — Node-based workflow editor with pan, zoom, and selection.
- **Rich node set** — Triggers (manual, webhook, schedule), actions (HTTP, email, Slack, document), control flow (delay, condition, approval), data transform, plus Prompt, AI, Markdown, and Annotation nodes.
- **Chain AI and actions** — Connect prompts and AI nodes for content, then plug in email, Slack, or HTTP nodes for real-world actions.
- **Bring your own keys** — Use your API keys for LLMs (Google, OpenAI, Anthropic, xAI) and **Connections** for Gmail/SendGrid and Slack. Everything runs in the browser; keys stay local.

### Export & Integrate

- **Export for n8n** — Export the current workflow as n8n-compatible JSON and paste it into n8n.
- **Export to clipboard** — Copy the workflow as JSON for backup or custom tooling.

### Experience

- Free and open-source (MIT).
- Runs entirely in your browser; your data stays private.
- Dark mode, responsive layout, local persistence.
- Add nodes via the **Add node** dropdown (top-left), grouped by Triggers, Actions, Control flow, and Data & AI.

---

## Use Cases

**HR & onboarding**  
“When a new employee is hired, send a welcome email, add them to Slack, and schedule training.” Describe it once; get a runnable workflow with email, Slack, and delay/approval steps.

**Expense & approvals**  
Multi-step approval flows with human approval nodes, conditions, and notifications.

**Document processing**  
Combine AI nodes for extraction or summarization with document and data nodes.

**Content & productivity**  
Reusable AI chains: proofread, summarize, translate, or generate social posts from a single prompt. Chain Prompt → AI → Markdown and add HTTP/email/Slack where needed.

**Compliance & checks**  
Scheduled or trigger-based workflows with conditions and approval gates.

---

## Deploy on Vercel

1. Push the repo to GitHub (or GitLab/Bitbucket).
2. In [Vercel](https://vercel.com), **Add New** → **Project** and import the repo.
3. Leave **Framework Preset** as Next.js and **Build Command** as `pnpm run build` (or leave default).
4. (Optional) Under **Environment Variables**, add `NEXT_PUBLIC_POSTHOG_KEY` if you use PostHog analytics.
5. Click **Deploy**.

The app runs in the browser; API keys and connections are set in the app and stored locally, so no other env vars are required for core features.

---

## Quick Start

Runs in the browser—no backend required. Clone, install, and open the app.

```bash
git clone https://github.com/hatif03/one-for-all.git
cd one-for-all
pnpm install
pnpm dev
```

Then either:

1. **Create with AI** — In the sidebar, click **Create with AI**. Describe your workflow in plain English, answer a couple of questions if asked, then click **Generate workflow**. Review, run, use **Edit in NL** or **Debug with AI** as needed, and **Approve & deploy** when ready.
2. **Build from scratch** — Click **New Workflow**, then use **Add node** (top-left) to add triggers, actions, control nodes, or AI/Markdown/Prompt/Annotation. Connect them and run from the trigger or any node.

**Connections** (sidebar) — Add API keys for Gmail/SendGrid and Slack so email and Slack nodes can run. **API Keys** (sidebar) — Add keys for the AI models you use.

---

## Node Types

| Category      | Nodes | Purpose |
|---------------|-------|--------|
| **Triggers**  | Manual, Webhook, Schedule | Start a run manually, via HTTP, or on a schedule. |
| **Actions**   | HTTP, Email, Slack, Document | Call APIs, send email/Slack, process documents. |
| **Control**   | Delay, Condition, Approval | Wait, branch on conditions, pause for human approval. |
| **Data & AI** | Transform, Prompt, AI, Markdown, Annotation | Map data; provide input; run LLM; display output; document. |

Each runnable node has a **Run** button; output flows to connected nodes. Approval nodes show **Approve** / **Reject** when the run is waiting.

---

## Tech Stack

- **Next.js** (App Router), **React**, **TypeScript**
- **React Flow** — canvas and nodes
- **Vercel AI SDK** — LLM calls (generateText, streamText) with multiple providers
- **Zustand** — workflow state, API keys, connections, requirement chat
- **Tailwind CSS**, **shadcn/ui** — layout and components

---

## Architecture

The app is a single-page workflow builder: the **sidebar** holds “Create with AI” (requirement chat), API Keys, Connections, and workflow list; the **canvas** is a React Flow graph of nodes and edges. All state lives in **Zustand** stores; **Vercel AI SDK** powers requirement decomposition, workflow generation, edit-in-NL, and debug-with-AI.

Detailed architecture diagrams (high-level system, AI workflow creation flow, node execution flow, project structure) are in **[docs/architecture.md](docs/architecture.md)**. The diagrams are in Mermaid and render on GitHub and in most Markdown viewers.

| Layer | Key pieces |
|-------|------------|
| **UI** | `app/page.tsx`, `components/workflow.tsx`, `components/app-sidebar.tsx`, `components/nodes/*`, `components/ui/*` |
| **State** | `lib/*-store.ts` (workflow, requirement, api-key, connections, openapi, examples) |
| **Logic** | `lib/requirement-ai.ts`, `lib/workflow-generator.ts`, `lib/api-discovery.ts`, `lib/compute.ts`, `lib/export-n8n.ts` |

---

## Contributing

- Found a bug or have a feature idea? [Open an issue](https://github.com/hatif03/one-for-all/issues).
- Want to contribute? We welcome PRs and suggestions in discussions.

---

## Credits

- **React Flow** — [reactflow.dev](https://reactflow.dev/)
- **Vercel AI SDK** — [sdk.vercel.ai](https://sdk.vercel.ai/)
- **Inspiration** — tldraw computer and low-code workflow tools

---

## License

MIT. See [LICENSE](LICENSE) for details.
