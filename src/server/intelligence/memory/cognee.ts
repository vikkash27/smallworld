const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503]);
const TEXT_FIELDS = new Set(["output_text", "text", "answer", "content"]);

type CogneeFailure = { ok: false; status: number; retryable: boolean };

export interface CogneeTransport {
  configured: boolean;
  remember(
    datasetName: string,
    text: string,
    signal: AbortSignal,
  ): Promise<{ ok: true } | CogneeFailure>;
  recall(
    datasetName: string,
    query: string,
    signal: AbortSignal,
  ): Promise<{ ok: true; text: string } | CogneeFailure>;
}

function failure(status: number, retryable = RETRYABLE_STATUSES.has(status)): CogneeFailure {
  return { ok: false, status, retryable };
}

function authHeaders(apiKey: string, tenantId: string): Record<string, string> {
  const headers: Record<string, string> = { "X-Api-Key": apiKey };
  if (tenantId !== "") headers["X-Tenant-Id"] = tenantId;
  return headers;
}

function stripOneTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * Flatten a recall payload into text. Evidence ids are taken only from this
 * text later; bare id fields are not promoted into the blob.
 */
function collectRecallText(value: unknown): string {
  if (typeof value === "string") return value;
  const parts: string[] = [];

  const visit = (node: unknown, arrayItem: boolean): void => {
    if (typeof node === "string") {
      if (arrayItem) parts.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item, true);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (typeof child === "string" && TEXT_FIELDS.has(key)) {
        parts.push(child);
        continue;
      }
      if (child && typeof child === "object") visit(child, false);
    }
  };

  visit(value, false);
  return parts.join("\n");
}

function recallText(raw: string): string {
  try {
    return collectRecallText(JSON.parse(raw) as unknown);
  } catch {
    return raw;
  }
}

function readConfig(env: NodeJS.ProcessEnv): {
  configured: boolean;
  base: string;
  apiKey: string;
  tenantId: string;
} {
  const baseRaw = env.COGNEE_BASE_URL?.trim() ?? "";
  const apiKey = env.COGNEE_API_KEY?.trim() ?? "";
  const tenantId = env.COGNEE_TENANT_ID?.trim() ?? "";
  const configured = env.COGNEE_ENABLED?.trim() !== "false" && baseRaw !== "" && apiKey !== "";
  return { configured, base: stripOneTrailingSlash(baseRaw), apiKey, tenantId };
}

export function createCogneeTransport(
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch = fetch,
): CogneeTransport {
  const { configured, base, apiKey, tenantId } = readConfig(env);

  if (!configured) {
    const disabled = async (): Promise<CogneeFailure> => failure(0, false);
    return { configured: false, remember: disabled, recall: disabled };
  }

  return {
    configured: true,
    async remember(dataset, text, signal) {
      try {
        const body = new FormData();
        body.append("datasetName", dataset);
        body.append("raw_data", text);
        const response = await fetchImpl(`${base}/api/v1/remember`, {
          method: "POST",
          headers: authHeaders(apiKey, tenantId),
          body,
          signal,
        });
        if (!response.ok) return failure(response.status);
        return { ok: true };
      } catch {
        return failure(0, true);
      }
    },
    async recall(dataset, query, signal) {
      try {
        const response = await fetchImpl(`${base}/api/v1/recall`, {
          method: "POST",
          headers: { ...authHeaders(apiKey, tenantId), "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            datasets: [dataset],
            search_type: "CHUNKS",
            top_k: 30,
          }),
          signal,
        });
        if (!response.ok) return failure(response.status);
        return { ok: true, text: recallText(await response.text()) };
      } catch {
        return failure(0, true);
      }
    },
  };
}
