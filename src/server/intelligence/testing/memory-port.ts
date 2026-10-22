import type {
  CandidateContext,
  Community,
  PlatformPort,
  SavedSearch,
  SaveSearchInput,
  Viewer,
} from "../../../shared/contracts";

/** In-memory port for domain tests. It can return records the matcher must still reject. */
export function createMemoryPlatformPort(seed: {
  candidates: CandidateContext[];
  communities: Community[];
}): PlatformPort & { saved: SavedSearch[] } {
  const saved: SavedSearch[] = [];
  return {
    saved,
    async getCandidateContexts(): Promise<CandidateContext[]> {
      return seed.candidates;
    },
    async getCommunities(): Promise<Community[]> {
      return seed.communities;
    },
    async saveSearch(viewer: Viewer, input: SaveSearchInput): Promise<SavedSearch> {
      const record: SavedSearch = {
        id: `search-${saved.length + 1}`,
        viewerId: viewer.id,
        workspaceId: viewer.workspaceId,
        expiresAt: "2026-10-23T19:00:00Z",
        goal: input.goal,
        communityIds: input.communityIds,
        result: input.result,
      };
      saved.push(record);
      return record;
    },
    async readSearch(_viewer: Viewer, searchId: string): Promise<SavedSearch | null> {
      return saved.find((item) => item.id === searchId) ?? null;
    },
  };
}
