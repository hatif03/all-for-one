import { nanoid } from "nanoid";
import type { Edge, Node } from "@xyflow/react";
import { Workflow, getCleanedWorkflow } from "./workflow-store";

/** One-line plain-language description per template for the template picker. */
export const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  "Employee onboarding": "Onboard new hires: welcome email, wait 24h, Slack, approval, then call API.",
  "Expense approval (with branches)": "Approve or reject expenses; send different emails for approved vs rejected.",
  "Document processing": "Extract from PDF, transform data, send to API, then notify by email.",
  "Compliance / approval chain": "Wait 24h, then compliance review and approval before notifying.",
  "Scheduled report (trigger-schedule)": "Run on a schedule: fetch report, email it, post to Slack.",
};

/**
 * Starter templates that showcase the full capabilities of the workflow builder:
 * triggers (manual, webhook, schedule), actions (email, Slack, HTTP, document),
 * control flow (approval, delay, condition with branches), and data transform.
 */
const TEMPLATE_DEFINITIONS: Omit<Workflow, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "Employee onboarding",
    nodes: [
      {
        id: "onb-trigger",
        type: "trigger-manual",
        position: { x: 0, y: 0 },
        data: {},
        width: 280,
        height: 120,
      },
      {
        id: "onb-email",
        type: "action-email",
        position: { x: 0, y: 160 },
        data: {
          service: "SendGrid",
          to: "{{new_hire_email}}",
          subject: "Welcome to the team",
          body: "Hi!\n\nWe're excited to have you. Your accounts are being set up.",
        },
        width: 280,
        height: 200,
      },
      {
        id: "onb-delay",
        type: "control-delay",
        position: { x: 0, y: 400 },
        data: { delayHours: 24, delayMinutes: 0 },
        width: 280,
        height: 180,
      },
      {
        id: "onb-slack",
        type: "action-slack",
        position: { x: 0, y: 620 },
        data: {
          operation: "post_message",
          channel: "#general",
          message: "Welcome {{new_hire_name}} to the team!",
        },
        width: 280,
        height: 200,
      },
      {
        id: "onb-approval",
        type: "control-approval",
        position: { x: 0, y: 860 },
        data: {
          title: "Confirm accounts created",
          description: "Verify HR/IT has created accounts, then approve to continue.",
        },
        width: 280,
        height: 200,
      },
      {
        id: "onb-http",
        type: "action-http",
        position: { x: 0, y: 1100 },
        data: {
          method: "POST",
          url: "https://api.example.com/onboarding/complete",
          body: "{}",
          bodyType: "json",
        },
        width: 280,
        height: 200,
      },
      {
        id: "onb-annotation",
        type: "annotation",
        position: { x: 360, y: 80 },
        data: {
          text: "**Full onboarding flow**\n\nTrigger → Welcome email → Wait 24h → Slack → Approval gate → Call API. Shows: email, delay, Slack, approval, HTTP.",
        },
        width: 340,
        height: 200,
      },
    ],
    edges: [
      { id: "onb-e1", source: "onb-trigger", target: "onb-email" },
      { id: "onb-e2", source: "onb-email", target: "onb-delay" },
      { id: "onb-e3", source: "onb-delay", target: "onb-slack" },
      { id: "onb-e4", source: "onb-slack", target: "onb-approval" },
      { id: "onb-e5", source: "onb-approval", target: "onb-http" },
    ],
  },
  {
    name: "Expense approval (with branches)",
    nodes: [
      {
        id: "exp-trigger",
        type: "trigger-manual",
        position: { x: 0, y: 0 },
        data: {},
        width: 280,
        height: 120,
      },
      {
        id: "exp-approval",
        type: "control-approval",
        position: { x: 0, y: 160 },
        data: {
          title: "Approve expense",
          description: "Review and approve or reject the submitted expense.",
        },
        width: 280,
        height: 200,
      },
      {
        id: "exp-condition",
        type: "control-condition",
        position: { x: 0, y: 400 },
        data: {
          condition: "Expense approved?",
          leftOperand: "{{approval.approved}}",
          operator: "eq",
          rightOperand: "true",
        },
        width: 280,
        height: 180,
      },
      {
        id: "exp-email-approved",
        type: "action-email",
        position: { x: -280, y: 620 },
        data: {
          service: "SendGrid",
          to: "{{requester_email}}",
          subject: "Expense approved",
          body: "Your expense has been approved and will be reimbursed.",
        },
        width: 280,
        height: 200,
      },
      {
        id: "exp-email-rejected",
        type: "action-email",
        position: { x: 280, y: 620 },
        data: {
          service: "SendGrid",
          to: "{{requester_email}}",
          subject: "Expense rejected",
          body: "Your expense was not approved. Contact your manager for details.",
        },
        width: 280,
        height: 200,
      },
      {
        id: "exp-annotation",
        type: "annotation",
        position: { x: 360, y: 80 },
        data: {
          text: "**Conditional branching**\n\nApproval → Condition (approved?) → True: send receipt; False: send rejection. Uses **control-condition** with two output handles.",
        },
        width: 340,
        height: 220,
      },
    ],
    edges: [
      { id: "exp-e1", source: "exp-trigger", target: "exp-approval" },
      { id: "exp-e2", source: "exp-approval", target: "exp-condition" },
      { id: "exp-e3", source: "exp-condition", target: "exp-email-approved", sourceHandle: "true" },
      { id: "exp-e4", source: "exp-condition", target: "exp-email-rejected", sourceHandle: "false" },
    ],
  },
  {
    name: "Document processing",
    nodes: [
      {
        id: "doc-trigger",
        type: "trigger-manual",
        position: { x: 0, y: 0 },
        data: {},
        width: 280,
        height: 120,
      },
      {
        id: "doc-action",
        type: "action-document",
        position: { x: 0, y: 160 },
        data: {
          format: "pdf",
          extractFields: "name, email, amount",
        },
        width: 280,
        height: 200,
      },
      {
        id: "doc-transform",
        type: "data-transform",
        position: { x: 0, y: 400 },
        data: {
          mapping: "Map extracted fields to API payload",
          outputKey: "payload",
        },
        width: 280,
        height: 200,
      },
      {
        id: "doc-http",
        type: "action-http",
        position: { x: 0, y: 640 },
        data: {
          method: "POST",
          url: "https://api.example.com/records",
          body: "{{payload}}",
          bodyType: "json",
        },
        width: 280,
        height: 200,
      },
      {
        id: "doc-email",
        type: "action-email",
        position: { x: 0, y: 880 },
        data: {
          service: "SendGrid",
          to: "ops@company.com",
          subject: "Document processed",
          body: "A new document was processed and synced.",
        },
        width: 280,
        height: 200,
      },
      {
        id: "doc-annotation",
        type: "annotation",
        position: { x: 360, y: 80 },
        data: {
          text: "**Document + transform + API**\n\nTrigger → Extract from PDF → Data transform → HTTP (CRM/DB) → Notify. Shows **action-document** and **data-transform**.",
        },
        width: 340,
        height: 220,
      },
    ],
    edges: [
      { id: "doc-e1", source: "doc-trigger", target: "doc-action" },
      { id: "doc-e2", source: "doc-action", target: "doc-transform" },
      { id: "doc-e3", source: "doc-transform", target: "doc-http" },
      { id: "doc-e4", source: "doc-http", target: "doc-email" },
    ],
  },
  {
    name: "Compliance / approval chain",
    nodes: [
      {
        id: "cmp-trigger",
        type: "trigger-manual",
        position: { x: 0, y: 0 },
        data: {},
        width: 280,
        height: 120,
      },
      {
        id: "cmp-delay",
        type: "control-delay",
        position: { x: 0, y: 160 },
        data: { delayHours: 24, delayMinutes: 0 },
        width: 280,
        height: 180,
      },
      {
        id: "cmp-approval",
        type: "control-approval",
        position: { x: 0, y: 380 },
        data: {
          title: "Compliance review",
          description: "Business owner approves before deployment.",
        },
        width: 280,
        height: 200,
      },
      {
        id: "cmp-email",
        type: "action-email",
        position: { x: 0, y: 620 },
        data: {
          service: "SendGrid",
          to: "",
          subject: "Workflow approved and deployed",
          body: "The workflow has been approved and is now live.",
        },
        width: 280,
        height: 200,
      },
      {
        id: "cmp-annotation",
        type: "annotation",
        position: { x: 360, y: 80 },
        data: {
          text: "**Human-in-the-loop**\n\nTrigger → Wait 24h (review window) → Approval → Notify. Shows **control-delay** + **control-approval**.",
        },
        width: 340,
        height: 200,
      },
    ],
    edges: [
      { id: "cmp-e1", source: "cmp-trigger", target: "cmp-delay" },
      { id: "cmp-e2", source: "cmp-delay", target: "cmp-approval" },
      { id: "cmp-e3", source: "cmp-approval", target: "cmp-email" },
    ],
  },
  {
    name: "Scheduled report (trigger-schedule)",
    nodes: [
      {
        id: "sch-trigger",
        type: "trigger-schedule",
        position: { x: 0, y: 0 },
        data: {
          cron: "0 9 * * 1-5",
          description: "Weekdays at 9am",
        },
        width: 280,
        height: 120,
      },
      {
        id: "sch-http",
        type: "action-http",
        position: { x: 0, y: 160 },
        data: {
          method: "GET",
          url: "https://api.example.com/reports/daily",
          bodyType: "json",
        },
        width: 280,
        height: 200,
      },
      {
        id: "sch-email",
        type: "action-email",
        position: { x: 0, y: 400 },
        data: {
          service: "SendGrid",
          to: "team@company.com",
          subject: "Daily report",
          body: "See attached or link for today's report.",
        },
        width: 280,
        height: 200,
      },
      {
        id: "sch-slack",
        type: "action-slack",
        position: { x: 0, y: 640 },
        data: {
          operation: "post_message",
          channel: "#reports",
          message: "Daily report has been sent.",
        },
        width: 280,
        height: 200,
      },
      {
        id: "sch-annotation",
        type: "annotation",
        position: { x: 360, y: 80 },
        data: {
          text: "**Scheduled trigger**\n\nRuns on a schedule (cron). Fetch report → Email → Slack. Uses **trigger-schedule** instead of manual run.",
        },
        width: 340,
        height: 200,
      },
    ],
    edges: [
      { id: "sch-e1", source: "sch-trigger", target: "sch-http" },
      { id: "sch-e2", source: "sch-http", target: "sch-email" },
      { id: "sch-e3", source: "sch-email", target: "sch-slack" },
    ],
  },
];

