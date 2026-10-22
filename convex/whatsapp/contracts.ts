import { z } from "zod";
export const groupSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().max(200),
  participantCount: z.number().int().nonnegative().nullable(),
});
export const historySchema = z.object({
  days: z.number().int().min(1).max(90),
  perGroup: z.number().int().min(1).max(1000),
  total: z.number().int().min(1).max(10000),
});
export const selectionSchema = z
  .object({
    groupIds: z.array(z.string().min(1).max(200)).min(1).max(20),
    consentRecorded: z.boolean(),
    history: historySchema.optional(),
  })
  .strict();
export const messageSchema = z.object({
  groupId: z.string().max(200),
  messageId: z.string().min(1).max(200),
  senderId: z.string().min(1).max(200),
  displayName: z.string().max(200),
  text: z.string().min(1).max(16000),
  occurredAt: z.string().datetime().nullable(),
});
const base = {
  connectionId: z.string().min(1).max(100),
  generation: z.number().int().positive(),
};
export const eventSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("qr"),
    qr: z.string().min(1).max(10000),
    expiresAt: z.number(),
  }),
  z.object({
    ...base,
    type: z.literal("connected"),
    groups: z.array(groupSchema).max(2000),
  }),
  z.object({
    ...base,
    type: z.literal("messages"),
    history: z.boolean(),
    messages: z.array(messageSchema).max(25),
  }),
  z.object({
    ...base,
    type: z.literal("status"),
    status: z.enum(["connecting", "disconnected", "failed"]),
    errorCode: z
      .enum(["LOGGED_OUT", "CONNECTION_LOST", "PROVIDER_ERROR"])
      .nullable(),
  }),
  z.object({ ...base, type: z.literal("history_complete") }),
  z.object({ ...base, type: z.literal("disconnected") }),
]);
export type GroupSummary = z.infer<typeof groupSchema>;
export type WorkerEvent = z.infer<typeof eventSchema>;
export type Selection = z.infer<typeof selectionSchema>;
export type ConnectionDetail = {
  id: string;
  status: string;
  desired: string;
  qr: string | null;
  qrExpiresAt: number | null;
  groups: (GroupSummary & { selected: boolean })[];
  history: { days: number; perGroup: number; total: number };
  importedCount: number;
  earliestMessageAt: string | null;
  lastSyncAt: number | null;
  historyComplete: boolean;
  errorCode: string | null;
  consent: {
    recordedAt: number;
    scope: "source_group";
    showOnRoster: false;
  } | null;
};
export type WorkerCommand = {
  id: string;
  generation: number;
  leaseUntil: number;
  desired: string;
  selectedGroupIds: string[];
  history: { days: number; perGroup: number; total: number };
  selectionRevision: number;
};
