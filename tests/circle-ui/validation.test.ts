import { describe, expect, it } from 'vitest';
import { SEARCH_PREVIEW_ROBOTICS as PREVIEW } from '../../src/ui/circles/fixtures';
import { clampMinimum, hasErrors, initialFormValues, toCreateRequest, validateCircleForm } from '../../src/ui/circles/validation';

const NOW = Date.parse('2026-10-22T20:00:00Z');
const base = () => initialFormValues(PREVIEW.discovery.circleDraft!, PREVIEW);

describe('circle form validation', () => {
  it('accepts the proposed draft as-is', () => {
    expect(hasErrors(validateCircleForm(base(), NOW))).toBe(false);
  });

  it('builds a request with a null time when none is proposed, never a made-up one', () => {
    const req = toCreateRequest('demo-search-robotics', base());
    expect(req.activity.proposedStartsAt).toBeNull();
    expect(req.activity.timezone).toBe('Europe/London');
    expect(req.selectedMemberIds).toEqual(['demo-amara', 'demo-leo', 'demo-nina']);
    expect(req.capacity).toBe(6);
    expect(req.minimumMembers).toBe(3);
  });

  it('blocks a minimum the guest list can never reach', () => {
    const v = { ...base(), selectedMemberIds: ['demo-amara'], minimumMembers: '3' };
    expect(validateCircleForm(v, NOW).minimumMembers).toMatch(/never become active/);
  });

  it('lowers the minimum automatically when people are removed', () => {
    expect(clampMinimum('3', 1)).toBe('2');
    expect(clampMinimum('3', 3)).toBe('3');
  });

  it('requires a seat for the host and every invitee', () => {
    expect(validateCircleForm({ ...base(), capacity: '3' }, NOW).capacity).toBeDefined();
  });

  it('requires between one and three invitees', () => {
    expect(validateCircleForm({ ...base(), selectedMemberIds: [] }, NOW).selectedMemberIds).toBeDefined();
  });

  it('rejects empty text and non-numeric numbers', () => {
    const e = validateCircleForm({ ...base(), title: '  ', capacity: 'six', minimumMembers: '' }, NOW);
    expect(e.title).toBeDefined();
    expect(e.capacity).toBeDefined();
    expect(e.minimumMembers).toBeDefined();
  });

  it('rejects a proposed time in the past but allows blank', () => {
    expect(validateCircleForm({ ...base(), startsAtLocal: '2026-10-01T10:00' }, NOW).startsAtLocal).toBeDefined();
    expect(validateCircleForm({ ...base(), startsAtLocal: '2026-10-29T18:00' }, NOW).startsAtLocal).toBeUndefined();
  });

  it('converts a proposed time to UTC across the clock change', () => {
    const req = toCreateRequest('s', { ...base(), startsAtLocal: '2026-10-29T18:00' });
    expect(req.activity.proposedStartsAt).toBe('2026-10-29T18:00:00Z');
  });
});
