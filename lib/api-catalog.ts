/**
 * Curated API catalog for workflow actions.
 * Used by API discovery and workflow generator to map intent to operations.
 */

export type AuthType = "api_key" | "bearer" | "none";

export interface CatalogOperation {
  id: string;
  name: string;
  description: string;
  method: string;
  urlTemplate: string;
  connectionKey: string;
  params: { key: string; required: boolean; description: string }[];
  intentKeywords: string[];
}

export interface CatalogService {
  id: string;
  name: string;
  description: string;
  authType: AuthType;
  connectionKey: string;
  operations: CatalogOperation[];
}

export const apiCatalog: CatalogService[] = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Send and manage email via Gmail API",
    authType: "bearer",
    connectionKey: "Gmail",
    operations: [
      {
        id: "gmail-send",
        name: "Send email",
        description: "Send an email via Gmail",
        method: "POST",
        urlTemplate: "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        connectionKey: "Gmail",
        params: [
          { key: "to", required: true, description: "Recipient email" },
          { key: "subject", required: true, description: "Subject line" },
          { key: "body", required: true, description: "Email body" },
        ],
        intentKeywords: ["send email", "email", "welcome email", "notify by email"],
      },
    ],
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description: "Send transactional email via SendGrid",
    authType: "bearer",
    connectionKey: "SendGrid",
    operations: [
      {
        id: "sendgrid-send",
        name: "Send email",
        description: "Send an email via SendGrid",
        method: "POST",
        urlTemplate: "https://api.sendgrid.com/v3/mail/send",
        connectionKey: "SendGrid",
        params: [
          { key: "to", required: true, description: "Recipient email" },
          { key: "subject", required: true, description: "Subject line" },
          { key: "body", required: true, description: "Email body" },
        ],
        intentKeywords: ["send email", "email", "welcome email"],
      },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Post messages and manage Slack workspace",
    authType: "bearer",
    connectionKey: "Slack",
    operations: [
      {
        id: "slack-post",
        name: "Post message",
        description: "Post a message to a channel",
        method: "POST",
        urlTemplate: "https://slack.com/api/chat.postMessage",
        connectionKey: "Slack",
        params: [
          { key: "channel", required: true, description: "Channel ID or name" },
          { key: "text", required: true, description: "Message text" },
        ],
        intentKeywords: ["post to slack", "slack message", "notify slack", "add to slack"],
      },
      {
        id: "slack-invite",
        name: "Invite user",
        description: "Invite a user to the workspace",
        method: "POST",
        urlTemplate: "https://slack.com/api/users.admin.invite",
        connectionKey: "Slack",
        params: [
          { key: "email", required: true, description: "User email" },
        ],
        intentKeywords: ["invite to slack", "add user to slack"],
      },
    ],
  },
  {
    id: "http",
    name: "Custom HTTP",
    description: "Any HTTP request",
    authType: "none",
    connectionKey: "",
    operations: [
      {
        id: "http-request",
        name: "HTTP request",
        description: "Custom HTTP request",
        method: "GET",
        urlTemplate: "",
        connectionKey: "",
        params: [],
        intentKeywords: ["custom", "api", "http", "webhook"],
      },
    ],
  },
];

export function findOperationByIntent(intent: string): CatalogOperation | null {
  return findOperationByIntentInCatalog(intent, apiCatalog);
}

/** Search a catalog (e.g. built-in + OpenAPI services) by intent. */
export function findOperationByIntentInCatalog(
  intent: string,
  catalog: CatalogService[]
): CatalogOperation | null {
  const lower = intent.toLowerCase();
  for (const service of catalog) {
    for (const op of service.operations) {
      if (op.intentKeywords.some((k) => lower.includes(k.toLowerCase()))) {
        return op;
      }
    }
  }
  return null;
}

export function getOperation(serviceId: string, operationId: string): CatalogOperation | null {
  const service = apiCatalog.find((s) => s.id === serviceId);
  if (!service) return null;
  return service.operations.find((o) => o.id === operationId) ?? null;
}

export function getService(serviceId: string): CatalogService | null {
  return apiCatalog.find((s) => s.id === serviceId) ?? null;
}
