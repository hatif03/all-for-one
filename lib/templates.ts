import { nanoid } from "nanoid";
import { Workflow, getCleanedWorkflow } from "./workflow-store";

/**
 * Starter templates aligned to the AI-Powered Business Workflow Generator vision:
 * conversational requirements → multi-system integration → approval & deployment.
 * Use "Create with AI" in the sidebar to generate a full workflow from plain English.
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
        id: "onb-slack",
        type: "action-slack",
        position: { x: 0, y: 400 },
        data: {
          operation: "post_message",
          channel: "#general",
          message: "Welcome {{new_hire_name}} to the team!",
        },
        width: 280,
        height: 200,
      },
      {
        id: "onb-annotation",
        type: "annotation",
        position: { x: 320, y: 80 },
        data: {
          text: "**Employee onboarding**\n\nStarter: welcome email → Slack announcement.\n\nUse **Create with AI** to add: account creation, access provisioning, training scheduling, and more systems.",
        },
        width: 320,
        height: 180,
      },
    ],
    edges: [
      { id: "onb-e1", source: "onb-trigger", target: "onb-email" },
      { id: "onb-e2", source: "onb-email", target: "onb-slack" },
    ],
  },
  {
    name: "Expense approval",
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
        id: "exp-annotation",
        type: "annotation",
        position: { x: 320, y: 80 },
        data: {
          text: "**Expense approval**\n\nTrigger → approval gate. Add **Create with AI** steps for: notify approver, update ledger, send receipt, or reject path.",
        },
        width: 320,
        height: 200,
      },
    ],
    edges: [{ id: "exp-e1", source: "exp-trigger", target: "exp-approval" }],
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
          extractFields: "",
        },
        width: 280,
        height: 200,
      },
      {
        id: "doc-annotation",
        type: "annotation",
        position: { x: 320, y: 80 },
        data: {
          text: "**Document processing**\n\nStarter: trigger → extract/process document.\n\nUse **Create with AI** to add: validation, data mapping, CRM/DB updates, or notifications.",
        },
        width: 320,
        height: 200,
      },
    ],
    edges: [{ id: "doc-e1", source: "doc-trigger", target: "doc-action" }],
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
        id: "cmp-approval",
        type: "control-approval",
        position: { x: 0, y: 160 },
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
        position: { x: 0, y: 400 },
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
        position: { x: 320, y: 80 },
        data: {
          text: "**Human-in-the-loop**\n\nTrigger → approval gate → notify. Aligns with: “AI generates, humans approve deployment.” Add conditions or more steps with **Create with AI**.",
        },
        width: 340,
        height: 220,
      },
    ],
    edges: [
      { id: "cmp-e1", source: "cmp-trigger", target: "cmp-approval" },
      { id: "cmp-e2", source: "cmp-approval", target: "cmp-email" },
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
