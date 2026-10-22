import { z } from "zod";

const id = z.string().trim().min(1).max(200);
const text = (max: number) => z.string().trim().min(1).max(max);
const ids = z
  .array(id)
  .max(12)
  .refine((v) => new Set(v).size === v.length, "IDs must be distinct");
export const activitySchema = z
  .object({
    title: text(160),
    description: text(2000),
    proposedStartsAt: z.iso.datetime({ offset: true }).nullable(),
    timezone: z.literal("Europe/London"),
    location: text(300).nullable(),
  })
  .strict();
const draft = z
  .object({
    title: text(160),
    purpose: text(2000),
    activity: activitySchema,
    proposedMemberIds: ids.max(3),
    capacity: z.number().int().min(2).max(100),
    minimumMembers: z.number().int().min(2).max(100),
  })
  .strict()
  .refine((v) => v.capacity >= v.minimumMembers, "Capacity must meet minimum");
export const createCircleSchema = z
  .object({
    searchId: id,
    selectedMemberIds: ids.min(1).max(3),
    title: text(160),
    purpose: text(2000),
    activity: activitySchema,
    capacity: z.number().int().min(2).max(100).default(6),
    minimumMembers: z.number().int().min(2).max(100).default(3),
  })
  .strict()
  .refine((v) => v.capacity >= v.minimumMembers, "Capacity must meet minimum");
export const activityUpdateSchema = z
  .object({ activity: activitySchema, confirmed: z.boolean() })
  .strict();
export const responseSchema = z
  .object({
    decision: z.enum(["join", "decline"]),
    showOnRoster: z.boolean(),
  })
  .strict();
export const contributionSchema = z
  .object({
    token: z.string().min(16).max(256),
    displayName: text(100),
    building: text(2000),
    offering: text(2000),
    seeking: text(2000),
    availability: text(500).nullable(),
    permittedCommunityIds: ids.min(1),
    consentToDiscovery: z.literal(true),
  })
  .strict();
const evidence = z
  .object({
    id,
    signalId: id,
    kind: z.enum([
      "building",
      "seeking",
      "offering",
      "stated_experience",
      "interest",
      "availability",
    ]),
    summary: text(2000),
    excerpt: z.string().max(8000).nullable(),
    sourceLabel: text(300),
    occurredAt: z.iso.datetime({ offset: true }).nullable(),
    sourceUrl: z.url().nullable(),
    evidenceClass: z.enum(["explicit", "inferred"]),
  })
  .strict();
const member = z
  .object({ id, displayName: text(100), initials: text(10), communityIds: ids })
  .strict();
export const saveSearchSchema = z
  .object({
    goal: text(2000),
    communityIds: ids.min(1),
    result: z
      .object({
        dataMode: z.enum(["sample", "live"]),
        retrievalBackend: z.enum(["local", "cognee"]),
        status: z.enum(["ready", "empty"]),
        people: z
          .array(
            z
              .object({
                member,
                fitType: z.enum([
                  "experience",
                  "complementary_need",
                  "collaborator",
                  "peer",
                  "speaker",
                ]),
                reason: text(2000),
                evidence: z.array(evidence).min(1).max(20),
                caveats: z.array(z.string().max(2000)).max(20),
                availability: z.enum(["stated_available", "unknown"]),
              })
              .strict(),
          )
          .max(12),
        communities: z
          .array(
            z
              .object({
                communityId: id,
                reason: text(2000),
                sourceUrl: z.url(),
              })
              .strict(),
          )
          .max(2),
        circleDraft: draft.nullable(),
        message: z.string().max(2000).nullable(),
      })
      .strict(),
  })
  .strict();
export const pathIdSchema = id;
export const tokenSchema = z
  .string()
  .min(16)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/);
export const viewerSchema = z
  .object({
    id,
    workspaceId: id,
    role: z.literal("organizer"),
    allowedCommunityIds: ids,
    dataMode: z.enum(["sample", "live"]),
  })
  .strict();
