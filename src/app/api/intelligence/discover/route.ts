import { getPlatformPort, requireOrganizer } from "../../../../server/platform/public";
import { handleDiscover } from "../../../../server/intelligence/http";

/** Track C owns public.ts. This route uses that port and does not open a database. */
export function POST(request: Request): Promise<Response> {
  return handleDiscover(request, { requireOrganizer, getPlatformPort });
}
