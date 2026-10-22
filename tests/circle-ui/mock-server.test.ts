import { describe, expect, it } from 'vitest';
import type { CreateCircleRequest } from '../../src/shared/contracts';
import { SEARCH_PREVIEW_ROBOTICS as PREVIEW } from '../../src/ui/circles/fixtures';
import * as srv from '../../src/ui/circles/mock-server';
import { ApiError } from '../../src/ui/circles/errors';

const NOW = Date.parse('2026-10-22T20:00:00Z');
const draft = PREVIEW.discovery.circleDraft!;
const baseReq = (over: Partial<CreateCircleRequest> = {}): CreateCircleRequest => ({
  searchId: PREVIEW.discovery.searchId,
  selectedMemberIds: draft.proposedMemberIds,
  title: draft.title,
  purpose: draft.purpose,
  activity: draft.activity,
  capacity: 6,
  minimumMembers: 3,
  ...over,
});

function setup(over: Partial<CreateCircleRequest> = {}) {
  const state = srv.emptyState();
  let n = 0;
  const res = srv.createCircle(state, baseReq(over), PREVIEW, NOW, () => `tok-${++n}`, 'https://x.test');
  const tokens = res.invitationLinks.map((l) => l.url.split('/').pop()!);
  return { state, res, tokens, id: res.circle.id };
}
const join = (st: srv.MockState, t: string, showOnRoster = false) => srv.respond(st, t, { decision: 'join', showOnRoster }, NOW);
const code = (fn: () => unknown) => {
  try { fn(); } catch (e) { return (e as ApiError).code; }
  return null;
};

describe('circle lifecycle (mirrors the PRD rules)', () => {
  it('starts forming with the host as member one and invitations pending', () => {
    const { res } = setup();
    expect(res.circle.status).toBe('forming');
    expect(res.circle.acceptedCount).toBe(1);
    expect(res.circle.roster).toHaveLength(1);
    expect(res.circle.roster[0].role).toBe('host');
    expect(res.circle.invitations.every((i) => i.status === 'pending')).toBe(true);
    expect(res.invitationLinks).toHaveLength(3);
  });

  it('counts only accepted invitations, never pending ones', () => {
    const { state, tokens, id } = setup();
    join(state, tokens[0]);
    const c = srv.getCircle(state, id, NOW);
    expect(c.acceptedCount).toBe(2);
    expect(c.invitations.filter((i) => i.status === 'pending')).toHaveLength(2);
  });

  it('goes active only when the activity is confirmed AND the minimum has joined', () => {
    const { state, tokens, id } = setup();
    join(state, tokens[0]);
    join(state, tokens[1]); // host + 2 = minimum met, activity not confirmed
    expect(srv.getCircle(state, id, NOW).status).toBe('forming');
    const confirmed = srv.updateActivity(state, id, draft.activity, true, NOW);
    expect(confirmed.status).toBe('active');
  });

  it('stays forming when the activity is confirmed before enough people join', () => {
    const { state, tokens, id } = setup();
    expect(srv.updateActivity(state, id, draft.activity, true, NOW).status).toBe('forming');
    join(state, tokens[0]);
    expect(srv.getCircle(state, id, NOW).status).toBe('forming');
    expect(join(state, tokens[1]).circleStatus).toBe('active');
  });

  it('is idempotent: a duplicate join does not inflate the count', () => {
    const { state, tokens } = setup();
    const first = join(state, tokens[0]);
    const again = join(state, tokens[0]);
    expect(again).toEqual(first);
    expect(again.acceptedCount).toBe(2);
  });

  it('resolves a join/decline race once: the first answer stands', () => {
    const { state, tokens } = setup();
    join(state, tokens[0]);
    const late = srv.respond(state, tokens[0], { decision: 'decline', showOnRoster: false }, NOW);
    expect(late.invitationStatus).toBe('accepted');
    expect(late.acceptedCount).toBe(2);
  });

  it('refuses the join that would exceed capacity (last seat)', () => {
    const { state, tokens } = setup({ capacity: 3 });
    join(state, tokens[0]);
    join(state, tokens[1]); // host + 2 = capacity
    expect(code(() => join(state, tokens[2]))).toBe('CONFLICT');
  });

  it('GET never changes membership', () => {
    const { state, tokens, id } = setup();
    srv.getInvitation(state, tokens[0], NOW);
    srv.getInvitation(state, tokens[0], NOW);
    expect(srv.getCircle(state, id, NOW).acceptedCount).toBe(1);
  });

  it('rejects an expired invitation with EXPIRED', () => {
    const { state, tokens } = setup();
    const later = NOW + srv.INVITE_TTL_MS + 1000;
    expect(code(() => srv.getInvitation(state, tokens[0], later))).toBe('EXPIRED');
    expect(code(() => srv.respond(state, tokens[0], { decision: 'join', showOnRoster: false }, later))).toBe('EXPIRED');
  });

  it('returns NOT_FOUND for an unknown token', () => {
    expect(code(() => srv.getInvitation(srv.emptyState(), 'nope', NOW))).toBe('NOT_FOUND');
  });

  it('keeps other invitees and evidence out of the recipient view', () => {
    const { state, tokens } = setup();
    const json = JSON.stringify(srv.getInvitation(state, tokens[0], NOW));
    for (const name of ['Amara', 'Leo', 'Nina', 'evidence', 'excerpt']) expect(json).not.toContain(name);
  });

  it('hides names on the roster unless the member consented', () => {
    const { state, tokens, id } = setup();
    join(state, tokens[0], false);
    join(state, tokens[1], true);
    const [, hidden, shown] = srv.getCircle(state, id, NOW).roster;
    expect(hidden.displayName).toBeNull();
    expect(shown.displayName).toBe('Leo Martin');
  });

  it('rejects people who are not in the saved search', () => {
    const state = srv.emptyState();
    const create = () => srv.createCircle(state, baseReq({ selectedMemberIds: ['demo-amara', 'stranger'] }), PREVIEW, NOW, () => 't', 'https://x.test');
    expect(code(create)).toBe('BAD_INPUT');
  });

  it('rejects a minimum that the guest list can never reach', () => {
    const state = srv.emptyState();
    const create = () => srv.createCircle(state, baseReq({ selectedMemberIds: ['demo-amara'], minimumMembers: 3 }), PREVIEW, NOW, () => 't', 'https://x.test');
    expect(code(create)).toBe('BAD_INPUT');
  });
});
