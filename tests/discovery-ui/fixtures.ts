import type {
  BootstrapResponse,
  DiscoverRequest,
  DiscoverResponse,
} from "@/shared/contracts";
import type { DiscoveryResult } from "@/ui/discovery/client";
import bootstrapJson from "../../small-world-handoff/shared/bootstrap.sample.json";
import discoverJson from "../../small-world-handoff/shared/discover-response.sample.json";

// Fixtures come straight from the frozen handoff JSON, not from src/ui/discovery/fixtures.ts.
// structuredClone so a test can mutate its copy without leaking into others.
export function bootstrap(): BootstrapResponse {
  return structuredClone(bootstrapJson) as unknown as BootstrapResponse;
}

export function discoverResponse(): DiscoverResponse {
  return structuredClone(discoverJson) as unknown as DiscoverResponse;
}

export const PEOPLE = ["Amara Okafor", "Leo Martin", "Nina Shah"] as const;

export function okResult(data: DiscoverResponse = discoverResponse()): DiscoveryResult {
  return { ok: true, data };
}

export function failResult(error: {
  code: "PROVIDER_UNAVAILABLE" | "BAD_INPUT" | "RATE_LIMITED";
  message: string;
  retryable: boolean;
}): DiscoveryResult {
  return { ok: false, error };
}

export type RunDiscover = (input: DiscoverRequest) => Promise<DiscoveryResult>;
