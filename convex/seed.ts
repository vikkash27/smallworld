import { v } from "convex/values";
import communities from "../src/shared/fixtures/communities.sample.json";
import { internalMutation } from "./_generated/server";

// Baseline only: insert listed directory metadata, preserving existing rows.
export const run = internalMutation({
  args: {},
  returns: v.object({ inserted: v.number(), skipped: v.number() }),
  handler: async (ctx) => {
    let inserted = 0;
    for (const community of communities) {
      const existing = await ctx.db
        .query("communities")
        .withIndex("by_domain_id", (q) => q.eq("id", community.id))
        .unique();
      if (!existing) {
        await ctx.db.insert("communities", { ...community, status: "listed" });
        inserted += 1;
      }
    }
    return { inserted, skipped: communities.length - inserted };
  },
});
