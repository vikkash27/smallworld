'use client';

import React from 'react';
import type { Community } from '@/shared/contracts';
import { Badge } from '@/ui/discovery/primitives';
import { ExternalLink } from 'lucide-react';

export interface CommunityCardProps {
  community: Community;
  onClick: () => void;
}

export function CommunityCard({ community, onClick }: CommunityCardProps) {
  const statusVariant = {
    listed: 'default' as const,
    participating: 'info' as const,
    connected: 'success' as const,
  };

  const statusLabel = {
    listed: 'Listed',
    participating: 'Participating',
    connected: 'Connected',
  };

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--tile)] p-5 transition-all hover:border-[var(--brand)] hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-lg font-semibold text-[var(--foreground)] group-hover:text-[var(--brand)] transition-colors">
          {community.name}
        </h3>
        <Badge variant={statusVariant[community.status]} className="shrink-0">
          {statusLabel[community.status]}
        </Badge>
      </div>

      {community.description && (
        <p className="text-sm text-[var(--secondary-text)] mb-3 line-clamp-2">
          {community.description}
        </p>
      )}

      {community.focusTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {community.focusTags.map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-md bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--secondary-text)]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <a
        href={community.publicUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-sm text-[var(--brand)] hover:underline"
      >
        <ExternalLink className="h-4 w-4" />
        View community
      </a>
    </div>
  );
}
