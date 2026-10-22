import type {
  Activity,
  CircleDetail,
  CircleStatus,
  CircleSummary,
  CreateCircleRequest,
  CreateCircleResponse,
  Id,
  InvitationResponse,
  InvitationResponseRequest,
  InvitationStatus,
  InvitationView,
  ISODate,
  MemberSummary,
  RosterMember,
  SearchPreviewResponse,
} from '../../shared/contracts';
import { ApiError } from './errors';

/**
 * In-memory model of the rules C's platform must enforce, so the UI is built and tested against realistic
 * behaviour: host is member one, pending invitations never count, joins are idempotent and capacity-checked,
 * GET never mutates, and "active" needs a confirmed activity AND the minimum number of accepted members.
 * State is plain JSON so it can be persisted by mock-store.
 */

export const MOCK_HOST: MemberSummary = {
  id: 'demo-host',
  displayName: 'Vikkash',
  initials: 'VS',
  communityIds: ['unicorn-mafia', 'kickstart-global'],
};

export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

interface MockInvitation {
  id: Id;
  member: MemberSummary;
  token: string;
  status: InvitationStatus;
  expiresAt: ISODate;
  showOnRoster: boolean;
}

interface MockCircle {
  id: Id;
  title: string;
  purpose: string;
  capacity: number;
  minimumMembers: number;
  activity: Activity;
  activityConfirmed: boolean;
  status: CircleStatus;
  communityIds: Id[];
  invitations: MockInvitation[];
}

export interface MockState {
  seq: number;
  circles: MockCircle[];
}

export const emptyState = (): MockState => ({ seq: 0, circles: [] });

const fail = (code: ApiError['code'], message: string, status: number): never => {
  throw new ApiError(code, message, { status });
};

const acceptedCount = (c: MockCircle) => 1 + c.invitations.filter((i) => i.status === 'accepted').length;

function expireStale(c: MockCircle, now: number) {
  for (const i of c.invitations) {
    if (i.status === 'pending' && Date.parse(i.expiresAt) <= now) i.status = 'expired';
  }
}

function maybeActivate(c: MockCircle) {
  if (c.status === 'forming' && c.activityConfirmed && acceptedCount(c) >= c.minimumMembers) c.status = 'active';
}

function summary(c: MockCircle): CircleSummary {
  return {
    id: c.id,
    title: c.title,
    purpose: c.purpose,
    status: c.status,
    capacity: c.capacity,
    minimumMembers: c.minimumMembers,
    acceptedCount: acceptedCount(c),
    activity: { ...c.activity },
    activityConfirmed: c.activityConfirmed,
  };
}

function detail(c: MockCircle): CircleDetail {
  const roster: RosterMember[] = [
    { id: MOCK_HOST.id, displayName: MOCK_HOST.displayName, initials: MOCK_HOST.initials, role: 'host', showOnRoster: true },
    ...c.invitations
      .filter((i) => i.status === 'accepted')
      .map((i): RosterMember => ({
        id: i.member.id,
        displayName: i.showOnRoster ? i.member.displayName : null,
        initials: i.showOnRoster ? i.member.initials : null,
        role: 'member',
        showOnRoster: i.showOnRoster,
      })),
  ];
  return {
    ...summary(c),
    host: MOCK_HOST,
    communityIds: [...c.communityIds],
    roster,
    invitations: c.invitations.map((i) => ({ id: i.id, member: i.member, status: i.status, expiresAt: i.expiresAt })),
  };
}

function findByToken(state: MockState, token: string): { circle: MockCircle; invitation: MockInvitation } {
  for (const circle of state.circles) {
    const invitation = circle.invitations.find((i) => i.token === token);
    if (invitation) return { circle, invitation };
  }
  return fail('NOT_FOUND', 'Invitation not found', 404);
}

function findCircle(state: MockState, id: Id): MockCircle {
  return state.circles.find((c) => c.id === id) ?? fail('NOT_FOUND', 'Circle not found', 404);
}

