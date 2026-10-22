import { describe, it, expect } from 'vitest';
import discoverSample from '@/shared/fixtures/discover-response.sample.json';
import bootstrapSample from '@/shared/fixtures/bootstrap.sample.json';
import communitiesSample from '@/shared/fixtures/communities.sample.json';
import searchPreviewSample from '@/shared/fixtures/search-preview.sample.json';

describe('Fixture Parsing', () => {
  it('should parse discover-response sample correctly', () => {
    expect(discoverSample).toBeDefined();
    expect(discoverSample.searchId).toBe('demo-search-robotics');
    expect(discoverSample.dataMode).toBe('sample');
    expect(discoverSample.retrievalBackend).toBe('local');
    expect(discoverSample.status).toBe('ready');
    expect(Array.isArray(discoverSample.people)).toBe(true);
    expect(Array.isArray(discoverSample.communities)).toBe(true);
  });

  it('should have valid person recommendations in discover sample', () => {
    expect(discoverSample.people.length).toBeGreaterThan(0);
    discoverSample.people.forEach((person) => {
      expect(person.member).toBeDefined();
      expect(person.member.id).toBeTruthy();
      expect(person.member.displayName).toBeTruthy();
      expect(person.member.initials).toBeTruthy();
      expect(person.fitType).toBeTruthy();
      expect(person.reason).toBeTruthy();
      expect(Array.isArray(person.evidence)).toBe(true);
      expect(Array.isArray(person.caveats)).toBe(true);
    });
  });

  it('should have valid circle draft in discover sample', () => {
    expect(discoverSample.circleDraft).toBeDefined();
    expect(discoverSample.circleDraft!.title).toBeTruthy();
    expect(discoverSample.circleDraft!.purpose).toBeTruthy();
    expect(discoverSample.circleDraft!.activity).toBeDefined();
    expect(Array.isArray(discoverSample.circleDraft!.proposedMemberIds)).toBe(true);
  });

  it('should parse bootstrap sample correctly', () => {
    expect(bootstrapSample).toBeDefined();
    expect(bootstrapSample.viewer).toBeDefined();
    expect(bootstrapSample.dataMode).toBe('sample');
    expect(Array.isArray(bootstrapSample.communities)).toBe(true);
  });

  it('should have exactly 12 communities in bootstrap sample', () => {
    expect(bootstrapSample.communities.length).toBe(12);
  });

  it('should parse communities sample correctly', () => {
    expect(communitiesSample).toBeDefined();
    expect(Array.isArray(communitiesSample)).toBe(true);
    expect(communitiesSample.length).toBe(12);
  });

  it('should have valid community data', () => {
    communitiesSample.forEach((community) => {
      expect(community.id).toBeTruthy();
      expect(community.name).toBeTruthy();
      expect(community.publicUrl).toBeTruthy();
      expect(['listed', 'participating', 'connected']).toContain(community.status);
      expect(community.metadataVerifiedAt).toBeTruthy();
    });
  });

  it('should parse search preview sample correctly', () => {
    expect(searchPreviewSample).toBeDefined();
    expect(searchPreviewSample.goal).toBeTruthy();
    expect(searchPreviewSample.discovery).toBeDefined();
  });
});
