'use client';

import React from 'react';
import type { PersonRecommendation } from '@/shared/contracts';
import { Modal } from '@/ui/discovery/primitives';
import { Badge } from '@/ui/discovery/primitives';
import { Calendar, ExternalLink } from 'lucide-react';

export interface EvidenceDrawerProps {
  person: PersonRecommendation | null;
  onClose: () => void;
}

export function EvidenceDrawer({ person, onClose }: EvidenceDrawerProps) {
  if (!person) return null;

  const kindLabels: Record<string, string> = {
    stated_experience: 'Experience',
    seeking: 'Seeking',
    offering: 'Offering',
    building: 'Building',
    interest: 'Interest',
    availability: 'Availability',
  };

  const evidenceClassLabels: Record<string, string> = {
    explicit: 'Explicit',
    inferred: 'Inferred',
  };

  return (
    <Modal
      isOpen={!!person}
      onClose={onClose}
      title={person.member.displayName}
      size="md"
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-3">
            Evidence
          </h3>
          <div className="space-y-4">
            {person.evidence.map((evidence) => (
              <div
                key={evidence.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Badge variant="info">
                    {kindLabels[evidence.kind] || evidence.kind}
                  </Badge>
                  <Badge variant="default">
                    {evidenceClassLabels[evidence.evidenceClass] || evidence.evidenceClass}
                  </Badge>
                </div>
                <p className="text-base text-[var(--foreground)] mb-2">
                  {evidence.summary}
                </p>
                {evidence.excerpt && (
                  <blockquote className="border-l-4 border-[var(--brand)] bg-[var(--tile)] pl-4 py-2 italic text-sm text-[var(--secondary-text)] mb-2">
                    "{evidence.excerpt}"
                  </blockquote>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--secondary-text)] mt-3">
                  <span>{evidence.sourceLabel}</span>
                  {evidence.occurredAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(evidence.occurredAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                  {evidence.sourceUrl && (
                    <a
                      href={evidence.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[var(--brand)] hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Source
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {person.caveats.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-3">
              Caveats
            </h3>
            <ul className="list-disc list-inside space-y-1">
              {person.caveats.map((caveat, index) => (
                <li key={index} className="text-sm text-[var(--secondary-text)]">
                  {caveat}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Availability
          </h3>
          <p className="text-sm text-[var(--secondary-text)]">
            {person.availability === 'stated_available'
              ? 'Stated available'
              : 'Current availability needs confirmation'}
          </p>
        </div>
      </div>
    </Modal>
  );
}
