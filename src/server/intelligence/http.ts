import { randomUUID } from "node:crypto";
import type { DiscoverRequest, PlatformPort, Viewer } from "../../shared/contracts";
import { discover, DiscoverInputError, isProviderUnavailable } from "./discover";
import { createCogneeTransport } from "./memory/cognee";
import { createOpenAIRerankClient } from "./validate/openai";

const indexedDatasets = new Set<string>();

export interface DiscoverDeps {
  requireOrganizer: (request: Request) => Promise<Viewer>;
  getPlatformPort: () => PlatformPort;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

export async function handleDiscover(request: Request, deps: DiscoverDeps): Promise<Response> {
  const requestId = randomUUID();
  try {
    const body = await readBody(request);
    const viewer = await deps.requireOrganizer(request);
    const env = deps.env ?? process.env;
    const data = await discover({
      viewer,
      request: body,
      port: deps.getPlatformPort(),
      transport: createCogneeTransport(env, deps.fetchImpl),
      reranker: createOpenAIRerankClient(env, deps.fetchImpl),
      signal: request.signal,
      indexed: indexedDatasets,
    });
    return json(200, { data, requestId });
  } catch (error) {
    if (error instanceof DiscoverInputError) {
      const status = error.code === "FORBIDDEN" ? 403 : 400;
      return json(status, { error: { code: error.code, message: error.message, retryable: false }, requestId });
    }
    if (isProviderUnavailable(error)) {
      return json(503, {
        error: { code: error.code, message: error.message, retryable: error.retryable },
        requestId,
      });
    }
    if (error instanceof Error && error.message === "BAD_JSON") {
      return json(400, {
        error: { code: "BAD_INPUT", message: "Request body must be JSON.", retryable: false },
        requestId,
      });
    }
    throw error;
  }
}

async function readBody(request: Request): Promise<DiscoverRequest> {
  try {
    return (await request.json()) as DiscoverRequest;
  } catch {
    throw new Error("BAD_JSON");
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
