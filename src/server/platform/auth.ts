import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Viewer } from "@/shared/contracts";
import {
  hostId,
  LIVE_WORKSPACE,
  SAMPLE_WORKSPACE,
} from "../../../convex/platform_model";
import { dataMode, getService } from "./runtime";
import { PlatformError } from "./errors";

const payloadSchema = z
  .object({
    viewerId: z.string(),
    workspaceId: z.string(),
    exp: z.number().int(),
  })
  .strict();
function secret() {
  if (!process.env.SESSION_SECRET)
    throw new PlatformError(
      "PROVIDER_UNAVAILABLE",
      "Session secret is missing",
    );
  return process.env.SESSION_SECRET;
}
const signature = (payload: string) =>
  createHmac("sha256", secret()).update(payload).digest("base64url");
function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function issueSession(viewerId: string, workspaceId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      viewerId,
      workspaceId,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    }),
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export async function requireOrganizer(request: Request): Promise<Viewer> {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("sw_session="))
    ?.slice(11);
  if (!cookie || cookie.length > 2048)
    throw new PlatformError("UNAUTHENTICATED", "Organizer session required");
  const [payload, signed, extra] = cookie.split(".");
  if (!payload || !signed || extra || !equal(signature(payload), signed))
    throw new PlatformError("UNAUTHENTICATED", "Invalid session");
  let parsed: z.infer<typeof payloadSchema>;
  try {
    parsed = payloadSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString()),
    );
  } catch {
    throw new PlatformError("UNAUTHENTICATED", "Invalid session");
  }
  if (parsed.exp <= Math.floor(Date.now() / 1000))
    throw new PlatformError("UNAUTHENTICATED", "Session expired");
  const mode = dataMode();
  const workspace = await getService().getWorkspace(parsed.workspaceId);
  if (
    !workspace ||
    workspace.organizerId !== parsed.viewerId ||
    workspace.dataMode !== mode
  )
    throw new PlatformError(
      "UNAUTHENTICATED",
      "Session is not valid for this workspace",
    );
  return {
    id: parsed.viewerId,
    workspaceId: workspace.id,
    role: "organizer",
    allowedCommunityIds: workspace.allowedCommunityIds,
    dataMode: mode,
  };
}

/** Issues the workspace organizer session. The demo link is open: no password. */
export async function openSession(): Promise<string> {
  const mode = dataMode();
  const workspaceId = mode === "sample" ? SAMPLE_WORKSPACE : LIVE_WORKSPACE;
  const workspace = await getService().getWorkspace(workspaceId);
  if (!workspace || workspace.organizerId !== hostId(mode))
    throw new PlatformError("PROVIDER_UNAVAILABLE", "Workspace is not seeded");
  return issueSession(workspace.organizerId, workspace.id);
}
