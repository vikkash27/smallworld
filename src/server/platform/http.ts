import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { PlatformError, errorResponse } from "./errors";

export function endpoint(
  request: Request,
  run: (requestId: string) => Promise<unknown>,
): Promise<Response> {
  const requestId = randomUUID();
  return (async () => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        const origin = request.headers.get("origin");
        const site = request.headers.get("sec-fetch-site");
        if (
          site === "cross-site" ||
          (origin &&
            origin !== new URL(request.url).origin &&
            origin !==
              (process.env.APP_BASE_URL
                ? new URL(process.env.APP_BASE_URL).origin
                : null))
        )
          throw new PlatformError(
            "FORBIDDEN",
            "Cross-origin mutations are not allowed",
          );
      }
      const result = await run(requestId);
      const response =
        result instanceof Response
          ? result
          : Response.json({ data: result, requestId });
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("X-Request-Id", requestId);
      return response;
    } catch (error) {
      return errorResponse(error, requestId);
    }
  })();
}
export async function body<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  const raw = await request.text();
  if (raw.length > 32_768)
    throw new PlatformError("BAD_INPUT", "Request body is too large");
  return schema.parse(JSON.parse(raw));
}
export type IdContext = { params: Promise<{ id: string }> };
export type TokenContext = { params: Promise<{ token: string }> };
