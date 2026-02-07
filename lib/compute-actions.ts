import type { ComputeNodeFunction, ComputeNodeInput } from "./compute";
import { useConnectionsStore } from "./connections-store";
import { getOperation } from "./api-catalog";
import {
  actionHttpDataSchema,
  actionEmailDataSchema,
  actionSlackDataSchema,
  controlDelayDataSchema,
  controlApprovalDataSchema,
  controlConditionDataSchema,
} from "./node-types";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

export const computeActionHttp: ComputeNodeFunction<Record<string, unknown>> = async (
  inputs: ComputeNodeInput[],
  data: Record<string, unknown>,
  abortSignal: AbortSignal,
  _nodeId: string
) => {
  const parsed = actionHttpDataSchema.safeParse(data);
  const config = parsed.success ? parsed.data : { method: "GET" as const, url: "", body: undefined, headers: undefined, bodyType: "json" as const };

  if (!config.url?.trim()) {
    return {
      ...data,
      loading: false,
      error: "URL is required",
      output: undefined,
    };
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (abortSignal?.aborted) throw new Error("Operation was aborted");
    try {
      let body: string | undefined;
      if (config.method !== "GET") {
        if (config.catalogParamValues && typeof config.catalogParamValues === "object") {
          body = JSON.stringify(config.catalogParamValues);
        } else if (config.body != null) {
          body =
            config.bodyType === "json"
              ? JSON.stringify(typeof config.body === "string" ? tryParseJson(config.body) : config.body)
              : String(config.body);
        }
      }

      const res = await fetch(config.url, {
        method: config.method,
        headers: {
          "Content-Type": "application/json",
          ...config.headers,
        },
        body,
        signal: abortSignal,
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      return {
        ...data,
        loading: false,
        error: undefined,
        output: text,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  return {
    ...data,
    loading: false,
    error: lastError?.message ?? "Request failed",
    output: undefined,
  };
};

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function getRowsFromInputs(inputs: ComputeNodeInput[]): Record<string, unknown>[] {
  const raw = inputs[0]?.output;
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw) as { rows?: Record<string, unknown>[] };
    return Array.isArray(parsed.rows) ? parsed.rows : [];
  } catch {
    return [];
  }
}

export const computeActionEmail: ComputeNodeFunction<Record<string, unknown>> = async (
  inputs,
  data,
  abortSignal,
  _nodeId
) => {
  const parsed = actionEmailDataSchema.safeParse(data);
  const config = parsed.success
    ? parsed.data
    : {
        service: "SendGrid",
        operation: "send" as const,
        to: "",
        subject: "",
        body: "",
        toSource: "single" as const,
        toListField: "email",
      };
  const operation = config.operation ?? "send";

  if (operation === "list" || operation === "get") {
    const gmailToken = useConnectionsStore.getState().getConnection("Gmail");
    if (!gmailToken) {
      return { ...data, loading: false, error: "Connect Gmail in Connections to list/get messages.", output: undefined };
    }
    try {
      if (operation === "list") {
        const query = config.query?.trim() ? encodeURIComponent(config.query) : "";
        const maxResults = config.maxResults != null ? Math.min(Math.max(1, config.maxResults), 100) : 50;
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}${query ? `&q=${query}` : ""}`;
        const res = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${gmailToken}` },
          signal: abortSignal,
        });
        if (!res.ok) throw new Error(`Gmail ${res.status}: ${await res.text()}`);
        const json = await res.json();
        return { ...data, loading: false, error: undefined, output: JSON.stringify(json) };
      }
      const messageId = config.messageId?.trim();
      if (!messageId) {
        return { ...data, loading: false, error: "Message ID is required.", output: undefined };
      }
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${gmailToken}` },
          signal: abortSignal,
        }
      );
      if (!res.ok) throw new Error(`Gmail ${res.status}: ${await res.text()}`);
      const json = await res.json();
      return { ...data, loading: false, error: undefined, output: JSON.stringify(json) };
    } catch (err) {
      return { ...data, loading: false, error: err instanceof Error ? err.message : String(err), output: undefined };
    }
  }

  const token = useConnectionsStore.getState().getConnection(config.service === "Gmail" ? "Gmail" : "SendGrid");
  if (!token) {
    return { ...data, loading: false, error: `Connect ${config.service} in Connections to send email.`, output: undefined };
  }
  const op = getOperation(config.service === "Gmail" ? "gmail" : "sendgrid", config.service === "Gmail" ? "gmail-send" : "sendgrid-send");
  if (!op?.urlTemplate) {
    return { ...data, loading: false, error: "Email operation not found in catalog.", output: undefined };
  }

  const isList = config.toSource === "list";
  const rows = isList ? getRowsFromInputs(inputs) : [];
  const recipients: string[] = isList
    ? rows
        .map((row) => {
          const key = config.toListField ?? "email";
          return String(row[key] ?? row.email ?? row.value ?? "");
        })
        .filter((t) => t.length > 0)
    : config.to ? [config.to] : [];

  type SendSpec = { to: string; subject: string; body: string };
  const items = Array.isArray(config.items) ? config.items : [];
  const sends: SendSpec[] =
    items.length > 0
      ? items
          .map((item: { to?: string; subject?: string; body?: string }) => ({
            to: String(item.to ?? "").trim(),
            subject: String(item.subject ?? ""),
            body: String(item.body ?? ""),
          }))
          .filter((s) => s.to.length > 0)
      : recipients.map((to) => ({
          to,
          subject: config.subject ?? "",
          body: config.body ?? "",
        }));

  if (sends.length === 0) {
    return { ...data, loading: false, error: "No recipient (To or list column).", output: undefined };
  }

  function base64urlEncode(str: string): string {
    let base64: string;
    if (typeof Buffer !== "undefined") {
      base64 = Buffer.from(str, "utf8").toString("base64");
    } else {
      base64 = btoa(unescape(encodeURIComponent(str)));
    }
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  const sendOne = async (spec: SendSpec): Promise<void> => {
    const { to, subject, body } = spec;
    if (config.service === "SendGrid") {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: "noreply@workflow.local", name: "Workflow" },
          subject,
          content: [{ type: "text/plain", value: body ?? "" }],
        }),
        signal: abortSignal,
      });
      if (!res.ok) throw new Error(`SendGrid ${res.status}: ${await res.text()}`);
      return;
    }
    if (config.service === "Gmail") {
      const subj = (subject ?? "").replace(/\r?\n/g, " ");
      const rfc2822 = [
        "Content-Type: text/plain; charset=UTF-8",
        "From: me",
        `To: ${to}`,
        `Subject: ${subj}`,
        "",
        body ?? "",
      ].join("\r\n");
      const raw = base64urlEncode(rfc2822);
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
        signal: abortSignal,
      });
      if (!res.ok) throw new Error(`Gmail ${res.status}: ${await res.text()}`);
    }
  };

  try {
    for (const spec of sends) {
      if (abortSignal?.aborted) throw new Error("Operation was aborted");
      await sendOne(spec);
    }
    return {
      ...data,
      loading: false,
      error: undefined,
      output: JSON.stringify({ sent: true, count: sends.length, to: sends.map((s) => s.to) }),
    };
  } catch (err) {
    return { ...data, loading: false, error: err instanceof Error ? err.message : String(err), output: undefined };
  }
};

async function slackApi(
  token: string,
  path: string,
  body: Record<string, unknown>,
  abortSignal?: AbortSignal
): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  const res = await fetch(`https://slack.com/api/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: abortSignal,
  });
  return res.json();
}

