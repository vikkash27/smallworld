'use client';

import React from 'react';
import type { Community } from '@/shared/contracts';
import { Modal } from '@/ui/discovery/primitives';
import { Badge } from '@/ui/discovery/primitives';
import { ExternalLink, Calendar } from 'lucide-react';

export interface DetailPanelProps {
  community: Community | null;
  onClose: () => void;
}

export function DetailPanel({ community, onClose }: DetailPanelProps) {
  if (!community) return null;

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

  const statusDescription = {
    listed: 'Public metadata only. No member context is shared.',
    participating: 'Contributed context is allowed for member discovery.',
    connected: 'Active integration with Small World.',
  };

  return (
    <Modal
      isOpen={!!community}
      onClose={onClose}
      title={community.name}
      size="md"
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-[var(--secondary-text)] mb-2">
            Status
          </h3>
          <div className="flex items-start gap-3">
            <Badge variant={statusVariant[community.status]}>
              {statusLabel[community.status]}
            </Badge>
            <p className="text-sm text-[var(--secondary-text)] flex-1">
              {statusDescription[community.status]}
            </p>
          </div>
        </div>

        {community.description && (
          <div>
            <h3 className="text-sm font-medium text-[var(--secondary-text)] mb-2">
              About
            </h3>
            <p className="text-base text-[var(--foreground)]">
              {community.description}
            </p>
          </div>
        )}

        {community.focusTags.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--secondary-text)] mb-2">
              Focus areas
            </h3>
            <div className="flex flex-wrap gap-2">
              {community.focusTags.map((tag) => (
                <Badge key={tag} variant="default">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-[var(--secondary-text)] mb-2">
            Links
          </h3>
          <div className="space-y-2">
            <a
              href={community.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[var(--brand)] hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Community website
            </a>
            <a
              href={community.metadataSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[var(--brand)] hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Metadata source
            </a>
          </div>
        </div>

        <div className="rounded-lg bg-[var(--tile)] p-4">
          <div className="flex items-center gap-2 text-xs text-[var(--secondary-text)]">
            <Calendar className="h-3 w-3" />
            <span>
              Verified on{' '}
              {new Date(community.metadataVerifiedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
