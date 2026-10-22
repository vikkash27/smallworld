import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { convexStore } from "../platform_store";
import { viewerSchema } from "../platform_validation";
import * as model from "./model";
export const list = internalQuery({
  args: { viewer: v.any(), now: v.number() },
  handler: (ctx, a) =>
    model.list(convexStore(ctx.db), viewerSchema.parse(a.viewer), a.now),
});
export const detail = internalQuery({
  args: { viewer: v.any(), id: v.string(), now: v.number() },
  handler: (ctx, a) =>
    model.detail(
      convexStore(ctx.db),
      viewerSchema.parse(a.viewer),
      a.id,
      a.now,
    ),
});
export const create = internalMutation({
  args: { viewer: v.any(), id: v.string(), now: v.number() },
  handler: (ctx, a) =>
    model.create(
      convexStore(ctx.db),
      viewerSchema.parse(a.viewer),
      a.id,
      a.now,
    ),
});
export const select = internalMutation({
  args: { viewer: v.any(), id: v.string(), input: v.any(), now: v.number() },
  handler: (ctx, a) =>
    model.select(
      convexStore(ctx.db),
      viewerSchema.parse(a.viewer),
      a.id,
      a.input,
      a.now,
    ),
});
export const control = internalMutation({
  args: {
    viewer: v.any(),
    id: v.string(),
    action: v.union(
      v.literal("pause"),
      v.literal("resume"),
      v.literal("disconnect"),
    ),
    now: v.number(),
  },
  handler: (ctx, a) =>
    model.control(
      convexStore(ctx.db),
      viewerSchema.parse(a.viewer),
      a.id,
      a.action,
      a.now,
    ),
});
export const claim = internalMutation({
  args: { workerId: v.string(), now: v.number() },
  handler: (ctx, a) => model.claim(convexStore(ctx.db), a.workerId, a.now),
});
export const event = internalMutation({
  args: { workerId: v.string(), input: v.any(), now: v.number() },
  handler: (ctx, a) =>
    model.event(convexStore(ctx.db), a.workerId, a.input, a.now),
});
// Raw staged messages expire independently of whether a worker remains online.
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("whatsapp_messages")
      .withIndex("by_expiry", (q) => q.lte("expiresAt", Date.now()))
      .take(100);
    for (const row of rows) await ctx.db.delete(row._id);
    return { removed: rows.length };
  },
});
