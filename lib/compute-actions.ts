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
      const body =
        config.method !== "GET" && config.body != null
          ? config.bodyType === "json"
            ? JSON.stringify(typeof config.body === "string" ? tryParseJson(config.body) : config.body)
            : String(config.body)
          : undefined;

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

export const computeActionEmail: ComputeNodeFunction<Record<string, unknown>> = async (
  _inputs,
  data,
  abortSignal,
  _nodeId
) => {
  const parsed = actionEmailDataSchema.safeParse(data);
  const config = parsed.success ? parsed.data : { service: "SendGrid", to: "", subject: "", body: "" };
  const token = useConnectionsStore.getState().getConnection(config.service === "Gmail" ? "Gmail" : "SendGrid");
  if (!token) {
    return { ...data, loading: false, error: `Connect ${config.service} in Connections to send email.`, output: undefined };
  }
  const op = getOperation(config.service === "Gmail" ? "gmail" : "sendgrid", config.service === "Gmail" ? "gmail-send" : "sendgrid-send");
  if (!op?.urlTemplate) {
    return { ...data, loading: false, error: "Email operation not found in catalog.", output: undefined };
  }
  try {
    if (config.service === "SendGrid") {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: config.to }] }],
          from: { email: "noreply@workflow.local", name: "Workflow" },
          subject: config.subject,
          content: [{ type: "text/plain", value: config.body ?? "" }],
        }),
        signal: abortSignal,
      });
      if (!res.ok) throw new Error(`SendGrid ${res.status}: ${await res.text()}`);
      return { ...data, loading: false, error: undefined, output: JSON.stringify({ sent: true, to: config.to }) };
    }
    return { ...data, loading: false, error: "Gmail send not implemented; use SendGrid or HTTP node.", output: undefined };
  } catch (err) {
    return { ...data, loading: false, error: err instanceof Error ? err.message : String(err), output: undefined };
  }
};

export const computeActionSlack: ComputeNodeFunction<Record<string, unknown>> = async (
  _inputs,
  data,
  abortSignal,
  _nodeId
) => {
  const parsed = actionSlackDataSchema.safeParse(data);
  const config = parsed.success ? parsed.data : { operation: "post_message", channel: "", message: "" };
  const token = useConnectionsStore.getState().getConnection("Slack");
  if (!token) {
    return { ...data, loading: false, error: "Connect Slack in Connections.", output: undefined };
  }
  try {
    if (config.operation === "post_message") {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: config.channel || "#general", text: config.message ?? "" }),
        signal: abortSignal,
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? `Slack ${res.status}`);
      return { ...data, loading: false, error: undefined, output: JSON.stringify(json) };
    }
    return { ...data, loading: false, error: "Only post_message is supported.", output: undefined };
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
