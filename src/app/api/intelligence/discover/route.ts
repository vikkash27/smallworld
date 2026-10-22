import type { PlatformPort, Viewer } from "../../../../shared/contracts";
import { handleDiscover } from "../../../../server/intelligence/http";

interface PlatformModule {
  requireOrganizer: (request: Request) => Promise<Viewer>;
  getPlatformPort: () => PlatformPort;
}

/** Track C owns this module. The import stays dynamic until that file is on main. */
async function loadPlatform(): Promise<PlatformModule> {
  const specifier = ["..", "..", "..", "..", "server", "platform", "public"].join("/");
  return import(specifier) as Promise<PlatformModule>;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const platform = await loadPlatform();
    return handleDiscover(request, {
      requireOrganizer: platform.requireOrganizer,
      getPlatformPort: platform.getPlatformPort,
    });
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
