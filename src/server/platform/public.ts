import type { PlatformPort } from "@/shared/contracts";
import { getService } from "./runtime";
export { requireOrganizer } from "./auth";
export function getPlatformPort(): PlatformPort {
  return getService();
}
