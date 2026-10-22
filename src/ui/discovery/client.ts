import type {
  ApiFailure,
  ApiSuccess,
  BootstrapResponse,
  Community,
  DiscoverRequest,
  DiscoverResponse,
  ErrorCode,
} from "@/shared/contracts";
import {
  SAMPLE_BOOTSTRAP,
  SAMPLE_DISCOVER,
  buildEmptyDiscoverResponse,
} from "./fixtures";

export type DiscoveryResult =
  | { ok: true; data: DiscoverResponse }
  | { ok: false; error: ApiFailure["error"] };

type ApiError = ApiFailure["error"];
type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };

// Read directly so Next inlines the value at build time.
const MODE = process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "mock";

// ---------------------------------------------------------------- mock

const MOCK_DELAY_MS = 300;

function mockDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
}

// These keyword rules exist ONLY for sample mode so the demo has a happy path,
// an empty state and an error state. Live mode never uses them.
async function mockDiscover(input: DiscoverRequest): Promise<DiscoveryResult> {
  await mockDelay();
  const goal = input.goal.trim();
  if (!goal) {
    return {
      ok: false,
      error: { code: "BAD_INPUT", message: "Describe what you are looking for.", retryable: false },
    };
  }
  if (/simulate error/i.test(goal)) {
    return {
      ok: false,
      error: {
        code: "PROVIDER_UNAVAILABLE",
        message: "Search provider is unavailable (simulated).",
        retryable: true,
      },
    };
  }
  if (/robot|warehouse|fulfil/i.test(goal)) {
    return { ok: true, data: SAMPLE_DISCOVER };
  }
  return { ok: true, data: buildEmptyDiscoverResponse() };
}

// ---------------------------------------------------------------- live

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: "BAD_INPUT",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  410: "EXPIRED",
  429: "RATE_LIMITED",
  503: "PROVIDER_UNAVAILABLE",
};

const UNREACHABLE: ApiError = {
  code: "PROVIDER_UNAVAILABLE",
  message: "Could not reach the server.",
  retryable: true,
};

async function liveRequest<T>(path: string, body?: unknown): Promise<Result<T>> {
  let res: Response;
  let json: unknown;
  try {
    res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    json = await res.json();
  } catch {
    return { ok: false, error: UNREACHABLE };
  }

  const envelope = json as Partial<ApiSuccess<T>> & Partial<ApiFailure>;
  if (envelope && typeof envelope === "object") {
    if (envelope.error) return { ok: false, error: envelope.error };
    if (res.ok && "data" in envelope) return { ok: true, data: envelope.data as T };
  }
  if (res.ok) return { ok: false, error: UNREACHABLE };

  const code = STATUS_TO_CODE[res.status] ?? "PROVIDER_UNAVAILABLE";
  return {
    ok: false,
    error: {
      code,
      message: res.statusText || "Request failed.",
      retryable: code === "RATE_LIMITED" || code === "PROVIDER_UNAVAILABLE",
    },
  };
}

// ---------------------------------------------------------------- public API

let bootstrapPromise: Promise<Result<BootstrapResponse>> | null = null;

export function loadBootstrap(): Promise<
  { ok: true; data: BootstrapResponse } | { ok: false; error: ApiFailure["error"] }
> {
  // Memoised in flight and on success; failures are dropped so a retry can succeed (e.g. after login).
  if (!bootstrapPromise) {
    const p: Promise<Result<BootstrapResponse>> =
      MODE === "live"
        ? liveRequest<BootstrapResponse>("/api/platform/bootstrap")
        : mockDelay().then(() => ({ ok: true as const, data: SAMPLE_BOOTSTRAP }));
    bootstrapPromise = p;
    void p.then((r) => {
      if (!r.ok && bootstrapPromise === p) bootstrapPromise = null;
    });
  }
  return bootstrapPromise;
}

export function loadCommunities(): Promise<
  { ok: true; data: Community[] } | { ok: false; error: ApiFailure["error"] }
> {
  if (MODE === "live") return liveRequest<Community[]>("/api/platform/communities");
  // Sample workspace statuses (from bootstrap), not communities.sample.json.
  return mockDelay().then(() => ({ ok: true as const, data: SAMPLE_BOOTSTRAP.communities }));
}

export function discover(input: DiscoverRequest): Promise<DiscoveryResult> {
  if (MODE === "live") {
    // Body is exactly DiscoverRequest; the viewer comes from the server session, never the client.
    const body: DiscoverRequest = {
      goal: input.goal,
      communityIds: input.communityIds,
      mode: input.mode,
    };
    return liveRequest<DiscoverResponse>("/api/intelligence/discover", body);
  }
  return mockDiscover(input);
}

export function circleHandoffPath(searchId: string): string {
  return "/circles/new?searchId=" + encodeURIComponent(searchId);
}
