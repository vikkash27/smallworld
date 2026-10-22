import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { convexStore } from "./platform_store";
import * as model from "./platform_model";
import { resetSample } from "./seed";
import { viewerSchema } from "./platform_validation";
const viewerArg = { viewer: v.any() };

export const search = internalMutation({
  args: { ...viewerArg, input: v.any() },
  handler: (ctx, args) =>
    model.saveSearch(
      convexStore(ctx.db),
      viewerSchema.parse(args.viewer),
      args.input,
    ),
});
export const circle = internalMutation({
  args: {
    ...viewerArg,
    input: v.any(),
    tokens: v.array(
      v.object({
        id: v.string(),
        memberId: v.string(),
        tokenHash: v.string(),
      }),
    ),
  },
  handler: (ctx, args) =>
    model.createCircle(
      convexStore(ctx.db),
      viewerSchema.parse(args.viewer),
      args.input,
      args.tokens,
    ),
});
export const activity = internalMutation({
  args: { ...viewerArg, id: v.string(), input: v.any() },
  handler: (ctx, args) =>
    model.updateActivity(
      convexStore(ctx.db),
      viewerSchema.parse(args.viewer),
      args.id,
      args.input,
    ),
});
export const respond = internalMutation({
  args: { tokenHash: v.string(), input: v.any() },
  handler: (ctx, args) =>
    model.respond(convexStore(ctx.db), args.tokenHash, args.input),
});
export const contribute = internalMutation({
  args: { tokenHash: v.string(), input: v.any() },
  handler: (ctx, args) =>
    model.contribute(convexStore(ctx.db), args.input, args.tokenHash),
});
export const reset = internalMutation({
  args: viewerArg,
  handler: (ctx, args) =>
    resetSample(convexStore(ctx.db), viewerSchema.parse(args.viewer)),
});
