import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { internal } from "../../convex/_generated/api";
import fixture from "@/shared/fixtures/discover-response.sample.json";
import type { Viewer } from "@/shared/contracts";

// A bounded module map keeps fixture JSON/declarations out of function loading.
const modules = import.meta.glob("../../convex/**/*.{ts,js}");
const viewer: Viewer = {
  id: "demo-host",
  workspaceId: "sample-workspace",
  role: "organizer",
  allowedCommunityIds: ["unicorn-mafia", "kickstart-global"],
  dataMode: "sample",
};
const createTest = () => convexTest(schema, modules);
let t: ReturnType<typeof createTest>;
beforeEach(async () => {
  t = convexTest(schema, modules);
  await t.mutation(internal.seed.run, {
    contributionTokenHash: "contribution-hash",
  });
});
afterEach(() => {
  vi.useRealTimers();
});
async function create(capacity = 6, minimumMembers = 3) {
  const draft = fixture.circleDraft!;
  return t.mutation(internal.platform_mutations.circle, {
    viewer,
    input: {
      searchId: fixture.searchId,
      selectedMemberIds: draft.proposedMemberIds.slice(0, 2),
      title: draft.title,
      purpose: draft.purpose,
      activity: draft.activity,
      capacity,
      minimumMembers,
    },
    tokens: [
      { id: "invite-one", memberId: "demo-amara", tokenHash: "hash-one" },
      { id: "invite-two", memberId: "demo-leo", tokenHash: "hash-two" },
    ],
  });
}
const answer = (tokenHash: string, decision = "join") =>
  t.mutation(internal.platform_mutations.respond, {
    tokenHash,
    input: { decision, showOnRoster: false },
  });

describe("Convex mutations and persisted invariants", () => {
  it("keeps GET byte-for-byte read-only and stores only token hashes", async () => {
    await create();
    const before = await t.run((ctx) => ctx.db.query("invitations").collect());
    await t.query(internal.platform_queries.invitation, {
      tokenHash: "hash-one",
    });
    expect(await t.run((ctx) => ctx.db.query("invitations").collect())).toEqual(
      before,
    );
    expect(
      await t.run((ctx) => ctx.db.query("circle_members").collect()),
    ).toHaveLength(1);
    expect(Object.keys(before[0])).not.toContain("token");
  });
  it("uses the membership index to keep repeated joins unique and enforces capacity", async () => {
    const c = await create(2, 2);
    expect(await answer("hash-one")).toMatchObject({ acceptedCount: 2 });
    expect(await answer("hash-one")).toMatchObject({ acceptedCount: 2 });
    await expect(answer("hash-two")).rejects.toThrow(/capacity/);
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("circle_members")
          .withIndex("by_circle_member", (q) =>
            q.eq("circleId", c.id).eq("memberId", "demo-amara"),
          )
          .collect(),
      ),
    ).toHaveLength(1);
  });
  it("rejects withdrawn evidence before creating any circle or invitation", async () => {
    await t.run(async (ctx) => {
      const signal = await ctx.db
        .query("signals")
        .withIndex("by_domain_id", (q) => q.eq("id", "demo-signal-amara"))
        .unique();
      await ctx.db.patch(signal!._id, { status: "withdrawn" });
    });
    await expect(create()).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("circles").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("invitations").collect())).toEqual(
      [],
    );
  });
  it("invalidates deleted/private sources and revoked member consent", async () => {
    await t.run(async (ctx) => {
      const source = await ctx.db.query("sources").first();
      await ctx.db.delete(source!._id);
    });
    await expect(create()).rejects.toThrow();
    await t.mutation(internal.platform_mutations.reset, { viewer });
    await t.run(async (ctx) => {
      const member = await ctx.db
        .query("members")
        .withIndex("by_domain_id", (q) => q.eq("id", "demo-amara"))
        .unique();
      await ctx.db.patch(member!._id, { consentToDiscovery: false });
    });
    const contexts = await t.query(internal.platform_queries.contexts, {
      viewer,
      communityIds: viewer.allowedCommunityIds,
    });
    expect(contexts.some((c) => c.member.id === "demo-amara")).toBe(false);
    await expect(create()).rejects.toThrow();
  });
  it("hides a search belonging to a different viewer in the same workspace", async () => {
    await t.run(async (ctx) => {
      const search = await ctx.db
        .query("searches")
        .withIndex("by_domain_id", (q) => q.eq("id", fixture.searchId))
        .unique();
      await ctx.db.patch(search!._id, { viewerId: "another-organizer" });
    });
    expect(
      await t.query(internal.platform_queries.search, {
        viewer,
        id: fixture.searchId,
      }),
    ).toBeNull();
    await expect(create()).rejects.toThrow(/Search not found/);
  });

  it("resolves an accepted/declined transition once", async () => {
    await create();
    await answer("hash-one", "decline");
    await expect(answer("hash-one", "join")).rejects.toThrow(
      /different response/,
    );
    expect(await answer("hash-one", "decline")).toMatchObject({
      acceptedCount: 1,
      invitationStatus: "declined",
    });
  });
  it("rejects revoked and expired capabilities without a GET write", async () => {
    await create();
    await t.run(async (ctx) => {
      const i = await ctx.db
        .query("invitations")
        .withIndex("by_token_hash", (q) => q.eq("tokenHash", "hash-one"))
        .unique();
      await ctx.db.patch(i!._id, { status: "revoked" });
      const second = await ctx.db
        .query("invitations")
        .withIndex("by_token_hash", (q) => q.eq("tokenHash", "hash-two"))
        .unique();
      await ctx.db.patch(second!._id, { expiresAt: "2000-01-01T00:00:00Z" });
    });
    await expect(
      t.query(internal.platform_queries.invitation, { tokenHash: "hash-one" }),
    ).rejects.toThrow(/expired or was revoked/);
    await expect(answer("hash-two")).rejects.toThrow(/expired or was revoked/);
    expect(
      (await t.run((ctx) =>
        ctx.db
          .query("invitations")
          .withIndex("by_token_hash", (q) => q.eq("tokenHash", "hash-two"))
          .unique(),
      ))!.status,
    ).toBe("pending");
  });
  it("becomes active only with host plus two joins and confirmed activity", async () => {
    const c = await create();
    await answer("hash-one");
    await answer("hash-two");
    const result = await t.mutation(internal.platform_mutations.activity, {
      viewer,
      id: c.id,
      input: { activity: c.activity, confirmed: true },
    });
    expect(result).toMatchObject({
      acceptedCount: 3,
      status: "active",
      activityConfirmed: true,
    });
  });
  it("isolates reset from live data and preserves base community statuses", async () => {
    await create();
    const liveId = await t.run((ctx) =>
      ctx.db.insert("signals", {
        id: "live-preserved",
        workspaceId: "live-workspace",
        dataMode: "live",
        memberId: "live-host",
        communityIds: [],
        kind: "building",
        topic: "real",
        statement: "preserve this",
        evidenceClass: "explicit",
        visibility: "communities",
        status: "pending",
        validUntil: null,
      }),
    );
    await t.mutation(internal.platform_mutations.reset, { viewer });
    expect(await t.run((ctx) => ctx.db.get(liveId))).toMatchObject({
      statement: "preserve this",
    });
    expect(await t.run((ctx) => ctx.db.query("circles").collect())).toEqual([]);
    expect(
      (await t.run((ctx) => ctx.db.query("communities").collect())).every(
        (c) => c.status === "listed",
      ),
    ).toBe(true);
  });
});
