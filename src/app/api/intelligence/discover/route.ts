import { handleDiscover } from "../../../../server/intelligence/http";
import {
  getPlatformPort,
  requireOrganizer,
} from "../../../../server/platform/public";

export async function POST(request: Request): Promise<Response> {
  try {
    return handleDiscover(request, { requireOrganizer, getPlatformPort });
  } catch {
    return Response.json(
      {
        error: {
          code: "PROVIDER_UNAVAILABLE",
          message: "Platform port is not available yet.",
          retryable: true,
        },
        requestId: crypto.randomUUID(),
      },
      { status: 503 },
    );
  }
}
