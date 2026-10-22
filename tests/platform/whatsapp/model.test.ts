import { describe, it, expect } from "vitest";
import { MemoryStore } from "../../../src/server/platform/port.fixture";
import * as model from "../../../convex/whatsapp/model";
import type { Viewer } from "../../../src/shared/contracts";
const viewer: Viewer = {
  id: "host",
  workspaceId: "workspace",
  dataMode: "sample",
  role: "organizer",
  allowedCommunityIds: [],
};
const now = 1792700000000;
async function paired() {
  const store = new MemoryStore();
  await model.create(store, viewer, "connection", now);
  const command = (await model.claim(store, "worker", now))[0];
  await model.event(
    store,
    "worker",
    {
      connectionId: "connection",
      generation: command.generation,
      type: "connected",
      groups: [
        { id: "one@g.us", name: "Robotics", participantCount: 4 },
        { id: "two@g.us", name: "Robotics", participantCount: 5 },
      ],
    },
    now,
  );
  return { store, command };
}
describe("WhatsApp connection isolation and ingestion", () => {
  it("conceals another organiser connection", async () => {
    const { store } = await paired();
    await expect(
      model.detail(store, { ...viewer, id: "other" }, "connection", now),
    ).rejects.toThrow(/not found/i);
    expect(
      await model.list(store, { ...viewer, workspaceId: "other" }, now),
    ).toEqual([]);
  });
  it("expires pairing codes and rejects stale worker generations", async () => {
    const store = new MemoryStore();
    await model.create(store, viewer, "connection", now);
    const c = (await model.claim(store, "worker", now))[0];
    await model.event(
      store,
      "worker",
      {
        connectionId: c.id,
        generation: c.generation,
        type: "qr",
        qr: "sensitive",
        expiresAt: now + 1000,
      },
      now,
    );
    expect((await model.detail(store, viewer, c.id, now + 1001)).qr).toBeNull();
    await expect(
      model.event(
        store,
        "worker",
        {
          connectionId: c.id,
          generation: c.generation + 1,
          type: "connected",
          groups: [],
        },
        now,
      ),
    ).rejects.toThrow(/lease/i);
    expect(await model.claim(store, "other-worker", now + 1)).toEqual([]);
  });
  it("validates selected groups and records source-only consent", async () => {
    const { store } = await paired();
    await expect(
      model.select(
        store,
        viewer,
        "connection",
        { groupIds: ["unknown"], consentRecorded: true },
        now,
      ),
    ).rejects.toThrow(/group/i);
    await expect(
      model.select(
        store,
        viewer,
        "connection",
        { groupIds: ["one@g.us"], consentRecorded: false },
        now,
      ),
    ).rejects.toThrow(/consent/i);
    await model.select(
      store,
      viewer,
      "connection",
      { groupIds: ["one@g.us"], consentRecorded: true },
      now,
    );
    const d = await model.detail(store, viewer, "connection", now);
    expect(d.groups.filter((g) => g.selected).map((g) => g.id)).toEqual([
      "one@g.us",
    ]);
    expect(d.history).toEqual({ days: 30, perGroup: 1000, total: 10000 });
    expect(d.consent?.showOnRoster).toBe(false);
    expect(d.consent?.scope).toBe("source_group");
  });
  it("discards unselected traffic and deduplicates provider keys without merging names", async () => {
    const { store, command } = await paired();
    await model.select(
      store,
      viewer,
      "connection",
      { groupIds: ["one@g.us"], consentRecorded: true },
      now,
    );
    const message = {
      groupId: "one@g.us",
      messageId: "msg1",
      senderId: "alice@lid",
      displayName: "Alex",
      text: "I'm building a robot",
      occurredAt: new Date(now).toISOString(),
    };
    const send = (messages: unknown[]) =>
      model.event(
        store,
        "worker",
        {
          connectionId: "connection",
          generation: command.generation,
          type: "messages",
          messages,
          history: true,
        },
        now,
      );
    await send([message, { ...message, groupId: "two@g.us" }]);
    await send([
      message,
      { ...message, messageId: "msg2", senderId: "bob@lid" },
    ]);
    expect(await store.all("whatsapp_messages")).toHaveLength(2);
    expect(await store.all("external_identities")).toHaveLength(2);
    expect(
      (await store.all("external_identities")).every(
        (i) => i.memberId === null,
      ),
    ).toBe(true);
    const d = await model.detail(store, viewer, "connection", now);
    expect(d.importedCount).toBe(2);
  });
  it("filters old history, accepts new messages and stops ingestion when paused", async () => {
    const { store, command } = await paired();
    await model.select(
      store,
      viewer,
      "connection",
      { groupIds: ["one@g.us"], consentRecorded: true },
      now,
    );
    const send = (history: boolean, time: number) =>
      model.event(
        store,
        "worker",
        {
          connectionId: "connection",
          generation: command.generation,
          type: "messages",
          history,
          messages: [
            {
              groupId: "one@g.us",
              messageId: String(time),
              senderId: "alice@lid",
              displayName: "Alex",
              text: "I can help with robots",
              occurredAt: new Date(time).toISOString(),
            },
          ],
        },
        now,
      );
    await send(true, now - 31 * 86400000);
    expect(await store.all("whatsapp_messages")).toHaveLength(0);
    await send(false, now);
    await model.control(store, viewer, "connection", "pause", now);
    await send(false, now + 1);
    expect(await store.all("whatsapp_messages")).toHaveLength(1);
    await model.control(store, viewer, "connection", "disconnect", now);
    const d = await model.detail(store, viewer, "connection", now);
    expect(d.qr).toBeNull();
    expect(d.desired).toBe("disconnected");
  });
});
it("does not let a worker report logout while the organiser still wants a connection", async () => {
  const { store, command } = await paired();
  await expect(
    model.event(
      store,
      "worker",
      {
        connectionId: "connection",
        generation: command.generation,
        type: "disconnected",
      },
      now,
    ),
  ).rejects.toThrow(/disconnect/i);
});
it("does not expose a connected state after its worker lease expires", async () => {
  const { store } = await paired();
  const d = await model.detail(store, viewer, "connection", now + 16000);
  expect(d.status).toBe("connecting");
  expect(d.errorCode).toBe("CONNECTION_LOST");
});
