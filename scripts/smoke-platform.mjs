import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { loadPlatformEnv } from "./platform-env.mjs";

const env = await loadPlatformEnv();
const client = new ConvexHttpClient(env.CONVEX_URL);
client.setAdminAuth(env.CONVEX_DEPLOY_KEY);
const query = (name, args) =>
  client.query(makeFunctionReference(`platform_queries:${name}`), args);
const mutation = (name, args) =>
  client.mutation(makeFunctionReference(`platform_mutations:${name}`), args);
const viewer = {
  id: "demo-host",
  workspaceId: "sample-workspace",
  role: "organizer",
  allowedCommunityIds: ["unicorn-mafia", "kickstart-global"],
  dataMode: "sample",
};
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../src/shared/fixtures/discover-response.sample.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const tokenHash = (token) =>
  createHmac("sha256", env.TOKEN_HASH_SECRET).update(token).digest("hex");
// This command explicitly resets fictional data before and after the smoke test.
await mutation("reset", { viewer });
try {
  assert.equal((await query("bootstrap", { viewer })).communities.length, 12);
  const { searchId: _searchId, ...result } = fixture;
  const saved = await mutation("search", {
    viewer,
    input: {
      goal: "Build warehouse robotics",
      communityIds: viewer.allowedCommunityIds,
      result,
    },
  });
  assert.equal((await query("search", { viewer, id: saved.id })).id, saved.id);
  const tokens = fixture.circleDraft.proposedMemberIds
    .slice(0, 2)
    .map((memberId) => ({
      id: randomUUID(),
      memberId,
      raw: randomBytes(32).toString("base64url"),
    }));
  const { proposedMemberIds: _proposedMemberIds, ...draft } =
    fixture.circleDraft;
  const circle = await mutation("circle", {
    viewer,
    input: {
      ...draft,
      searchId: saved.id,
      selectedMemberIds: tokens.map((t) => t.memberId),
    },
    tokens: tokens.map((t) => ({
      id: t.id,
      memberId: t.memberId,
      tokenHash: tokenHash(t.raw),
    })),
  });
  const preview = await query("invitation", {
    tokenHash: tokenHash(tokens[0].raw),
  });
  assert.equal(preview.circle.acceptedCount, 1);
  assert.equal("invitations" in preview, false);
  for (const t of tokens)
    await mutation("respond", {
      tokenHash: tokenHash(t.raw),
      input: { decision: "join", showOnRoster: false },
    });
  assert.equal(
    (
      await mutation("respond", {
        tokenHash: tokenHash(tokens[0].raw),
        input: { decision: "join", showOnRoster: false },
      })
    ).acceptedCount,
    3,
  );
  const active = await mutation("activity", {
    viewer,
    id: circle.id,
    input: { activity: circle.activity, confirmed: true },
  });
  assert.equal(active.status, "active");
  assert.equal(active.acceptedCount, 3);
  // Ordinary unauthenticated HTTP clients cannot invoke internal private reads.
  const anonymous = new ConvexHttpClient(env.CONVEX_URL);
  await assert.rejects(() =>
    anonymous.query(makeFunctionReference("platform_queries:bootstrap"), {
      viewer,
    }),
  );
  console.log(
    "PASS: real local Convex seed → saved search → circle → read-only preview → two joins → duplicate → active; anonymous private access denied.",
  );
} finally {
  await mutation("reset", { viewer });
}
