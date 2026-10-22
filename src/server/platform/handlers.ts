import { randomUUID } from "node:crypto";
import {
  activityUpdateSchema,
  contributionSchema,
  createCircleSchema,
  pathIdSchema,
  responseSchema,
  sessionSchema,
  tokenSchema,
} from "../../../convex/platform_validation";
import { requireOrganizer, login } from "./auth";
import { PlatformError } from "./errors";
import { body, endpoint, type IdContext, type TokenContext } from "./http";
import { getService } from "./runtime";
import { hashToken, newToken } from "./tokens";

export function sessionPOST(request: Request) {
  return endpoint(request, async (requestId) => {
    const { password } = await body(request, sessionSchema);
    const cookie = await login(password);
    return Response.json(
      { data: { authenticated: true }, requestId },
      {
        headers: {
          "Set-Cookie": `sw_session=${cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
        },
      },
    );
  });
}
export function bootstrapGET(request: Request) {
  return endpoint(request, async () => {
    const viewer = await requireOrganizer(request);
    return getService().bootstrap(viewer);
  });
}
export function communitiesGET(request: Request) {
  return endpoint(request, async () => {
    const viewer = await requireOrganizer(request);
    return getService().getCommunities(viewer);
  });
}
export function searchGET(request: Request, context: IdContext) {
  return endpoint(request, async () => {
    const viewer = await requireOrganizer(request);
    const id = pathIdSchema.parse((await context.params).id);
    const saved = await getService().readSearch(viewer, id, Date.now());
    if (!saved)
      throw new PlatformError("NOT_FOUND", "Search not found or expired");
    return {
      goal: saved.goal,
      discovery: { ...saved.result, searchId: saved.id },
    };
  });
}
export function contributionsPOST(request: Request) {
  return endpoint(request, async () => {
    const input = await body(request, contributionSchema);
    return getService().contribute(input, hashToken(input.token));
  });
}
export function circlesPOST(request: Request) {
  return endpoint(request, async () => {
    const viewer = await requireOrganizer(request);
    const input = await body(request, createCircleSchema);
    const base = process.env.APP_BASE_URL ?? new URL(request.url).origin;
    const origin = new URL(base).origin;
    const tokens = input.selectedMemberIds.map((memberId) => ({
      id: randomUUID(),
      memberId,
      raw: newToken(),
    }));
    const circle = await getService().createCircle(
      viewer,
      input,
      tokens.map((t) => ({
        id: t.id,
        memberId: t.memberId,
        tokenHash: hashToken(t.raw),
      })),
    );
    return {
      circle,
      invitationLinks: tokens.map((t) => ({
        invitationId: t.id,
        memberId: t.memberId,
        url: `${origin}/invite/${t.raw}`,
      })),
    };
  });
}
export function circlesGET(request: Request) {
  return endpoint(request, async () => {
    const viewer = await requireOrganizer(request);
    return getService().listCircles(viewer);
  });
}
export function circleGET(request: Request, context: IdContext) {
  return endpoint(request, async () => {
    const viewer = await requireOrganizer(request);
    return getService().circleDetail(
      viewer,
      pathIdSchema.parse((await context.params).id),
    );
  });
}
export function activityPATCH(request: Request, context: IdContext) {
  return endpoint(request, async () => {
    const viewer = await requireOrganizer(request);
    const id = pathIdSchema.parse((await context.params).id);
    return getService().updateActivity(
      viewer,
      id,
      await body(request, activityUpdateSchema),
    );
  });
}
export function invitationGET(request: Request, context: TokenContext) {
  return endpoint(request, async () => {
    const token = tokenSchema.parse((await context.params).token);
    return getService().invitationView(hashToken(token), Date.now());
  });
}
export function respondPOST(request: Request, context: TokenContext) {
  return endpoint(request, async () => {
    const token = tokenSchema.parse((await context.params).token);
    return getService().respond(
      hashToken(token),
      await body(request, responseSchema),
    );
  });
}
export function resetPOST(request: Request) {
  return endpoint(request, async () => {
    const viewer = await requireOrganizer(request);
    return getService().reset(viewer);
  });
}
