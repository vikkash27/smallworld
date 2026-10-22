import type {
  ActivityUpdateRequest,
  BootstrapResponse,
  CandidateContext,
  CircleDetail,
  CircleSummary,
  Community,
  ContributionRequest,
  ContributionResponse,
  CreateCircleRequest,
  InvitationResponse,
  InvitationResponseRequest,
  InvitationView,
  MemberSummary,
  SavedSearch,
  SaveSearchInput,
  Viewer,
} from "../src/shared/contracts";
import type { Row, Store } from "./platform_store";
import { fail } from "./platform_errors";
import {
  activityUpdateSchema,
  contributionSchema,
  createCircleSchema,
  responseSchema,
  saveSearchSchema,
} from "./platform_validation";

export const SAMPLE_WORKSPACE = "sample-workspace";
export const LIVE_WORKSPACE = "live-workspace";
export const hostId = (mode: "sample" | "live") =>
  mode === "sample" ? "demo-host" : "live-host";
const nowIso = () => new Date().toISOString();
const fresh = (expiry: string) => Date.parse(expiry) > Date.now();
const scoped = (
  row: { workspaceId: string; dataMode: string },
  viewer: { workspaceId: string; dataMode: string },
) => row.workspaceId === viewer.workspaceId && row.dataMode === viewer.dataMode;
const memberSummary = (m: Row<"members">): MemberSummary => ({
  id: m.id,
  displayName: m.displayName,
  initials: m.initials,
  communityIds: m.communityIds,
});
const summary = (c: Row<"circles">): CircleSummary => ({
  id: c.id,
  title: c.title,
  purpose: c.purpose,
  status: c.status,
  capacity: c.capacity,
  minimumMembers: c.minimumMembers,
  acceptedCount: c.acceptedCount,
  activity: c.activity,
  activityConfirmed: c.activityConfirmed,
});
export async function authorize(store: Store, viewer: Viewer) {
  const workspace = await store.get("workspaces", viewer.workspaceId);
  if (
    !workspace ||
    workspace.organizerId !== viewer.id ||
    workspace.dataMode !== viewer.dataMode
  )
    fail("FORBIDDEN", "Workspace is not available");
  if (
    viewer.allowedCommunityIds.some(
      (id) => !workspace.allowedCommunityIds.includes(id),
    )
  )
    fail("FORBIDDEN", "Community scope is not available");
  return workspace;
}

export async function communities(
  store: Store,
  viewer: Viewer,
): Promise<Community[]> {
  const workspace = await authorize(store, viewer);
  return (await store.all("communities")).map((c) => ({
    ...c,
    status: workspace.allowedCommunityIds.includes(c.id)
      ? c.status === "connected"
        ? "connected"
        : "participating"
      : "listed",
  }));
}

export async function bootstrap(
  store: Store,
  viewer: Viewer,
): Promise<BootstrapResponse> {
  const member = await store.get("members", viewer.id);
  if (!member || !scoped(member, viewer))
    fail("NOT_FOUND", "Organizer not found; run the seed command");
  return {
    viewer: { displayName: member.displayName, initials: member.initials },
    dataMode: viewer.dataMode,
    allowedCommunityIds: viewer.allowedCommunityIds,
    communities: await communities(store, viewer),
  };
}

