'use client';

import React, { useState, useEffect } from 'react';
import type { Community } from '@/shared/contracts';
import { SearchBar } from '@/components/communities/SearchBar';
import { CommunityCard } from '@/components/communities/CommunityCard';
import { DetailPanel } from '@/components/communities/DetailPanel';
import { getCommunities } from '@/ui/discovery/platform';

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCommunities()
      .then((data) => {
        setCommunities(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load communities');
        setIsLoading(false);
      });
  }, []);

  const filteredCommunities = communities.filter((community) => {
    const query = searchQuery.toLowerCase();
    const nameMatch = community.name.toLowerCase().includes(query);
    const descriptionMatch = community.description?.toLowerCase().includes(query);
    const tagsMatch = community.focusTags.some((tag) => tag.toLowerCase().includes(query));
    return nameMatch || descriptionMatch || tagsMatch;
  });

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--foreground)] mb-4">
            Find your community
          </h1>
          <p className="text-lg text-[var(--secondary-text)] mb-6">
            Start with a community that already exists.
          </p>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search communities by name or focus..."
          />
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-lg text-[var(--secondary-text)]">Loading communities...</div>
          </div>
        ) : filteredCommunities.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--tile)] p-8 text-center">
            <p className="text-lg text-[var(--secondary-text)]">
              {searchQuery ? 'No communities found matching your search.' : 'No communities available.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCommunities.map((community) => (
              <CommunityCard
                key={community.id}
                community={community}
                onClick={() => setSelectedCommunity(community)}
              />
            ))}
          </div>
        )}

        <DetailPanel
          community={selectedCommunity}
          onClose={() => setSelectedCommunity(null)}
        />
      </div>
    </div>
  );
}
