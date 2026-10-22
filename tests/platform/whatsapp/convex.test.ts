import { it, expect } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "../../../convex/schema";
const modules = import.meta.glob("../../../convex/**/*.{ts,js}");
it("persists connection ownership and fences competing workers in Convex transactions", async () => {
  const t = convexTest(schema, modules);
  const viewer = {
    id: "host",
    workspaceId: "workspace",
    dataMode: "sample",
    role: "organizer",
    allowedCommunityIds: [],
  };
  const ref = (method: string) =>
    makeFunctionReference<"mutation">(`whatsapp/functions:${method}`);
  await t.mutation(ref("create"), { viewer, id: "connection", now: 1000 });
  const commands = await t.mutation(ref("claim"), {
    workerId: "first",
    now: 1000,
  });
  expect(commands[0].generation).toBe(1);
  expect(
    await t.mutation(ref("claim"), { workerId: "other", now: 1001 }),
  ).toEqual([]);
  await expect(
    t.mutation(ref("control"), {
      viewer: { ...viewer, workspaceId: "other" },
      id: "connection",
      action: "pause",
      now: 1000,
    }),
  ).rejects.toThrow(/not found/i);
  const persisted = await t.run((ctx) =>
    ctx.db.query("whatsapp_connections").collect(),
  );
  expect(persisted[0].workerId).toBe("first");
  const takeover = await t.mutation(ref("claim"), {
    workerId: "other",
    now: 16001,
  });
  expect(takeover[0].generation).toBe(2);
  await expect(
    t.mutation(ref("event"), {
      workerId: "first",
      now: 16002,
      input: {
        connectionId: "connection",
        generation: 1,
        type: "connected",
        groups: [],
      },
    }),
  ).rejects.toThrow(/lease/i);
});