export const computeActionSlack: ComputeNodeFunction<Record<string, unknown>> = async (
  _inputs,
  data,
  abortSignal,
  _nodeId
) => {
  const parsed = actionSlackDataSchema.safeParse(data);
  const config: {
    operation?: string;
    channel?: string;
    message?: string;
    email?: string;
    userId?: string;
    channelName?: string;
    isPrivate?: boolean;
    users?: string;
    limit?: number;
    timestamp?: string;
    reactionName?: string;
    items?: Array<{ channel?: string; message?: string }>;
  } = parsed.success ? parsed.data : { operation: "post_message", channel: "", message: "" };
  const token = useConnectionsStore.getState().getConnection("Slack");
  if (!token) {
    return { ...data, loading: false, error: "Connect Slack in Connections.", output: undefined };
  }
  try {
    if (config.operation === "post_message" || !config.operation) {
      const items = Array.isArray(config.items) ? config.items : [];
      const posts: { channel: string; message: string }[] =
        items.length > 0
          ? items.map((item: { channel?: string; message?: string }) => ({
              channel: String(item.channel ?? "#general").trim() || "#general",
              message: String(item.message ?? ""),
            }))
          : [{ channel: config.channel || "#general", message: config.message ?? "" }];
      const results: unknown[] = [];
      for (const post of posts) {
        if (abortSignal?.aborted) throw new Error("Operation was aborted");
        const json = await slackApi(token, "chat.postMessage", { channel: post.channel, text: post.message }, abortSignal);
        if (!json.ok) throw new Error((json as { error?: string }).error ?? "Slack request failed");
        results.push(json);
      }
      return {
        ...data,
        loading: false,
        error: undefined,
        output: JSON.stringify(results.length === 1 ? results[0] : { sent: true, count: results.length, results }),
      };
    }
    if (config.operation === "invite_user") {
      const email = config.email ?? config.userId;
      if (!email) {
        return { ...data, loading: false, error: "Email is required for invite.", output: undefined };
      }
      const json = await slackApi(token, "users.admin.invite", { email }, abortSignal);
      if (!json.ok) throw new Error((json as { error?: string }).error ?? "Slack invite failed");
      return { ...data, loading: false, error: undefined, output: JSON.stringify(json) };
    }
    if (config.operation === "create_channel") {
      const name = config.channelName?.trim();
      if (!name) {
        return { ...data, loading: false, error: "Channel name is required.", output: undefined };
      }
      const json = await slackApi(
        token,
        "conversations.create",
        { name, is_private: config.isPrivate ?? false },
        abortSignal
      );
      if (!json.ok) throw new Error((json as { error?: string }).error ?? "Slack create channel failed");
      return { ...data, loading: false, error: undefined, output: JSON.stringify(json) };
    }
    if (config.operation === "invite_to_channel") {
      const channel = config.channel?.trim();
      const usersStr = config.users?.trim();
      if (!channel || !usersStr) {
        return { ...data, loading: false, error: "Channel and user IDs are required.", output: undefined };
      }
      const users = usersStr.split(",").map((u) => u.trim()).filter(Boolean);
      const json = await slackApi(token, "conversations.invite", { channel, users }, abortSignal);
      if (!json.ok) throw new Error((json as { error?: string }).error ?? "Slack invite to channel failed");
      return { ...data, loading: false, error: undefined, output: JSON.stringify(json) };
    }
    if (config.operation === "channel_history") {
      const channel = config.channel?.trim();
      if (!channel) {
        return { ...data, loading: false, error: "Channel ID is required.", output: undefined };
      }
      const limit = Math.min(Math.max(1, config.limit ?? 10), 100);
      const json = await slackApi(token, "conversations.history", { channel, limit }, abortSignal);
      if (!json.ok) throw new Error((json as { error?: string }).error ?? "Slack history failed");
      const messages = (json as { messages?: unknown[] }).messages ?? [];
      return { ...data, loading: false, error: undefined, output: JSON.stringify({ messages }) };
    }
    if (config.operation === "list_channels") {
      const limit = config.limit != null ? Math.min(Math.max(1, config.limit), 100) : 100;
      const json = await slackApi(token, "conversations.list", { limit }, abortSignal);
      if (!json.ok) throw new Error((json as { error?: string }).error ?? "Slack list channels failed");
      const channels = (json as { channels?: unknown[] }).channels ?? [];
      return { ...data, loading: false, error: undefined, output: JSON.stringify({ channels }) };
    }
    if (config.operation === "reaction") {
      const channel = config.channel?.trim();
      const timestamp = config.timestamp?.trim();
      const name = config.reactionName?.trim();
      if (!channel || !timestamp || !name) {
        return { ...data, loading: false, error: "Channel, timestamp, and emoji name are required.", output: undefined };
      }
      const json = await slackApi(token, "reactions.add", { channel, timestamp, name }, abortSignal);
      if (!json.ok) throw new Error((json as { error?: string }).error ?? "Slack reaction failed");
      return { ...data, loading: false, error: undefined, output: JSON.stringify(json) };
    }
    return { ...data, loading: false, error: `Unsupported Slack operation: ${config.operation}`, output: undefined };
  } catch (err) {
    return { ...data, loading: false, error: err instanceof Error ? err.message : String(err), output: undefined };
  }
};