export async function contexts(
  store: Store,
  viewer: Viewer,
  communityIds: string[],
): Promise<CandidateContext[]> {
  await authorize(store, viewer);
  if (communityIds.some((id) => !viewer.allowedCommunityIds.includes(id)))
    fail("FORBIDDEN", "Community scope is not available");
  const members = (await store.all("members", viewer)).filter(
    (m) => scoped(m, viewer) && m.consentToDiscovery,
  );
  const signals = await store.all("signals", viewer);
  const evidence = await store.all("signal_evidence", viewer);
  const sources = await store.all("sources", viewer);
  const memberships = await store.all("memberships", viewer);
  const result: CandidateContext[] = [];
  for (const m of members) {
    const allowed = m.communityIds.filter(
      (id) =>
        communityIds.includes(id) &&
        memberships.some(
          (membership) =>
            scoped(membership, viewer) &&
            membership.memberId === m.id &&
            membership.communityId === id &&
            membership.confirmed,
        ),
    );
    if (!allowed.length) continue;
    const approved: CandidateContext["signals"] = [];
    for (const s of signals.filter(
      (s) =>
        scoped(s, viewer) &&
        s.memberId === m.id &&
        s.status === "approved" &&
        s.visibility === "communities" &&
        (!s.validUntil || fresh(s.validUntil)) &&
        s.communityIds.some((id) => allowed.includes(id)),
    )) {
      const permitted = evidence.filter(
        (e) =>
          scoped(e, viewer) &&
          e.signalId === s.id &&
          (e.authorMemberId === null || e.authorMemberId === m.id) &&
          sources.some(
            (source) =>
              scoped(source, viewer) &&
              source.id === e.sourceId &&
              (source.authorMemberId === null ||
                source.authorMemberId === m.id) &&
              source.permittedCommunityIds.some(
                (id) => allowed.includes(id) && s.communityIds.includes(id),
              ),
          ),
      );
      if (!permitted.length) continue;
      approved.push({
        id: s.id,
        kind: s.kind,
        topic: s.topic,
        statement: s.statement,
        validUntil: s.validUntil,
        evidence: permitted.map((e) => ({
          id: e.id,
          signalId: e.signalId,
          kind: e.kind,
          summary: e.summary,
          excerpt: e.excerpt,
          sourceLabel: e.sourceLabel,
          occurredAt: e.occurredAt,
          sourceUrl: e.sourceUrl,
          evidenceClass: e.evidenceClass,
        })),
      });
    }
    if (approved.length)
      result.push({
        member: { ...memberSummary(m), communityIds: allowed },
        signals: approved,
        currentAvailability: m.currentAvailability,
      });
  }
  return result;
}

export async function readSearch(
  store: Store,
  viewer: Viewer,
  id: string,
): Promise<SavedSearch | null> {
  await authorize(store, viewer);
  const search = await store.get("searches", id);
  if (
    !search ||
    !scoped(search, viewer) ||
    search.viewerId !== viewer.id ||
    !fresh(search.expiresAt) ||
    search.communityIds.some((id) => !viewer.allowedCommunityIds.includes(id))
  )
    return null;
  const { dataMode, ...saved } = search;
  void dataMode;
  return saved;
}

// Revalidate the snapshot's evidence against current permissions and consent.
async function validateResult(
  store: Store,
  viewer: Viewer,
  input: SaveSearchInput,
) {
  if (input.result.dataMode !== viewer.dataMode)
    fail("BAD_INPUT", "Search data mode does not match workspace");
  const candidates = await contexts(store, viewer, input.communityIds);
  const memberIds = input.result.people.map((p) => p.member.id);
  if (new Set(memberIds).size !== memberIds.length)
    fail("BAD_INPUT", "Repeated search candidate");
  for (const person of input.result.people) {
    const candidate = candidates.find((c) => c.member.id === person.member.id);
    if (
      !candidate ||
      person.member.displayName !== candidate.member.displayName ||
      person.member.initials !== candidate.member.initials ||
      person.member.communityIds.some(
        (id) => !candidate.member.communityIds.includes(id),
      )
    )
      fail("FORBIDDEN", "Search candidate is no longer available");
    for (const e of person.evidence) {
      const current = candidate.signals
        .flatMap((s) => s.evidence)
        .find((current) => current.id === e.id);
      if (
        !current ||
        (Object.keys(current) as (keyof typeof current)[]).some(
          (key) => current[key] !== e[key],
        )
      )
        fail(
          "CONFLICT",
          "Search evidence is no longer available; run discovery again",
        );
    }
  }
  const proposed = input.result.circleDraft?.proposedMemberIds ?? [];
  if (proposed.some((id) => !memberIds.includes(id) || id === viewer.id))
    fail("BAD_INPUT", "Circle proposal contains an invalid candidate");
  if (
    input.result.communities.some(
      (c) => !input.communityIds.includes(c.communityId),
    )
  )
    fail("FORBIDDEN", "Community fit is outside search scope");
}

