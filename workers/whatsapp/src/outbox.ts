import { randomUUID } from "node:crypto";
import { EncryptedSessionStore } from "./session-store.js";
// Selected-message batches only. Persistence precedes delivery, and removal follows acknowledgement.
export class DurableOutbox {
  private draining = false;
  constructor(private store: EncryptedSessionStore) {}
  async pending() {
    return (await this.store.list()).length;
  }
  async enqueue(value: unknown) {
    if ((await this.pending()) >= 1000)
      throw new Error("Outbox capacity reached");
    await this.store.write(
      `${String(Date.now()).padStart(15, "0")}-${randomUUID()}`,
      JSON.stringify({ at: Date.now(), value }),
    );
  }
  async drain(send: (value: unknown) => Promise<void>) {
    if (this.draining) return;
    this.draining = true;
    try {
      for (const id of await this.store.list()) {
        const raw = await this.store.read(id);
        if (!raw) continue;
        const item = JSON.parse(raw) as { at: number; value: unknown };
        if (item.at + 7 * 86400000 <= Date.now()) {
          await this.store.remove(id);
          continue;
        }
        await send(item.value);
        await this.store.remove(id);
      }
    } finally {
      this.draining = false;
    }
  }
  async clear() {
    for (const id of await this.store.list()) await this.store.remove(id);
  }
}
