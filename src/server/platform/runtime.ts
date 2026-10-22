import { ConvexPort } from "./port";
import { FixturePort } from "./port.fixture";
import type { PlatformService } from "./service";
import { PlatformError } from "./errors";
import { hashToken } from "./tokens";

let cached: { key: string; service: PlatformService } | undefined;
export function dataMode(): "sample" | "live" {
  const mode = process.env.NEXT_PUBLIC_DATA_MODE ?? "sample";
  if (mode !== "sample" && mode !== "live")
    throw new PlatformError(
      "PROVIDER_UNAVAILABLE",
      "NEXT_PUBLIC_DATA_MODE must be sample or live",
    );
  return mode;
}
export function getService(): PlatformService {
  const url = process.env.CONVEX_URL;
  const key = url
    ? `${url}:${process.env.CONVEX_DEPLOY_KEY}`
    : `fixture:${process.env.TOKEN_HASH_SECRET}`;
  if (!url && dataMode() === "live")
    throw new PlatformError(
      "PROVIDER_UNAVAILABLE",
      "Live mode requires a configured Convex deployment",
    );
  if (cached?.key === key) return cached.service;
  if (url && !process.env.CONVEX_DEPLOY_KEY)
    throw new PlatformError(
      "PROVIDER_UNAVAILABLE",
      "Convex deployment key is missing",
    );
  const service = url
    ? new ConvexPort(url, process.env.CONVEX_DEPLOY_KEY!)
    : new FixturePort(
        process.env.TOKEN_HASH_SECRET
          ? hashToken("sample-contribution-capability")
          : undefined,
      );
  cached = { key, service };
  return service;
}
