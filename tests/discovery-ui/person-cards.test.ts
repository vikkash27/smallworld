import { describe, it, expect } from 'vitest';
import discoverSample from '@/shared/fixtures/discover-response.sample.json';

describe('Person Cards Rendering', () => {
  it('should have at most 3 people in discover results', () => {
    const people = discoverSample.people;
    expect(people.length).toBeLessThanOrEqual(3);
  });

  it('should have exactly 3 people in the sample fixture', () => {
    expect(discoverSample.people.length).toBe(3);
  });

  it('should have unique member IDs', () => {
    const memberIds = discoverSample.people.map((p) => p.member.id);
    const uniqueIds = new Set(memberIds);
    expect(uniqueIds.size).toBe(memberIds.length);
  });

  it('should have non-empty reasons for each person', () => {
    discoverSample.people.forEach((person) => {
      expect(person.reason).toBeTruthy();
      expect(person.reason.length).toBeGreaterThan(0);
    });
  });

  it('should have at least one evidence item per person', () => {
    discoverSample.people.forEach((person) => {
      expect(person.evidence.length).toBeGreaterThan(0);
    });
  });

  it('should have valid fit types', () => {
    const validFitTypes = ['experience', 'complementary_need', 'collaborator', 'peer', 'speaker'];
    discoverSample.people.forEach((person) => {
      expect(validFitTypes).toContain(person.fitType);
    });
  });
});
