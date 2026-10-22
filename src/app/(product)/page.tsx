'use client';

import React, { useState } from 'react';
import type { DiscoverResponse, Community } from '@/shared/contracts';
import { GoalInput } from '@/components/discovery/GoalInput';
import { PersonCard } from '@/components/discovery/PersonCard';
import { EvidenceDrawer } from '@/components/discovery/EvidenceDrawer';
import { CommunityFit } from '@/components/discovery/CommunityFit';
import { EmptyState } from '@/components/discovery/EmptyState';
import { StatusLabel } from '@/ui/discovery/StatusLabel';
import { Button } from '@/ui/discovery/primitives';
import { discoverPeople } from '@/ui/discovery/discover';
import { getBootstrap } from '@/ui/discovery/platform';
import { Users } from 'lucide-react';

export default function DiscoverPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoverResponse | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState('');

  React.useEffect(() => {
    getBootstrap()
      .then((bootstrap) => {
        setCommunities(bootstrap.communities);
      })
      .catch((err) => {
        console.error('Failed to load bootstrap:', err);
      });
  }, []);

  const handleSearch = async (searchGoal: string) => {
    setIsLoading(true);
    setError(null);
    setGoal(searchGoal);

    try {
      const result = await discoverPeople(searchGoal, communities.map((c) => c.id));
      setDiscovery(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search');
      setDiscovery(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBringTogether = () => {
    if (discovery?.searchId) {
      const encodedSearchId = encodeURIComponent(discovery.searchId);
      window.location.href = `/circles/new?searchId=${encodedSearchId}`;
    }
  };

  const canCreateCircle = discovery?.circleDraft !== null && discovery?.circleDraft !== undefined;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-8">
          <GoalInput onSearch={handleSearch} isLoading={isLoading} defaultValue={goal} />
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!discovery && !isLoading && !error && <EmptyState />}

        {discovery && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                {discovery.status === 'empty' ? 'No matches found' : 'Relevant people'}
              </h2>
              <StatusLabel
                dataMode={discovery.dataMode}
                retrievalBackend={discovery.retrievalBackend}
              />
            </div>

            {discovery.status === 'empty' && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--tile)] p-8 text-center">
                <p className="text-lg text-[var(--secondary-text)]">
                  No relevant people found for this goal. Try a different search or explore existing communities.
                </p>
              </div>
            )}

            {discovery.status === 'ready' && (
              <>
                <div className="space-y-4">
                  {discovery.people.slice(0, 3).map((person, index) => (
                    <PersonCard
                      key={person.member.id}
                      person={person}
                      communities={communities}
                      onWhyClick={() => setSelectedPerson(index)}
                    />
                  ))}
                </div>

                {discovery.communities.length > 0 && (
                  <div>
                    {discovery.communities.map((fit) => {
                      const community = communities.find((c) => c.id === fit.communityId);
                      return (
                        <CommunityFit
                          key={fit.communityId}
                          communityFit={fit}
                          communityName={community?.name || fit.communityId}
                        />
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--tile)] p-8">
                  <Button
                    onClick={handleBringTogether}
                    disabled={!canCreateCircle}
                    className="text-lg px-8 py-4"
                  >
                    <Users className="mr-2 h-5 w-5" />
                    Bring us together
                  </Button>
                  {!canCreateCircle && (
                    <p className="text-sm text-[var(--secondary-text)] text-center max-w-md">
                      No circle proposal available. This typically means there isn't enough shared context or complementary needs to form a purposeful group.
                    </p>
                  )}
                </div>
              </>
            )}

            {discovery.message && (
              <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 text-blue-700">
                <p className="text-sm">{discovery.message}</p>
              </div>
            )}
          </div>
        )}

        <EvidenceDrawer
          person={selectedPerson !== null && discovery ? discovery.people[selectedPerson] : null}
          onClose={() => setSelectedPerson(null)}
        />
      </div>
    </div>
  );
}
