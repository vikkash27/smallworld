import { v } from "convex/values";
import directory from "../src/shared/fixtures/communities.sample.json";
import bootstrapFixture from "../src/shared/fixtures/bootstrap.sample.json";
import discoveryFixture from "../src/shared/fixtures/discover-response.sample.json";
import preview from "../src/shared/fixtures/search-preview.sample.json";
import type { DiscoverResponse, Viewer } from "../src/shared/contracts";
import { internalMutation } from "./_generated/server";
import { convexStore, type Store } from "./platform_store";
import {
  authorize,
  audit,
  hostId,
  LIVE_WORKSPACE,
  SAMPLE_WORKSPACE,
} from "./platform_model";
import { fail } from "./platform_errors";

export async function seedSample(store: Store, contributionTokenHash?: string) {
  const workspaceId = SAMPLE_WORKSPACE;
  const dataMode = "sample" as const;
  const scope = { workspaceId, dataMode };
  await store.put("workspaces", {
    id: workspaceId,
    dataMode,
    organizerId: hostId(dataMode),
    allowedCommunityIds: bootstrapFixture.allowedCommunityIds,
  });
  await store.put("members", {
    ...scope,
    id: hostId(dataMode),
    ...bootstrapFixture.viewer,
    communityIds: bootstrapFixture.allowedCommunityIds,
    consentToDiscovery: false,
    showOnRoster: true,
    currentAvailability: "unknown",
  });
  for (const person of (discoveryFixture as DiscoverResponse).people) {
    await store.put("members", {
      ...scope,
      ...person.member,
      consentToDiscovery: true,
      showOnRoster: false,
      currentAvailability: person.availability,
    });
    for (const communityId of person.member.communityIds)
      await store.put("memberships", {
        ...scope,
        id: `${person.member.id}:${communityId}`,
        memberId: person.member.id,
        communityId,
        confirmed: true,
      });
    for (const e of person.evidence) {
      const sourceId = `${e.id}:source`;
      await store.put("sources", {
        ...scope,
        id: sourceId,
        sourceType: "fictional_contribution",
        sourceLabel: e.sourceLabel,
        sourceUrl: e.sourceUrl,
        authorMemberId: person.member.id,
        permittedCommunityIds: person.member.communityIds,
        redactedContent: e.excerpt,
        occurredAt: e.occurredAt,
        createdAt: new Date().toISOString(),
      });
      await store.put("signals", {
        ...scope,
        id: e.signalId,
        memberId: person.member.id,
        communityIds: person.member.communityIds,
        kind: e.kind,
        topic: "warehouse robotics",
        statement: e.summary,
        evidenceClass: e.evidenceClass,
        visibility: "communities",
        status: "approved",
        validUntil: null,
      });
      await store.put("signal_evidence", {
        ...scope,
        ...e,
        sourceId,
        authorMemberId: person.member.id,
      });
    }
  }
  const { searchId, ...result } = discoveryFixture as DiscoverResponse;
  await store.put("searches", {
    ...scope,
    id: searchId,
    viewerId: hostId(dataMode),
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    goal: preview.goal,
    communityIds: bootstrapFixture.allowedCommunityIds,
    result,
  });
  if (contributionTokenHash)
    await store.put("contribution_capabilities", {
      ...scope,
      id: "demo-contribution",
      tokenHash: contributionTokenHash,
      permittedCommunityIds: bootstrapFixture.allowedCommunityIds,
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      revoked: false,
    });
}

export async function seedAll(store: Store, hash: string) {
  for (const c of directory)
    if (!(await store.get("communities", c.id)))
      await store.put("communities", { ...c, status: "listed" });
  if (!(await store.get("workspaces", SAMPLE_WORKSPACE)))
    await seedSample(store, hash);
  // Explicit seeding rotates the test contribution capability and returns its raw token only in the local seed script.
  await store.put("contribution_capabilities", {
    id: "demo-contribution",
    workspaceId: SAMPLE_WORKSPACE,
    dataMode: "sample",
    tokenHash: hash,
    permittedCommunityIds: bootstrapFixture.allowedCommunityIds,
    expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    revoked: false,
  });
  if (!(await store.get("workspaces", LIVE_WORKSPACE))) {
    await store.put("workspaces", {
      id: LIVE_WORKSPACE,
      dataMode: "live",
      organizerId: hostId("live"),
      allowedCommunityIds: [],
    });
    await store.put("members", {
      id: hostId("live"),
      workspaceId: LIVE_WORKSPACE,
      dataMode: "live",
      displayName: "Organizer",
      initials: "OR",
      communityIds: [],
      consentToDiscovery: false,
      showOnRoster: true,
      currentAvailability: "unknown",
    });
  }
  return { seeded: true };
}

export async function resetSample(store: Store, viewer: Viewer) {
  await authorize(store, viewer);
  if (viewer.dataMode !== "sample" || viewer.workspaceId !== SAMPLE_WORKSPACE)
    fail("FORBIDDEN", "Reset is only available in the sample workspace");
  for (const table of [
    "members",
    "memberships",
    "sources",
    "signals",
    "signal_evidence",
    "searches",
    "circles",
    "circle_members",
    "invitations",
    "audit_events",
  ] as const) {
    for (const row of await store.all(table, viewer))
      if (row.workspaceId === viewer.workspaceId && row.dataMode === "sample")
        await store.remove(table, row.id);
  }
  await seedSample(store);
  await audit(
    store,
    viewer,
    "demo.reset",
    viewer.workspaceId,
    "workspace",
    "reset",
  );
  return { reset: true as const };
}

export const run = internalMutation({
  args: { contributionTokenHash: v.string() },
  handler: async (ctx, { contributionTokenHash }) =>
    seedAll(convexStore(ctx.db), contributionTokenHash),
});
