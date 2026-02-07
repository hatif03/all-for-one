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
  /** Optional link to API documentation (e.g. developer docs). */
  docsUrl?: string;
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
      {
        id: "gmail-list",
        name: "List messages",
        description: "List or search Gmail messages",
        method: "GET",
        urlTemplate: "https://gmail.googleapis.com/gmail/v1/users/me/messages",
        connectionKey: "Gmail",
        params: [
          { key: "query", required: false, description: "Search query (e.g. is:unread)" },
          { key: "maxResults", required: false, description: "Max number of messages" },
        ],
        intentKeywords: ["list emails", "get emails", "check inbox", "unread", "search emails"],
      },
      {
        id: "gmail-get",
        name: "Get message",
        description: "Get a single Gmail message by ID",
        method: "GET",
        urlTemplate: "https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}",
        connectionKey: "Gmail",
        params: [{ key: "id", required: true, description: "Message ID" }],
        intentKeywords: ["get email", "read email", "fetch message"],
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
        params: [{ key: "email", required: true, description: "User email" }],
        intentKeywords: ["invite to slack", "add user to slack"],
      },
      {
        id: "slack-create-channel",
        name: "Create channel",
        description: "Create a new public or private channel",
        method: "POST",
        urlTemplate: "https://slack.com/api/conversations.create",
        connectionKey: "Slack",
        params: [
          { key: "name", required: true, description: "Channel name" },
          { key: "is_private", required: false, description: "Create as private" },
        ],
        intentKeywords: ["create channel", "create slack channel", "new channel"],
      },
      {
        id: "slack-invite-to-channel",
        name: "Invite to channel",
        description: "Invite users to a channel",
        method: "POST",
        urlTemplate: "https://slack.com/api/conversations.invite",
        connectionKey: "Slack",
        params: [
          { key: "channel", required: true, description: "Channel ID" },
          { key: "users", required: true, description: "Comma-separated user IDs" },
        ],
        intentKeywords: ["invite to channel", "add user to channel", "add to channel"],
      },
      {
        id: "slack-channel-history",
        name: "Read channel history",
        description: "Get recent messages from a channel",
        method: "GET",
        urlTemplate: "https://slack.com/api/conversations.history",
        connectionKey: "Slack",
        params: [
          { key: "channel", required: true, description: "Channel ID" },
          { key: "limit", required: false, description: "Number of messages" },
        ],
        intentKeywords: ["read slack messages", "get channel history", "recent messages", "messages from channel", "slack context"],
      },
      {
        id: "slack-list-channels",
        name: "List channels",
        description: "List available channels",
        method: "GET",
        urlTemplate: "https://slack.com/api/conversations.list",
        connectionKey: "Slack",
        params: [{ key: "limit", required: false, description: "Max channels to return" }],
        intentKeywords: ["list channels", "list slack channels"],
      },
      {
        id: "slack-reaction",
        name: "Add reaction",
        description: "Add an emoji reaction to a message",
        method: "POST",
        urlTemplate: "https://slack.com/api/reactions.add",
        connectionKey: "Slack",
        params: [
          { key: "channel", required: true, description: "Channel ID" },
          { key: "timestamp", required: true, description: "Message timestamp" },
          { key: "name", required: true, description: "Emoji name (e.g. thumbsup)" },
        ],
        intentKeywords: ["add reaction", "react to message", "emoji"],
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
        urlTemplate: "https://api.example.com/action",
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
