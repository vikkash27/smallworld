import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { whatsappTables } from "./whatsapp/schema";

// Contract IDs and ISO dates remain strings, including fixture IDs.
const nullableString = v.union(v.string(), v.null());
const dataMode = v.union(v.literal("sample"), v.literal("live"));
const scopedRecord = { id: v.string(), workspaceId: v.string(), dataMode };
const signalKind = v.union(
  v.literal("building"),
  v.literal("seeking"),
  v.literal("offering"),
  v.literal("stated_experience"),
  v.literal("interest"),
  v.literal("availability"),
);
const evidenceClass = v.union(v.literal("explicit"), v.literal("inferred"));
const circleStatus = v.union(
  v.literal("draft"),
  v.literal("forming"),
  v.literal("active"),
  v.literal("archived"),
);
const invitationStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("expired"),
  v.literal("revoked"),
);
const activity = v.object({
  title: v.string(),
  description: v.string(),
  proposedStartsAt: nullableString,
  timezone: v.literal("Europe/London"),
  location: nullableString,
});
const memberSummary = v.object({
  id: v.string(),
  displayName: v.string(),
  initials: v.string(),
  communityIds: v.array(v.string()),
});
const evidence = v.object({
  id: v.string(),
  signalId: v.string(),
  kind: signalKind,
  summary: v.string(),
  excerpt: nullableString,
  sourceLabel: v.string(),
  occurredAt: nullableString,
  sourceUrl: nullableString,
  evidenceClass,
});
const circleDraft = v.object({
  title: v.string(),
  purpose: v.string(),
  activity,
  proposedMemberIds: v.array(v.string()),
  capacity: v.number(),
  minimumMembers: v.number(),
});
const searchResult = v.object({
  dataMode,
  retrievalBackend: v.union(v.literal("cognee"), v.literal("local")),
  status: v.union(v.literal("ready"), v.literal("empty")),
  people: v.array(
    v.object({
      member: memberSummary,
      fitType: v.union(
        v.literal("experience"),
        v.literal("complementary_need"),
        v.literal("collaborator"),
        v.literal("peer"),
        v.literal("speaker"),
      ),
      reason: v.string(),
      evidence: v.array(evidence),
      caveats: v.array(v.string()),
      availability: v.union(
        v.literal("stated_available"),
        v.literal("unknown"),
      ),
    }),
  ),
  communities: v.array(
    v.object({
      communityId: v.string(),
      reason: v.string(),
      sourceUrl: v.string(),
    }),
  ),
  circleDraft: v.union(circleDraft, v.null()),
  message: nullableString,
});

