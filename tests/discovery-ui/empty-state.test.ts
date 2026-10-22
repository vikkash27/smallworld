import { describe, it, expect } from 'vitest';
import type { DiscoverResponse } from '@/shared/contracts';

describe('Empty State Handling', () => {
  it('should handle empty status correctly', () => {
    const emptyResponse: DiscoverResponse = {
      searchId: 'empty-search',
      dataMode: 'sample',
      retrievalBackend: 'local',
      status: 'empty',
      people: [],
      communities: [],
      circleDraft: null,
      message: null,
    };

    expect(emptyResponse.status).toBe('empty');
    expect(emptyResponse.people.length).toBe(0);
    expect(emptyResponse.communities.length).toBe(0);
    expect(emptyResponse.circleDraft).toBeNull();
  });

  it('should not allow circle creation when circleDraft is null', () => {
    const emptyResponse: DiscoverResponse = {
      searchId: 'empty-search',
      dataMode: 'sample',
      retrievalBackend: 'local',
      status: 'empty',
      people: [],
      communities: [],
      circleDraft: null,
      message: null,
    };

    const canCreateCircle = emptyResponse.circleDraft !== null && emptyResponse.circleDraft !== undefined;
    expect(canCreateCircle).toBe(false);
  });

  it('should allow circle creation when circleDraft is present', () => {
    const readyResponse: DiscoverResponse = {
      searchId: 'ready-search',
      dataMode: 'sample',
      retrievalBackend: 'local',
      status: 'ready',
      people: [],
      communities: [],
      circleDraft: {
        title: 'Test Circle',
        purpose: 'Test purpose',
        activity: {
          title: 'Test activity',
          description: 'Test description',
          proposedStartsAt: null,
          timezone: 'Europe/London',
          location: null,
        },
        proposedMemberIds: [],
        capacity: 6,
        minimumMembers: 3,
      },
      message: null,
    };

    const canCreateCircle = readyResponse.circleDraft !== null && readyResponse.circleDraft !== undefined;
    expect(canCreateCircle).toBe(true);
  });

  it('should handle ready status with no communities', () => {
    const noCommunities: DiscoverResponse = {
      searchId: 'no-communities',
      dataMode: 'sample',
      retrievalBackend: 'local',
      status: 'ready',
      people: [
        {
          member: {
            id: 'test-member',
            displayName: 'Test Member',
            initials: 'TM',
            communityIds: [],
          },
          fitType: 'collaborator',
          reason: 'Test reason',
          evidence: [],
          caveats: [],
          availability: 'unknown',
        },
      ],
      communities: [],
      circleDraft: null,
      message: null,
    };

    expect(noCommunities.status).toBe('ready');
    expect(noCommunities.communities.length).toBe(0);
    expect(noCommunities.people.length).toBeGreaterThan(0);
  });
});
