import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { EncryptedSessionStore } from "./session-store.js";
import { WhatsAppTransport } from "./transport.js";
import type {
  WorkerCommand,
  WorkerEvent,
} from "../../../convex/whatsapp/contracts.js";
const base = process.env.SMALLWORLD_URL ?? "http://localhost:3001";
const token = process.env.WHATSAPP_WORKER_TOKEN;
const key = process.env.WHATSAPP_SESSION_KEY;
if (!token || token.length < 32 || !key || !/^[0-9a-f]{64}$/i.test(key))
  throw new Error(
    "Set WHATSAPP_WORKER_TOKEN (32+ characters) and WHATSAPP_SESSION_KEY (64 hex characters)",
  );
const workerId = `worker-${randomUUID()}`;
const store = new EncryptedSessionStore(
  resolve(process.env.WHATSAPP_SESSION_DIR ?? "private/sessions"),
  Buffer.from(key, "hex"),
);
const transports = new Map<
  string,
  { generation: number; transport: WhatsAppTransport }
>();
let stopping = false;
const revoking = new Set<string>();
const flushing = new Set<string>();
async function request<T>(method: string, event?: WorkerEvent): Promise<T> {
  const response = await fetch(`${base}/api/platform/whatsapp/worker`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Worker-Id": workerId,
      "Content-Type": "application/json",
    },
    body: event ? JSON.stringify(event) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Platform ${response.status}`);
  const envelope = (await response.json()) as { data: T };
  return envelope.data;
}
async function poll() {
  try {
    const commands = await request<WorkerCommand[]>("GET");
    const claimed = new Set(commands.map((c) => c.id));
    for (const [id, active] of transports)
      if (!claimed.has(id)) {
        await active.transport.stop(false);
        transports.delete(id);
      }
    for (const c of commands) {
      let active = transports.get(c.id);
      if (
        active &&
        (active.generation !== c.generation || active.transport.closed)
      ) {
        await active.transport.stop(false);
        transports.delete(c.id);
        active = undefined;
      }
      if (c.desired === "disconnected") {
        if (revoking.has(c.id)) continue;
        revoking.add(c.id);
        const transport =
          active?.transport ??
          new WhatsAppTransport(c, store, (e) => request("POST", e));
        if (!active) {
          transports.set(c.id, { generation: c.generation, transport });
          await transport.start();
        }
        transport.update(c);
        void transport
          .stop(true)
          .then(async () => {
            await request("POST", {
              connectionId: c.id,
              generation: c.generation,
              type: "disconnected",
            });
            transports.delete(c.id);
          })
          .catch(() => {
            console.error(
              "Provider logout pending; session retained for retry",
            );
          })
          .finally(() => revoking.delete(c.id));
      } else if (!active) {
        const transport = new WhatsAppTransport(c, store, (e) =>
          request("POST", e),
        );
        transports.set(c.id, { generation: c.generation, transport });
        await transport.start();
      } else active.transport.update(c);
      const current = transports.get(c.id);
      if (current && c.desired === "connected" && !flushing.has(c.id)) {
        flushing.add(c.id);
        void current.transport
          .flush()
          .catch(() => {
            console.error(
              "Message delivery pending; encrypted outbox retained",
            );
          })
          .finally(() => flushing.delete(c.id));
      }
    }
  } catch (error) {
    // Stop sockets on control-plane failure. Continuing past a lost lease can create competing sessions.
    await Promise.all(
      [...transports.values()].map((a) => a.transport.stop(false)),
    );
    transports.clear();
    console.error(
      error instanceof Error && /^Platform \d+$/.test(error.message)
        ? error.message
        : "WhatsApp worker could not reach its control plane",
    );
  }
}
async function shutdown() {
  stopping = true;
  await Promise.all(
    [...transports.values()].map((a) => a.transport.stop(false)),
  );
}
process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
console.log("WhatsApp worker started. QR codes are shown only in Small World.");
while (!stopping) {
  await poll();
  if (!stopping) await new Promise((resolve) => setTimeout(resolve, 2500));
}
