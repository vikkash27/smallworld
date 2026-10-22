'use client';

import React from 'react';
import type { PersonRecommendation } from '@/shared/contracts';
import { Badge } from '@/ui/discovery/primitives';
import { HelpCircle } from 'lucide-react';

export interface PersonCardProps {
  person: PersonRecommendation;
  onWhyClick: () => void;
  communities: { id: string; name: string }[];
}

export function PersonCard({ person, onWhyClick, communities }: PersonCardProps) {
  const communityNames = person.member.communityIds
    .map((id) => communities.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  const fitTypeLabels: Record<string, string> = {
    experience: 'Relevant experience',
    complementary_need: 'Complementary need',
    collaborator: 'Potential collaborator',
    peer: 'Peer',
    speaker: 'Speaker',
  };

  return (
    <div className="rounded-xl bg-[var(--tile)] p-6 border border-[var(--border)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white font-semibold">
            {person.member.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-2">
              <h3 className="text-xl font-semibold text-[var(--foreground)]">
                {person.member.displayName}
              </h3>
              <Badge variant="info" className="shrink-0">
                {fitTypeLabels[person.fitType] || person.fitType}
              </Badge>
            </div>
            {communityNames && (
              <p className="text-sm text-[var(--secondary-text)] mb-3">
                {communityNames}
              </p>
            )}
            <p className="text-base text-[var(--foreground)] leading-relaxed">
              {person.reason}
            </p>
          </div>
        </div>
        <button
          onClick={onWhyClick}
          className="shrink-0 flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[var(--brand)] hover:bg-[var(--background)] transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
          Why?
        </button>
      </div>
    </div>
  );
}