export const templates: Workflow[] = TEMPLATE_DEFINITIONS.map((def) =>
  getCleanedWorkflow({
    ...def,
    id: nanoid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
).map((c, i) => {
  const id = nanoid();
  const date = new Date(Date.now() - i * 100);
  return {
    ...c,
    id,
    createdAt: date.toISOString(),
    updatedAt: date.toISOString(),
  };
});

/** Return template definitions with description for the template picker. */
export function getTemplatesForPicker(): { name: string; description: string; nodes: Node[]; edges: Edge[] }[] {
  return TEMPLATE_DEFINITIONS.map((def) => ({
    name: def.name,
    description: TEMPLATE_DESCRIPTIONS[def.name] ?? def.name,
    nodes: def.nodes,
    edges: def.edges,
  }));
}

/** Clone nodes and edges with new ids so they can be used in a new workflow. */
export function cloneWorkflowContent(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const idMap = new Map<string, string>();
  const newNodes = nodes.map((n) => {
    const newId = nanoid();
    idMap.set(n.id, newId);
    return { ...n, id: newId, data: { ...n.data } };
  });
  const newEdges = edges.map((e) => ({
    ...e,
    id: nanoid(),
    source: idMap.get(e.source) ?? e.source,
    target: idMap.get(e.target) ?? e.target,
  }));
  return { nodes: newNodes, edges: newEdges };
}

export const newWorkflow: Workflow = getCleanedWorkflow({
  id: "new-blank",
  name: "New workflow",
  nodes: [
    {
      id: "nw-trigger",
      type: "trigger-manual",
      position: { x: 0, y: 0 },
      data: {},
      width: 280,
      height: 120,
    },
    {
      id: "nw-annotation",
      type: "annotation",
      position: { x: 320, y: 40 },
      data: {
        text: "Start from scratch or use **Create with AI** in the sidebar to describe your workflow in plain English and get a ready-to-run flow.",
      },
      width: 320,
      height: 140,
    },
  ],
  edges: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
