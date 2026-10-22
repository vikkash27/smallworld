import { defineTable } from "convex/server";
import { v } from "convex/values";
const scope = {
  id: v.string(),
  workspaceId: v.string(),
  dataMode: v.union(v.literal("sample"), v.literal("live")),
};
const nullable = v.union(v.string(), v.null());
export const whatsappTables = {
  whatsapp_connections: defineTable({
    ...scope,
    organizerId: v.string(),
    status: v.string(),
    desired: v.string(),
    generation: v.number(),
    workerId: nullable,
    leaseUntil: v.number(),
    qr: nullable,
    qrExpiresAt: v.union(v.number(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
    selectedAt: v.union(v.number(), v.null()),
    selectionRevision: v.number(),
    history: v.object({
      days: v.number(),
      perGroup: v.number(),
      total: v.number(),
    }),
    importedCount: v.number(),
    earliestMessageAt: nullable,
    lastSyncAt: v.union(v.number(), v.null()),
    historyComplete: v.boolean(),
    errorCode: nullable,
    consentRecordedAt: v.union(v.number(), v.null()),
  })
    .index("by_domain_id", ["id"])
    .index("by_workspace_mode", ["workspaceId", "dataMode"]),
  whatsapp_groups: defineTable({
    ...scope,
    connectionId: v.string(),
    providerId: v.string(),
    name: v.string(),
    participantCount: v.union(v.number(), v.null()),
    selected: v.boolean(),
    importedCount: v.number(),
  })
    .index("by_domain_id", ["id"])
    .index("by_workspace_mode", ["workspaceId", "dataMode"])
    .index("by_connection", ["connectionId"]),
  external_identities: defineTable({
    ...scope,
    connectionId: v.string(),
    providerId: v.string(),
    displayName: v.string(),
    memberId: nullable,
    status: v.literal("unresolved"),
  })
    .index("by_domain_id", ["id"])
    .index("by_workspace_mode", ["workspaceId", "dataMode"]),
  whatsapp_messages: defineTable({
    ...scope,
    connectionId: v.string(),
    groupId: v.string(),
    messageId: v.string(),
    identityId: v.string(),
    text: v.string(),
    occurredAt: nullable,
    receivedAt: v.number(),
    expiresAt: v.number(),
    revision: v.number(),
  })
    .index("by_domain_id", ["id"])
    .index("by_workspace_mode", ["workspaceId", "dataMode"])
    .index("by_connection", ["connectionId"])
    .index("by_expiry", ["expiresAt"]),
};
