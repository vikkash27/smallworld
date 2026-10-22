import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { convexStore } from "./platform_store";
import * as model from "./platform_model";
import { viewerSchema } from "./platform_validation";

const viewerArg = { viewer: v.any() };
export const workspace = internalQuery({
  args: { id: v.string() },
  handler: (ctx, args) => convexStore(ctx.db).get("workspaces", args.id),
});
export const bootstrap = internalQuery({
  args: viewerArg,
  handler: (ctx, args) =>
    model.bootstrap(convexStore(ctx.db), viewerSchema.parse(args.viewer)),
});
export const communities = internalQuery({
  args: viewerArg,
  handler: (ctx, args) =>
    model.communities(convexStore(ctx.db), viewerSchema.parse(args.viewer)),
});
export const contexts = internalQuery({
  args: { ...viewerArg, communityIds: v.array(v.string()) },
  handler: (ctx, args) =>
    model.contexts(
      convexStore(ctx.db),
      viewerSchema.parse(args.viewer),
      args.communityIds,
    ),
});
export const search = internalQuery({
  args: { ...viewerArg, id: v.string() },
  handler: (ctx, args) =>
    model.readSearch(
      convexStore(ctx.db),
      viewerSchema.parse(args.viewer),
      args.id,
    ),
});
export const circles = internalQuery({
  args: viewerArg,
  handler: (ctx, args) =>
    model.listCircles(convexStore(ctx.db), viewerSchema.parse(args.viewer)),
});
export const circle = internalQuery({
  args: { ...viewerArg, id: v.string() },
  handler: (ctx, args) =>
    model.circleDetail(
      convexStore(ctx.db),
      viewerSchema.parse(args.viewer),
      args.id,
    ),
});
export const invitation = internalQuery({
  args: { tokenHash: v.string() },
  handler: (ctx, args) =>
    model.invitationView(convexStore(ctx.db), args.tokenHash),
});
