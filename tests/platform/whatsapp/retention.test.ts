import { it, expect } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "../../../convex/schema";
const modules = import.meta.glob("../../../convex/**/*.{ts,js}");
it("removes expired staged text while preserving unexpired messages", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (const [id, expiresAt] of [
      ["expired", 1],
      ["current", Date.now() + 86400000],
    ] as const)
      await ctx.db.insert("whatsapp_messages", {
        id,
        workspaceId: "workspace",
        dataMode: "sample",
        connectionId: "c",
        groupId: "g",
        messageId: id,
        identityId: "i",
        text: "private text",
        occurredAt: null,
        receivedAt: 0,
        expiresAt,
        revision: 1,
      });
  });
  await t.mutation(
    makeFunctionReference<"mutation">("whatsapp/functions:cleanup"),
    {},
  );
  expect(
    (await t.run((ctx) => ctx.db.query("whatsapp_messages").collect())).map(
      (m) => m.id,
    ),
  ).toEqual(["current"]);
});