export const computeControlDelay: ComputeNodeFunction<Record<string, unknown>> = async (
  inputs,
  data,
  abortSignal,
  _nodeId
) => {
  const parsed = controlDelayDataSchema.safeParse(data);
  const config = parsed.success ? parsed.data : {};
  const ms = ((config.delayMinutes ?? 0) * 60 + (config.delayHours ?? 0) * 3600) * 1000;
  if (ms > 0) {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, Math.min(ms, 10000));
      abortSignal?.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new Error("Operation was aborted"));
      });
    });
  }
  const lastInput = inputs.length > 0 ? inputs[inputs.length - 1].output : "{}";
  return { ...data, loading: false, error: undefined, output: lastInput };
};

export const computeControlApproval: ComputeNodeFunction<Record<string, unknown>> = async (
  inputs,
  data,
  _abortSignal,
  _nodeId
) => {
  const parsed = controlApprovalDataSchema.safeParse(data);
  const config = parsed.success ? parsed.data : {};
  if (config.approved === true) {
    const lastInput = inputs.length > 0 ? inputs[inputs.length - 1].output : "{}";
    return {
      ...data,
      loading: false,
      error: undefined,
      output: lastInput,
      approved: true,
      pendingApproval: false,
    };
  }
  return {
    ...data,
    loading: false,
    error: undefined,
    output: JSON.stringify({ status: "pending_approval", title: config.title, description: config.description }),
    pendingApproval: true,
    approved: false,
  };
};

export const computeControlCondition: ComputeNodeFunction<Record<string, unknown>> = async (
  inputs,
  data,
  _abortSignal,
  _nodeId
) => {
  const parsed = controlConditionDataSchema.safeParse(data);
  const config = parsed.success ? parsed.data : {};
  const left = String(config.leftOperand ?? "").trim();
  const right = String(config.rightOperand ?? "").trim();
  const op = config.operator ?? "eq";
  let result = false;
  switch (op) {
    case "eq":
      result = left === right;
      break;
    case "neq":
      result = left !== right;
      break;
    case "contains":
      result = left.includes(right);
      break;
    case "gt":
      result = Number(left) > Number(right);
      break;
    case "lt":
      result = Number(left) < Number(right);
      break;
    default:
      result = false;
  }
  const branch = result ? "true" : "false";
  return {
    ...data,
    loading: false,
    error: undefined,
    branch,
    output: JSON.stringify({ branch, result }),
  };
};