export async function saveSearch(
  store: Store,
  viewer: Viewer,
  raw: SaveSearchInput,
): Promise<SavedSearch> {
  const input = saveSearchSchema.parse(raw);
  await validateResult(store, viewer, input);
  const saved: SavedSearch = {
    ...input,
    id: crypto.randomUUID(),
    viewerId: viewer.id,
    workspaceId: viewer.workspaceId,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  };
  await store.put("searches", { ...saved, dataMode: viewer.dataMode });
  return saved;
}

async function ownedCircle(store: Store, viewer: Viewer, id: string) {
  await authorize(store, viewer);
  const c = await store.get("circles", id);
  if (!c || !scoped(c, viewer) || c.creatorId !== viewer.id)
    fail("NOT_FOUND", "Circle not found");
  return c;
}

async function detail(store: Store, c: Row<"circles">): Promise<CircleDetail> {
  const host = await store.get("members", c.hostMemberId);
  if (!host || !scoped(host, c)) fail("NOT_FOUND", "Host not found");
  const roster: CircleDetail["roster"] = [];
  for (const membership of (await store.all("circle_members", c)).filter(
    (m) => scoped(m, c) && m.circleId === c.id,
  )) {
    const member = await store.get("members", membership.memberId);
    if (!member || !scoped(member, c)) continue;
    roster.push({
      id: member.id,
      displayName: membership.showOnRoster ? member.displayName : null,
      initials: membership.showOnRoster ? member.initials : null,
      role: membership.role,
      showOnRoster: membership.showOnRoster,
    });
  }
  const invitations: CircleDetail["invitations"] = [];
  for (const i of (await store.all("invitations", c)).filter(
    (i) => scoped(i, c) && i.circleId === c.id,
  )) {
    const member = await store.get("members", i.intendedMemberId);
    if (member && scoped(member, c))
      invitations.push({
        id: i.id,
        member: memberSummary(member),
        status:
          i.status === "pending" && !fresh(i.expiresAt) ? "expired" : i.status,
        expiresAt: i.expiresAt,
      });
  }
  return {
    ...summary(c),
    host: memberSummary(host),
    communityIds: c.communityIds,
    roster,
    invitations,
  };
}

export async function listCircles(
  store: Store,
  viewer: Viewer,
): Promise<CircleSummary[]> {
  await authorize(store, viewer);
  return (await store.all("circles", viewer))
    .filter((c) => scoped(c, viewer) && c.creatorId === viewer.id)
    .map(summary);
}
export async function circleDetail(store: Store, viewer: Viewer, id: string) {
  return detail(store, await ownedCircle(store, viewer, id));
}

export interface InvitationToken {
  id: string;
  memberId: string;
  tokenHash: string;
}
export async function createCircle(
  store: Store,
  viewer: Viewer,
  raw: CreateCircleRequest,
  tokens: InvitationToken[],
): Promise<CircleDetail> {
  const input = createCircleSchema.parse(raw);
  const search = await readSearch(store, viewer, input.searchId);
  if (!search) fail("NOT_FOUND", "Search not found or expired");
  const proposal = search.result.circleDraft;
  if (
    !proposal ||
    input.selectedMemberIds.some(
      (id) => !proposal.proposedMemberIds.includes(id),
    )
  )
    fail("BAD_INPUT", "Select only people proposed by this search");
  if (
    tokens.length !== input.selectedMemberIds.length ||
    input.selectedMemberIds.some(
      (id) => tokens.filter((t) => t.memberId === id).length !== 1,
    )
  )
    fail("BAD_INPUT", "Invalid invitation recipients");
  await validateResult(store, viewer, search);
  const host = await store.get("members", viewer.id);
  if (!host || !scoped(host, viewer)) fail("NOT_FOUND", "Host not found");
  const c: Row<"circles"> = {
    id: crypto.randomUUID(),
    workspaceId: viewer.workspaceId,
    dataMode: viewer.dataMode,
    creatorId: viewer.id,
    hostMemberId: viewer.id,
    searchId: search.id,
    communityIds: search.communityIds,
    title: input.title,
    purpose: input.purpose,
    activity: input.activity,
    capacity: input.capacity,
    minimumMembers: input.minimumMembers,
    acceptedCount: 1,
    status: "forming",
    activityConfirmed: false,
  };
  await store.put("circles", c);
  await store.put("circle_members", {
    id: crypto.randomUUID(),
    workspaceId: c.workspaceId,
    dataMode: c.dataMode,
    circleId: c.id,
    memberId: host.id,
    role: "host",
    joinedAt: nowIso(),
    showOnRoster: true,
  });
  for (const token of tokens) {
    if (
      (await store.get("invitations", token.id)) ||
      (await store.byToken("invitations", token.tokenHash))
    )
      fail("CONFLICT", "Invitation already exists");
    await store.put("invitations", {
      id: token.id,
      workspaceId: c.workspaceId,
      dataMode: c.dataMode,
      circleId: c.id,
      intendedMemberId: token.memberId,
      tokenHash: token.tokenHash,
      status: "pending",
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    });
  }
  await audit(store, viewer, "circle.created", c.id, "circle", "forming");
  return detail(store, c);
}