// Indexes are not unique constraints. Domain writes check uniqueness inside
// the same atomic mutation before inserting memberships and invitations.
export default defineSchema({
  ...whatsappTables,
  workspaces: defineTable({
    id: v.string(),
    dataMode,
    organizerId: v.string(),
    allowedCommunityIds: v.array(v.string()),
  }).index("by_domain_id", ["id"]),
  contribution_capabilities: defineTable({
    ...scopedRecord,
    tokenHash: v.string(),
    permittedCommunityIds: v.array(v.string()),
    expiresAt: v.string(),
    revoked: v.boolean(),
  })
    .index("by_domain_id", ["id"])
    .index("by_workspace_mode", ["workspaceId", "dataMode"])
    .index("by_token_hash", ["tokenHash"]),
  communities: defineTable({
    id: v.string(),
    name: v.string(),
    description: nullableString,
    focusTags: v.array(v.string()),
    publicUrl: v.string(),
    metadataSourceUrl: v.string(),
    metadataVerifiedAt: v.string(),
    status: v.union(
      v.literal("listed"),
      v.literal("participating"),
      v.literal("connected"),
    ),
  }).index("by_domain_id", ["id"]),
  members: defineTable({
    ...scopedRecord,
    displayName: v.string(),
    initials: v.string(),
    communityIds: v.array(v.string()),
    consentToDiscovery: v.boolean(),
    showOnRoster: v.boolean(),
    currentAvailability: v.union(
      v.literal("stated_available"),
      v.literal("unknown"),
      v.literal("unavailable"),
    ),
  })
    .index("by_domain_id", ["id"])
    .index("by_workspace_mode", ["workspaceId", "dataMode"]),
  memberships: defineTable({
    ...scopedRecord,
    memberId: v.string(),
    communityId: v.string(),
    confirmed: v.boolean(),
  })
    .index("by_domain_id", ["id"])
    .index("by_workspace_mode", ["workspaceId", "dataMode"])
    .index("by_member_community", ["memberId", "communityId"]),
  sources: defineTable({
    ...scopedRecord,
    sourceType: v.string(),
    sourceLabel: v.string(),
    sourceUrl: nullableString,
    authorMemberId: nullableString,
    permittedCommunityIds: v.array(v.string()),
    redactedContent: nullableString,
    occurredAt: nullableString,
    createdAt: v.string(),
  })
    .index("by_domain_id", ["id"])
    .index("by_workspace_mode", ["workspaceId", "dataMode"]),
  signals: defineTable({
    ...scopedRecord,
    memberId: v.string(),
    communityIds: v.array(v.string()),
    kind: signalKind,
    topic: v.string(),
    statement: v.string(),
    evidenceClass,
    visibility: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("withdrawn"),
    ),
    validUntil: nullableString,
  })
    .index("by_domain_id", ["id"])
    .index("by_workspace_mode", ["workspaceId", "dataMode"])
    .index("by_member", ["memberId"]),
  signal_evidence: defineTable({
    ...scopedRecord,
    signalId: v.string(),
    sourceId: v.string(),
    authorMemberId: nullableString,
    kind: signalKind,
    summary: v.string(),
    excerpt: nullableString,
    sourceLabel: v.string(),
    occurredAt: nullableString,
    sourceUrl: nullableString,
    evidenceClass,
  })
    .index("by_domain_id", ["id"])
    .index("by_workspace_mode", ["workspaceId", "dataMode"])
    .index("by_signal", ["signalId"]),
  searches: defineTable({
    ...scopedRecord,
    viewerId: v.string(),
    expiresAt: v.string(),
    goal: v.string(),
    communityIds: v.array(v.string()),
    result: searchResult,
  })
    .index("by_domain_id", ["id"])
    .index("by_workspace_mode", ["workspaceId", "dataMode"]),
  circles: defineTable({
    ...scopedRecord,
    creatorId: v.string(),
    hostMemberId: v.string(),
    searchId: v.string(),
    communityIds: v.array(v.string()),
    title: v.string(),
    purpose: v.string(),
    activity,
    capacity: v.number(),
    minimumMembers: v.number(),
    acceptedCount: v.number(),
    status: circleStatus,
    activityConfirmed: v.boolean(),
  })
    .index("by_domain_id", ["id"])
    .index("by_workspace_mode", ["workspaceId", "dataMode"]),
  circle_members: defineTable({
    ...scopedRecord,
    circleId: v.string(),
    memberId: v.string(),
    role: v.union(v.literal("host"), v.literal("member")),
    joinedAt: v.string(),
    showOnRoster: v.boolean(),
  })
    .index("by_domain_id", ["id"])
    .index("by_workspace_mode", ["workspaceId", "dataMode"])
    .index("by_circle_member", ["circleId", "memberId"]),
  invitations: defineTable({
    ...scopedRecord,
    circleId: v.string(),
    intendedMemberId: v.string(),
    tokenHash: v.string(),
    status: invitationStatus,
    expiresAt: v.string(),
  })
    .index("by_domain_id", ["id"])
    .index("by_workspace_mode", ["workspaceId", "dataMode"])
    .index("by_circle_intended_member", ["circleId", "intendedMemberId"])
    .index("by_token_hash", ["tokenHash"]),
  audit_events: defineTable({
    ...scopedRecord,
    actorId: nullableString,
    action: v.string(),
    objectId: v.string(),
    objectType: v.string(),
    status: v.string(),
    occurredAt: v.string(),
  })
    .index("by_domain_id", ["id"])
    .index("by_workspace_mode", ["workspaceId", "dataMode"]),
});
