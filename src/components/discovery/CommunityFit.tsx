import React from 'react';
import type { CommunityFit as CommunityFitType } from '@/shared/contracts';
import { ExternalLink } from 'lucide-react';

export interface CommunityFitProps {
  communityFit: CommunityFitType;
  communityName: string;
}

export function CommunityFit({ communityFit, communityName }: CommunityFitProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--tile)] p-6">
      <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
        Relevant community
      </h3>
      <p className="text-lg font-medium text-[var(--foreground)] mb-2">
        {communityName}
      </p>
      <p className="text-base text-[var(--secondary-text)] mb-3">
        {communityFit.reason}
      </p>
      {communityFit.sourceUrl && (
        <a
          href={communityFit.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-[var(--brand)] hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          View source
        </a>
      )}
    </div>
  );
}
