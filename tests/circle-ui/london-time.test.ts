import { describe, expect, it } from 'vitest';
import { describeTime, formatProposedTime, londonLocalToUtcIso, utcIsoToLondonLocal } from '../../src/ui/circles/london-time';

describe('describeTime', () => {
  it('shows an undecided time as undecided, never as a booking', () => {
    expect(describeTime({ proposedStartsAt: null, description: 'Bring a problem.' })).toBe('Time to be agreed');
  });
  it('does not repeat itself when the description already says so', () => {
    expect(describeTime({ proposedStartsAt: null, description: 'A session. Time to be agreed.' })).toBeNull();
  });
  it('labels a set time as proposed', () => {
    expect(describeTime({ proposedStartsAt: '2026-10-29T18:00:00Z', description: 'x' })).toMatch(/^Proposed: .*18:00 GMT/);
  });
});

describe('London time handling around the 25 Oct 2026 clock change', () => {
  it('uses BST (UTC+1) before the change', () => {
    expect(londonLocalToUtcIso('2026-10-24T12:00')).toBe('2026-10-24T11:00:00Z');
  });

  it('uses GMT (UTC+0) after the change', () => {
    expect(londonLocalToUtcIso('2026-10-26T12:00')).toBe('2026-10-26T12:00:00Z');
  });

  it('round-trips both sides of the change', () => {
    for (const local of ['2026-10-24T18:30', '2026-10-26T18:30', '2026-12-01T09:15', '2027-07-01T09:15']) {
      const iso = londonLocalToUtcIso(local)!;
      expect(utcIsoToLondonLocal(iso)).toBe(local);
    }
  });

  it('rejects a wall time that does not exist (spring clock change)', () => {
    expect(londonLocalToUtcIso('2027-03-28T01:30')).toBeNull();
  });

  it('rejects malformed and impossible dates', () => {
    expect(londonLocalToUtcIso('')).toBeNull();
    expect(londonLocalToUtcIso('2026-02-30T10:00')).toBeNull();
    expect(londonLocalToUtcIso('tomorrow')).toBeNull();
  });

  it('labels the zone when formatting', () => {
    expect(formatProposedTime('2026-10-24T17:30:00Z')).toMatch(/18:30.*BST/);
    expect(formatProposedTime('2026-10-26T18:30:00Z')).toMatch(/18:30.*GMT/);
    expect(formatProposedTime('garbage')).toBe('Time to be agreed');
  });
});