export async function updateActivity(
  store: Store,
  viewer: Viewer,
  id: string,
  raw: ActivityUpdateRequest,
) {
  const input = activityUpdateSchema.parse(raw);
  const c = await ownedCircle(store, viewer, id);
  if (c.status === "archived" || c.status === "draft")
    fail("CONFLICT", "Circle activity cannot be updated");
  c.activity = input.activity;
  c.activityConfirmed = input.confirmed;
  c.status =
    c.activityConfirmed && c.acceptedCount >= c.minimumMembers
      ? "active"
      : "forming";
  await store.put("circles", c);
  await audit(store, viewer, "activity.updated", c.id, "circle", c.status);
  return detail(store, c);
}

async function invitationForToken(store: Store, hash: string) {
  const i = await store.byToken("invitations", hash);
  if (!i) fail("NOT_FOUND", "Invitation not found");
  if (!fresh(i.expiresAt) || i.status === "expired" || i.status === "revoked")
    fail("EXPIRED", "Invitation has expired or was revoked");
  const c = await store.get("circles", i.circleId);
  if (!c || !scoped(c, i)) fail("NOT_FOUND", "Circle not found");
  return { i, c };
}

export async function invitationView(
  store: Store,
  hash: string,
): Promise<InvitationView> {
  const { i, c } = await invitationForToken(store, hash);
  const host = await store.get("members", c.hostMemberId);
  if (!host || !scoped(host, c)) fail("NOT_FOUND", "Host not found");
  // Expiry is derived without writing: GET/unfurlers cannot change state.
  return {
    dataMode: c.dataMode,
    circle: summary(c),
    hostDisplayName: host.displayName,
    invitationStatus: i.status,
    expiresAt: i.expiresAt,
  };
}

export async function respond(
  store: Store,
  hash: string,
  raw: InvitationResponseRequest,
): Promise<InvitationResponse> {
  const input = responseSchema.parse(raw);
  const { i, c } = await invitationForToken(store, hash);
  const desired = input.decision === "join" ? "accepted" : "declined";
  if (i.status === desired)
    return {
      invitationStatus: desired,
      circleId: c.id,
      acceptedCount: c.acceptedCount,
      circleStatus: c.status,
    };
  if (i.status !== "pending")
    fail("CONFLICT", "Invitation already has a different response");
  if (c.status !== "forming") fail("CONFLICT", "Circle is no longer forming");
  if (input.decision === "join") {
    const member = await store.get("members", i.intendedMemberId);
    if (!member || !scoped(member, c))
      fail("NOT_FOUND", "Invited member not found");
    const existing = await store.circleMembership(c.id, i.intendedMemberId);
    if (existing && !scoped(existing, c))
      fail("CONFLICT", "Circle membership scope conflict");
    if (!existing) {
      if (c.acceptedCount >= c.capacity)
        fail("CONFLICT", "Circle is at capacity");
      await store.put("circle_members", {
        id: crypto.randomUUID(),
        workspaceId: c.workspaceId,
        dataMode: c.dataMode,
        circleId: c.id,
        memberId: i.intendedMemberId,
        role: "member",
        joinedAt: nowIso(),
        showOnRoster: input.showOnRoster,
      });
      c.acceptedCount += 1;
    } else {
      await store.put("circle_members", {
        ...existing,
        showOnRoster: input.showOnRoster,
      });
    }
    c.status =
      c.activityConfirmed && c.acceptedCount >= c.minimumMembers
        ? "active"
        : "forming";
    await store.put("circles", c);
  }
  i.status = desired;
  await store.put("invitations", i);
  await audit(
    store,
    { ...c, id: i.intendedMemberId },
    "invitation.responded",
    i.id,
    "invitation",
    desired,
  );
  return {
    invitationStatus: desired,
    circleId: c.id,
    acceptedCount: c.acceptedCount,
    circleStatus: c.status,
  };
}