export function createCircle(
  state: MockState,
  req: CreateCircleRequest,
  preview: SearchPreviewResponse,
  now: number,
  newToken: () => string,
  origin: string,
): CreateCircleResponse {
  if (req.searchId !== preview.discovery.searchId) fail('BAD_INPUT', 'Search does not match', 400);
  const byId = new Map(preview.discovery.people.map((p) => [p.member.id, p.member]));
  const ids = [...new Set(req.selectedMemberIds)];
  if (ids.length < 1 || ids.length > 3) fail('BAD_INPUT', 'Choose between one and three people', 400);
  // Only candidates from the saved search may be invited: arbitrary IDs are rejected.
  if (ids.some((id) => !byId.has(id))) fail('BAD_INPUT', 'Selected people are not part of this search', 400);
  if (!req.title.trim() || !req.purpose.trim() || !req.activity.title.trim()) fail('BAD_INPUT', 'Title, purpose and activity are required', 400);
  if (req.minimumMembers < 2 || req.minimumMembers > ids.length + 1) fail('BAD_INPUT', 'Minimum members cannot be reached with this guest list', 400);
  // The spec only bounds capacity below by the minimum; inviting more people than seats is allowed and first come, first served.
  if (req.capacity < req.minimumMembers) fail('BAD_INPUT', 'Capacity is too small', 400);

  state.seq += 1;
  const members = ids.map((id) => byId.get(id) as MemberSummary);
  const circle: MockCircle = {
    id: `mock-circle-${state.seq}`,
    title: req.title.trim(),
    purpose: req.purpose.trim(),
    capacity: req.capacity,
    minimumMembers: req.minimumMembers,
    activity: { ...req.activity },
    activityConfirmed: false,
    status: 'forming',
    communityIds: [...new Set(members.flatMap((m) => m.communityIds))],
    invitations: members.map((member, idx) => ({
      id: `mock-invite-${state.seq}-${idx + 1}`,
      member,
      token: newToken(),
      status: 'pending',
      expiresAt: new Date(now + INVITE_TTL_MS).toISOString(),
      showOnRoster: false,
    })),
  };
  state.circles.unshift(circle);
  return {
    circle: detail(circle),
    invitationLinks: circle.invitations.map((i) => ({ invitationId: i.id, memberId: i.member.id, url: `${origin}/invite/${i.token}` })),
  };
}

export function listCircles(state: MockState, now: number): CircleSummary[] {
  state.circles.forEach((c) => expireStale(c, now));
  return state.circles.map(summary);
}

export function getCircle(state: MockState, id: Id, now: number): CircleDetail {
  const c = findCircle(state, id);
  expireStale(c, now);
  return detail(c);
}

export function updateActivity(state: MockState, id: Id, activity: Activity, confirmed: boolean, now: number): CircleDetail {
  const c = findCircle(state, id);
  expireStale(c, now);
  if (c.status === 'archived') fail('CONFLICT', 'This circle is archived', 409);
  if (!activity.title.trim()) fail('BAD_INPUT', 'Activity title is required', 400);
  c.activity = { ...activity };
  c.activityConfirmed = confirmed;
  maybeActivate(c);
  return detail(c);
}

/** Read-only: viewing an invitation never changes membership (link unfurlers fetch GET URLs). */
export function getInvitation(state: MockState, token: string, now: number): InvitationView {
  const { circle, invitation } = findByToken(state, token);
  expireStale(circle, now);
  if (invitation.status === 'expired' || invitation.status === 'revoked') {
    fail('EXPIRED', 'This invitation has expired or was withdrawn', 410);
  }
  return {
    dataMode: 'sample',
    circle: summary(circle),
    hostDisplayName: MOCK_HOST.displayName,
    invitationStatus: invitation.status,
    expiresAt: invitation.expiresAt,
  };
}

export function respond(state: MockState, token: string, req: InvitationResponseRequest, now: number): InvitationResponse {
  const { circle, invitation } = findByToken(state, token);
  expireStale(circle, now);
  const result = (): InvitationResponse => ({
    invitationStatus: invitation.status as 'accepted' | 'declined',
    circleId: circle.id,
    acceptedCount: acceptedCount(circle),
    circleStatus: circle.status,
  });

  if (invitation.status === 'expired' || invitation.status === 'revoked') {
    fail('EXPIRED', 'This invitation has expired or was withdrawn', 410);
  }
  // Duplicate or racing responses resolve once: the original outcome is returned unchanged.
  if (invitation.status === 'accepted' || invitation.status === 'declined') return result();

  if (req.decision === 'decline') {
    invitation.status = 'declined';
    return result();
  }
  if (circle.status === 'archived') fail('CONFLICT', 'This circle is no longer open', 409);
  if (acceptedCount(circle) >= circle.capacity) fail('CONFLICT', 'This circle is full', 409);
  invitation.status = 'accepted';
  invitation.showOnRoster = req.showOnRoster;
  maybeActivate(circle);
  return result();
}
