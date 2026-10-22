import type { Store, Row } from "../platform_store";
import type { Viewer } from "../../src/shared/contracts";
import { fail } from "../platform_errors";
import {
  eventSchema,
  selectionSchema,
  type ConnectionDetail,
  type WorkerCommand,
} from "./contracts";
const DEFAULT_HISTORY = { days: 30, perGroup: 1000, total: 10000 };
const scoped = (v: Viewer) => ({
  workspaceId: v.workspaceId,
  dataMode: v.dataMode,
});
// Length-prefixed tuples avoid delimiter collisions in provider identifiers.
const key = (...parts: string[]) =>
  parts.map((p) => `${p.length}:${p}`).join("");
async function owned(s: Store, v: Viewer, id: string) {
  const c = await s.get("whatsapp_connections", id);
  if (
    !c ||
    c.workspaceId !== v.workspaceId ||
    c.dataMode !== v.dataMode ||
    c.organizerId !== v.id
  )
    fail("NOT_FOUND", "Connection not found");
  return c;
}
export async function create(s: Store, v: Viewer, id: string, now: number) {
  const active = (await s.all("whatsapp_connections", scoped(v))).filter(
    (c) => c.organizerId === v.id && c.desired !== "disconnected",
  );
  if (active.length >= 3)
    fail("CONFLICT", "Disconnect an existing WhatsApp connection first");
  await s.put("whatsapp_connections", {
    ...scoped(v),
    id,
    organizerId: v.id,
    status: "connecting",
    desired: "connected",
    generation: 0,
    workerId: null,
    leaseUntil: 0,
    qr: null,
    qrExpiresAt: null,
    createdAt: now,
    updatedAt: now,
    selectedAt: null,
    selectionRevision: 0,
    history: DEFAULT_HISTORY,
    importedCount: 0,
    earliestMessageAt: null,
    lastSyncAt: null,
    historyComplete: false,
    errorCode: null,
    consentRecordedAt: null,
  });
  return detail(s, v, id, now);
}
export async function detail(
  s: Store,
  v: Viewer,
  id: string,
  now: number,
): Promise<ConnectionDetail> {
  const c = await owned(s, v, id);
  const groups = (await s.all("whatsapp_groups", scoped(v))).filter(
    (g) => g.connectionId === id,
  );
  const stale = c.desired !== "disconnected" && c.leaseUntil <= now;
  return {
    id,
    status: stale ? "connecting" : c.status,
    desired: c.desired,
    qr:
      c.qrExpiresAt !== null && c.qrExpiresAt > now && c.leaseUntil > now
        ? c.qr
        : null,
    qrExpiresAt: c.qrExpiresAt,
    groups: groups.map((g) => ({
      id: g.providerId,
      name: g.name,
      participantCount: g.participantCount,
      selected: g.selected,
    })),
    history: c.history,
    importedCount: c.importedCount,
    earliestMessageAt: c.earliestMessageAt,
    lastSyncAt: c.lastSyncAt,
    historyComplete: c.historyComplete,
    errorCode: stale ? "CONNECTION_LOST" : c.errorCode,
    consent:
      c.consentRecordedAt === null
        ? null
        : {
            recordedAt: c.consentRecordedAt,
            scope: "source_group",
            showOnRoster: false,
          },
  };
}
export async function list(s: Store, v: Viewer, now: number) {
  return Promise.all(
    (await s.all("whatsapp_connections", scoped(v)))
      .filter((c) => c.organizerId === v.id)
      .map((c) => detail(s, v, c.id, now)),
  );
}
export async function select(
  s: Store,
  v: Viewer,
  id: string,
  input: unknown,
  now: number,
) {
  const data = selectionSchema.parse(input),
    c = await owned(s, v, id);
  if (!data.consentRecorded)
    fail("BAD_INPUT", "Record existing consent before import");
  if (c.status !== "connected")
    fail("CONFLICT", "WhatsApp must be connected before selecting groups");
  const groups = (await s.all("whatsapp_groups", scoped(v))).filter(
    (g) => g.connectionId === id,
  );
  const ids = new Set(data.groupIds);
  if (
    ids.size !== data.groupIds.length ||
    data.groupIds.some((id) => !groups.some((g) => g.providerId === id))
  )
    fail("BAD_INPUT", "Unknown or duplicate group");
  for (const g of groups)
    await s.put("whatsapp_groups", { ...g, selected: ids.has(g.providerId) });
  await s.put("whatsapp_connections", {
    ...c,
    history: data.history ?? DEFAULT_HISTORY,
    consentRecordedAt: now,
    selectedAt: now,
    selectionRevision: c.selectionRevision + 1,
    desired: "connected",
    updatedAt: now,
  });
  return detail(s, v, id, now);
}
export async function control(
  s: Store,
  v: Viewer,
  id: string,
  action: "pause" | "resume" | "disconnect",
  now: number,
) {
  const c = await owned(s, v, id);
  if (c.desired === "disconnected" && action !== "disconnect")
    fail("CONFLICT", "Create a new connection to pair again");
  await s.put("whatsapp_connections", {
    ...c,
    desired:
      action === "pause"
        ? "paused"
        : action === "disconnect"
          ? "disconnected"
          : "connected",
    qr: null,
    qrExpiresAt: null,
    updatedAt: now,
  });
  return detail(s, v, id, now);
}
export async function claim(
  s: Store,
  workerId: string,
  now: number,
): Promise<WorkerCommand[]> {
  const result: WorkerCommand[] = [];
  for (const c of await s.all("whatsapp_connections")) {
    if (
      (c.workerId !== workerId && c.leaseUntil > now) ||
      (c.desired === "disconnected" && c.status === "disconnected")
    )
      continue;
    const generation =
      c.workerId === workerId && c.leaseUntil > now
        ? c.generation
        : c.generation + 1;
    await s.put("whatsapp_connections", {
      ...c,
      generation,
      workerId,
      leaseUntil: now + 15000,
      ...(generation !== c.generation ? { qr: null, qrExpiresAt: null } : {}),
    });
    const groups = (await s.all("whatsapp_groups")).filter(
      (g) => g.connectionId === c.id && g.selected,
    );
    result.push({
      id: c.id,
      generation,
      leaseUntil: now + 15000,
      desired: c.desired,
      selectedGroupIds: groups.map((g) => g.providerId),
      history: c.history,
      selectionRevision: c.selectionRevision,
    });
  }
  return result;
}
export async function event(
  s: Store,
  workerId: string,
  input: unknown,
  now: number,
) {
  const e = eventSchema.parse(input),
    c = await s.get("whatsapp_connections", e.connectionId);
  if (
    !c ||
    c.workerId !== workerId ||
    c.generation !== e.generation ||
    c.leaseUntil <= now
  )
    fail("CONFLICT", "Worker lease expired");
  const scope = { workspaceId: c.workspaceId, dataMode: c.dataMode };
  if (e.type === "disconnected") {
    if (c.desired !== "disconnected")
      fail("CONFLICT", "Disconnect must be requested first");
    await s.put("whatsapp_connections", {
      ...c,
      status: "disconnected",
      qr: null,
      qrExpiresAt: null,
      updatedAt: now,
    });
  } else if (c.desired === "disconnected") return { accepted: false };
  else if (e.type === "qr") {
    if (e.expiresAt <= now || e.expiresAt > now + 120000)
      fail("BAD_INPUT", "Invalid QR expiry");
    await s.put("whatsapp_connections", {
      ...c,
      status: "pairing",
      qr: e.qr,
      qrExpiresAt: e.expiresAt,
      updatedAt: now,
    });
  } else if (e.type === "connected") {
    const previous = (await s.all("whatsapp_groups", scope)).filter(
      (g) => g.connectionId === c.id,
    );
    for (const g of previous)
      if (!e.groups.some((n) => n.id === g.providerId))
        await s.remove("whatsapp_groups", g.id);
    for (const g of e.groups) {
      const old = previous.find((p) => p.providerId === g.id);
      await s.put("whatsapp_groups", {
        ...scope,
        id: key(c.id, g.id),
        connectionId: c.id,
        providerId: g.id,
        name: g.name,
        participantCount: g.participantCount,
        selected: old?.selected ?? false,
        importedCount: old?.importedCount ?? 0,
      });
    }
    await s.put("whatsapp_connections", {
      ...c,
      status: "connected",
      qr: null,
      qrExpiresAt: null,
      updatedAt: now,
      errorCode: null,
    });
  } else if (e.type === "status") {
    await s.put("whatsapp_connections", {
      ...c,
      status: e.status,
      errorCode: e.errorCode,
      qr: null,
      qrExpiresAt: null,
      updatedAt: now,
    });
  } else if (e.type === "history_complete") {
    await s.put("whatsapp_connections", {
      ...c,
      historyComplete: true,
      updatedAt: now,
    });
  } else if (e.type === "messages") {
    if (c.desired !== "connected" || c.consentRecordedAt === null)
      return { accepted: false };
    let count = c.importedCount,
      earliest = c.earliestMessageAt;
    const groups = (await s.all("whatsapp_groups", scope)).filter(
      (g) => g.connectionId === c.id && g.selected,
    );
    for (const m of e.messages) {
      const g = groups.find((g) => g.providerId === m.groupId);
      if (!g || !m.text.trim()) continue;
      const time = m.occurredAt === null ? null : Date.parse(m.occurredAt);
      if (time !== null && time > now + 300000) continue;
      if (
        e.history &&
        (time === null || time < now - c.history.days * 86400000)
      )
        continue;
      const id = key(c.id, m.groupId, m.messageId),
        existing = await s.get("whatsapp_messages", id);
      if (existing) continue; // Edits need a separate revision event, never replay as a new message.
      if (
        e.history &&
        (count >= c.history.total || g.importedCount >= c.history.perGroup)
      )
        continue;
      const identityId = key(c.workspaceId, c.id, m.senderId);
      if (!(await s.get("external_identities", identityId)))
        await s.put("external_identities", {
          ...scope,
          id: identityId,
          connectionId: c.id,
          providerId: m.senderId,
          displayName: m.displayName,
          memberId: null,
          status: "unresolved",
        });
      await s.put("whatsapp_messages", {
        ...scope,
        id,
        connectionId: c.id,
        groupId: m.groupId,
        messageId: m.messageId,
        identityId,
        text: m.text,
        occurredAt: m.occurredAt,
        receivedAt: now,
        expiresAt: now + 7 * 86400000,
        revision: 1,
      });
      count++;
      g.importedCount++;
      await s.put("whatsapp_groups", g);
      if (m.occurredAt && (!earliest || m.occurredAt < earliest))
        earliest = m.occurredAt;
    }
    await s.put("whatsapp_connections", {
      ...c,
      importedCount: count,
      earliestMessageAt: earliest,
      lastSyncAt: now,
      updatedAt: now,
    });
  }
  return { accepted: true };
}
