import { ConvexError } from "convex/values";
import { ZodError } from "zod";
import type { ApiFailure, ErrorCode } from "@/shared/contracts";

export class PlatformError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public retryable = false,
  ) {
    super(message);
  }
}
const statuses: Record<ErrorCode, number> = {
  BAD_INPUT: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  EXPIRED: 410,
  RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 503,
};
export function errorResponse(error: unknown, requestId: string): Response {
  let failure = new PlatformError(
    "PROVIDER_UNAVAILABLE",
    "Platform is temporarily unavailable",
    true,
  );
  if (error instanceof PlatformError) failure = error;
  else if (error instanceof ZodError || error instanceof SyntaxError)
    failure = new PlatformError("BAD_INPUT", "Request validation failed");
  else if (
    error instanceof ConvexError &&
    error.data &&
    typeof error.data === "object" &&
    "code" in error.data &&
    typeof error.data.code === "string" &&
    error.data.code in statuses
  ) {
    failure = new PlatformError(
      error.data.code as ErrorCode,
      String(error.data.message),
      Boolean(error.data.retryable),
    );
  }
  const body: ApiFailure = {
    error: {
      code: failure.code,
      message: failure.message,
      retryable: failure.retryable,
    },
    requestId,
  };
  return Response.json(body, {
    status: statuses[failure.code],
    headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
  });
}
