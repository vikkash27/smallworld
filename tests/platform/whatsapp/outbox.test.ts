import { it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EncryptedSessionStore } from "../../../workers/whatsapp/src/session-store";
import { DurableOutbox } from "../../../workers/whatsapp/src/outbox";
it("retains failed deliveries across restarts and drains a normal 1000-message import", async () => {
  const root = await mkdtemp(join(tmpdir(), "sw-outbox-"));
  try {
    const store = new EncryptedSessionStore(root, Buffer.alloc(32, 7));
    const queue = new DurableOutbox(store);
    for (let i = 0; i < 40; i++)
      await queue.enqueue({
        messages: Array.from({ length: 25 }, (_, j) => ({ id: i * 25 + j })),
      });
    await expect(
      queue.drain(async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
    expect(await queue.pending()).toBe(40);
    const recovered = new DurableOutbox(store);
    const received: number[] = [];
    await recovered.drain(async (value) => {
      received.push(
        ...(value as { messages: { id: number }[] }).messages.map((m) => m.id),
      );
    });
    expect(new Set(received).size).toBe(1000);
    expect(await recovered.pending()).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
