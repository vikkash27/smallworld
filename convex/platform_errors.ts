import { ConvexError } from "convex/values";
import type { ErrorCode } from "../src/shared/contracts";

export function fail(code: ErrorCode, message: string): never {
  throw new ConvexError({
    code,
    message,
    retryable: code === "PROVIDER_UNAVAILABLE" || code === "RATE_LIMITED",
  });
}