export async function contribute(
  store: Store,
  raw: ContributionRequest,
  hash: string,
): Promise<ContributionResponse> {
  const input = contributionSchema.parse(raw);
  const capability = await store.byToken("contribution_capabilities", hash);
  if (!capability) fail("NOT_FOUND", "Contribution capability not found");
  if (capability.revoked || !fresh(capability.expiresAt))
    fail("EXPIRED", "Contribution capability has expired or was revoked");
  const workspace = await store.get("workspaces", capability.workspaceId);
  if (
    !workspace ||
    workspace.dataMode !== capability.dataMode ||
    input.permittedCommunityIds.some(
      (id) =>
        !capability.permittedCommunityIds.includes(id) ||
        !workspace.allowedCommunityIds.includes(id),
    )
  )
    fail("FORBIDDEN", "Contribution scope is not available");
  const id = crypto.randomUUID();
  const scope = {
    workspaceId: capability.workspaceId,
    dataMode: capability.dataMode,
  };
  await store.put("members", {
    ...scope,
    id,
    displayName: input.displayName,
    initials: input.displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase(),
    communityIds: input.permittedCommunityIds,
    consentToDiscovery: true,
    showOnRoster: false,
    currentAvailability: "unknown",
  });
  for (const communityId of input.permittedCommunityIds)
    await store.put("memberships", {
      ...scope,
      id: crypto.randomUUID(),
      memberId: id,
      communityId,
      confirmed: true,
    });
  for (const kind of [
    "building",
    "offering",
    "seeking",
    "availability",
  ] as const) {
    const statement = input[kind];
    if (!statement) continue;
    const signalId = crypto.randomUUID();
    const sourceId = crypto.randomUUID();
    await store.put("sources", {
      ...scope,
      id: sourceId,
      sourceType: "contribution",
      sourceLabel: "Contributed statement",
      sourceUrl: null,
      authorMemberId: id,
      permittedCommunityIds: input.permittedCommunityIds,
      redactedContent: statement,
      occurredAt: nowIso(),
      createdAt: nowIso(),
    });
    await store.put("signals", {
      ...scope,
      id: signalId,
      memberId: id,
      communityIds: input.permittedCommunityIds,
      kind,
      topic: kind,
      statement,
      evidenceClass: "explicit",
      visibility: "communities",
      status: "pending",
      validUntil: null,
    });
    await store.put("signal_evidence", {
      ...scope,
      id: crypto.randomUUID(),
      signalId,
      sourceId,
      authorMemberId: id,
      kind,
      summary: statement,
      excerpt: statement,
      sourceLabel: "Contributed statement",
      occurredAt: nowIso(),
      sourceUrl: null,
      evidenceClass: "explicit",
    });
  }
  await audit(
    store,
    { ...scope, id },
    "contribution.created",
    id,
    "member",
    "pending",
  );
  return { id, status: "pending" };
}

export async function audit(
  store: Store,
  actor: { id: string; workspaceId: string; dataMode: "sample" | "live" },
  action: string,
  objectId: string,
  objectType: string,
  status: string,
) {
  await store.put("audit_events", {
    id: crypto.randomUUID(),
    workspaceId: actor.workspaceId,
    dataMode: actor.dataMode,
    actorId: actor.id,
    action,
    objectId,
    objectType,
    status,
    occurredAt: nowIso(),
  });
}
