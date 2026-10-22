import { describe, it, expect } from 'vitest';
import discoverSample from '@/shared/fixtures/discover-response.sample.json';

describe('CTA Handoff', () => {
  it('should have a valid searchId for handoff', () => {
    expect(discoverSample.searchId).toBeTruthy();
    expect(typeof discoverSample.searchId).toBe('string');
  });

  it('should properly encode searchId for URL', () => {
    const searchId = discoverSample.searchId;
    const encoded = encodeURIComponent(searchId);
    expect(encoded).toBeTruthy();
    
    const url = `/circles/new?searchId=${encoded}`;
    expect(url).toContain('/circles/new?searchId=');
    expect(url).not.toContain(' ');
  });

  it('should create correct handoff URL format', () => {
    const searchId = 'demo-search-robotics';
    const encodedSearchId = encodeURIComponent(searchId);
    const expectedUrl = `/circles/new?searchId=${encodedSearchId}`;
    
    expect(expectedUrl).toBe('/circles/new?searchId=demo-search-robotics');
  });

  it('should handle special characters in searchId', () => {
    const specialSearchId = 'search with spaces & symbols!';
    const encoded = encodeURIComponent(specialSearchId);
    const url = `/circles/new?searchId=${encoded}`;
    
    expect(url).not.toContain(' ');
    expect(url).toContain('%20'); 
  });

  it('should have circle draft available when searchId is present', () => {
    if (discoverSample.searchId) {
      expect(discoverSample.circleDraft).toBeDefined();
    }
  });
});
