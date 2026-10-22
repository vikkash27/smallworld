import makeWASocket, {
  Browsers,
  DisconnectReason,
  jidNormalizedUser,
  type WASocket,
  type WAMessage,
  type WAMessageKey,
} from "baileys";
import { pino } from "pino";
import { encryptedAuth } from "./auth-state.js";
import { EncryptedSessionStore, logoutAndErase } from "./session-store.js";
import { DurableOutbox } from "./outbox.js";
import { selectedText } from "./ingest.js";
import type {
  WorkerCommand,
  WorkerEvent,
} from "../../../convex/whatsapp/contracts.js";
type Emit = (event: WorkerEvent) => Promise<void>;
type Payload = WorkerEvent extends infer E
  ? E extends WorkerEvent
    ? Omit<E, "connectionId" | "generation">
    : never
  : never;
export class WhatsAppTransport {
  private socket: WASocket | null = null;
  private stopped = false;
  private loggedOut = false;
  private opened = false;
  private reconnect: ReturnType<typeof setTimeout> | null = null;
  private leaseTimer: ReturnType<typeof setTimeout> | null = null;
  private selected = new Set<string>();
  private revision = 0;
  private cursors = new Map<string, { key: WAMessageKey; timestamp: number }>();
  private ingestQueue: Promise<void> = Promise.resolve();
  private auth: Awaited<ReturnType<typeof encryptedAuth>> | null = null;
  private retries = 0;
  private historyCounts = new Map<string, number>();
  private historyTotal = 0;
  private outbox: DurableOutbox;
  private seenHistory = new Set<string>();
  get closed() {
    return this.stopped;
  }
  constructor(
    private command: WorkerCommand,
    private store: EncryptedSessionStore,
    private emit: Emit,
  ) {
    this.selected = new Set(command.selectedGroupIds);
    this.outbox = new DurableOutbox(store.child(`${command.id}-outbox`));
    this.renewLease();
  }
  private renewLease() {
    if (this.leaseTimer) clearTimeout(this.leaseTimer);
    this.leaseTimer = setTimeout(
      () => {
        void this.stop(false).catch(() => undefined);
      },
      Math.max(0, this.command.leaseUntil - Date.now() - 500),
    );
  }
  private async event(e: Payload) {
    if (Date.now() >= this.command.leaseUntil)
      throw new Error("Worker lease expired");
    return this.emit({
      ...e,
      connectionId: this.command.id,
      generation: this.command.generation,
    } as WorkerEvent);
  }
  async start() {
    this.auth = await encryptedAuth(this.store, this.command.id);
    if (this.stopped) return;
    const socket = makeWASocket({
      auth: this.auth.state,
      logger: pino({ level: "silent" }),
      browser: Browsers.macOS("Desktop"),
      syncFullHistory: true,
      markOnlineOnConnect: false,
      getMessage: async () => undefined,
    });
    this.socket = socket;
    this.opened = false;
    socket.ev.on("creds.update", () => {
      void this.auth?.save().catch(() => this.fail());
    });
    socket.ev.on("connection.update", (update) => {
      if (this.stopped) return;
      if (update.qr)
        void this.event({
          type: "qr",
          qr: update.qr,
          expiresAt: Date.now() + 55000,
        }).catch(() => this.fail());
      if (update.connection === "open") {
        this.opened = true;
        this.retries = 0;
        if (this.command.desired !== "disconnected")
          void socket
            .groupFetchAllParticipating()
            .then((groups) =>
              this.event({
                type: "connected",
                groups: Object.values(groups)
                  .filter((g) => !g.isCommunity)
                  .map((g) => ({
                    id: g.id,
                    name: g.subject,
                    participantCount: g.participants.length,
                  })),
              }),
            )
            .catch(() => this.fail());
      }
      if (update.connection === "close") {
        this.opened = false;
        const code = (
          update.lastDisconnect?.error as
            | { output?: { statusCode?: number } }
            | undefined
        )?.output?.statusCode;
        this.loggedOut = code === DisconnectReason.loggedOut;
        void this.event({
          type: "status",
          status: this.loggedOut ? "failed" : "connecting",
          errorCode: this.loggedOut ? "LOGGED_OUT" : "CONNECTION_LOST",
        }).catch(() => undefined);
        if (
          !this.loggedOut &&
          !this.stopped &&
          this.command.desired !== "disconnected"
        ) {
          const delay =
            code === DisconnectReason.restartRequired
              ? 1000
              : Math.min(30000, 1000 * 2 ** Math.min(this.retries++, 5));
          this.reconnect = setTimeout(() => {
            void this.start().catch(() => this.fail());
          }, delay);
        }
      }
    });
    socket.ev.on("messaging-history.set", (data) => {
      this.messages(data.messages, true);
    });
    socket.ev.on("messages.upsert", (data) => {
      this.messages(data.messages, data.type !== "notify");
    });
  }
  private fail() {
    void this.event({
      type: "status",
      status: "failed",
      errorCode: "PROVIDER_ERROR",
    }).catch(() => undefined);
  }
  private messages(messages: WAMessage[], history: boolean) {
    if (this.stopped || this.command.desired !== "connected") return;
    const decoded: ReturnType<typeof selectedText>[] = [];
    for (const message of messages) {
      const group = message.key.remoteJid,
        timestamp = Number(message.messageTimestamp);
      // Before selection, retain only the newest opaque cursor. Never retain unselected text.
      if (
        group?.endsWith("@g.us") &&
        Number.isFinite(timestamp) &&
        message.key.id &&
        (!this.cursors.has(group) ||
          timestamp > this.cursors.get(group)!.timestamp)
      )
        this.cursors.set(group, { key: message.key, timestamp });
      const m = selectedText(
        message,
        this.selected,
        this.socket?.user?.id
          ? jidNormalizedUser(this.socket.user.id)
          : undefined,
      );
      if (!m) continue;
      if (history) {
        const key = `${m.groupId}:${m.messageId}`;
        if (this.seenHistory.has(key)) continue;
        if (
          m.occurredAt === null ||
          Date.parse(m.occurredAt) <
            Date.now() - this.command.history.days * 86400000
        )
          continue;
        if (
          this.historyTotal >= this.command.history.total ||
          (this.historyCounts.get(m.groupId) ?? 0) >=
            this.command.history.perGroup
        )
          continue;
        this.seenHistory.add(key);
        this.historyCounts.set(
          m.groupId,
          (this.historyCounts.get(m.groupId) ?? 0) + 1,
        );
        this.historyTotal++;
      }
      decoded.push(m);
    }
    const revision = this.revision;
    this.ingestQueue = this.ingestQueue
      .then(async () => {
        let batch: NonNullable<ReturnType<typeof selectedText>>[] = [],
          bytes = 0;
        const save = async () => {
          if (batch.length)
            await this.outbox.enqueue({ history, messages: batch });
          batch = [];
          bytes = 0;
        };
        for (const m of decoded) {
          if (
            !m ||
            this.stopped ||
            this.command.desired !== "connected" ||
            revision !== this.revision ||
            !this.selected.has(m.groupId)
          )
            continue;
          const size = Buffer.byteLength(JSON.stringify(m));
          if (batch.length >= 25 || bytes + size > 24000) await save();
          batch.push(m);
          bytes += size;
        }
        await save();
      })
      .catch(() => {
        this.fail();
        void this.stop(false).catch(() => undefined);
      });
  }
  async flush() {
    if (this.stopped || this.command.desired !== "connected") return;
    await this.outbox.drain(async (raw) => {
      if (this.stopped || this.command.desired !== "connected")
        throw new Error("Ingestion paused");
      const item = raw as {
        history: boolean;
        messages: NonNullable<ReturnType<typeof selectedText>>[];
      };
      const messages = item.messages.filter((m) =>
        this.selected.has(m.groupId),
      );
      if (messages.length)
        await this.event({ type: "messages", history: item.history, messages });
    });
  }
  update(command: WorkerCommand) {
    const changed = command.selectionRevision !== this.revision;
    this.command = command;
    this.selected = new Set(command.selectedGroupIds);
    this.revision = command.selectionRevision;
    if (this.stopped) return;
    this.renewLease();
    if (changed && this.socket && command.desired === "connected") {
      // Provider history requests run independently from lease renewal.
      for (const group of this.selected) {
        const cursor = this.cursors.get(group);
        if (cursor)
          void this.socket
            .fetchMessageHistory(
              command.history.perGroup,
              cursor.key,
              cursor.timestamp,
            )
            .catch(() => undefined);
      }
    }
  }
  async stop(revoke: boolean) {
    if (this.reconnect) clearTimeout(this.reconnect);
    if (this.leaseTimer) clearTimeout(this.leaseTimer);
    if (revoke) {
      await logoutAndErase(this.store, this.command.id, async () => {
        if (this.auth?.state.creds.registered && !this.loggedOut) {
          if (!this.socket) throw new Error("No provider socket for logout");
          if (!this.opened)
            await this.socket.waitForConnectionUpdate(
              async (u) => u.connection === "open",
              10000,
            );
          await this.socket.logout();
        }
        this.stopped = true;
        this.socket?.end(new Error("Disconnected"));
        await this.auth?.flush();
      });
      await this.ingestQueue;
      await this.outbox.clear();
    } else {
      this.stopped = true;
      this.socket?.end(new Error("Worker stopped"));
      await this.auth?.flush();
    }
  }
}
