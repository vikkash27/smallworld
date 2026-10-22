import type { SearchPreviewResponse } from '../../shared/contracts';

/** Copied from shared/search-preview.sample.json. All people and statements are fictional. */
export const SEARCH_PREVIEW_ROBOTICS: SearchPreviewResponse = {
  goal: 'I want to build warehouse robotics with people in London.',
  discovery: {
    searchId: 'demo-search-robotics',
    dataMode: 'sample',
    retrievalBackend: 'local',
    status: 'ready',
    people: [
      {
        member: { id: 'demo-amara', displayName: 'Amara Okafor', initials: 'AO', communityIds: ['unicorn-mafia'] },
        fitType: 'experience',
        reason: 'Spent two years deploying robots in fulfilment centres.',
        evidence: [
          {
            id: 'demo-evidence-amara',
            signalId: 'demo-signal-amara',
            kind: 'stated_experience',
            summary: 'Spent two years deploying robots in fulfilment centres.',
            excerpt: 'I spent two years deploying robotics in fulfilment centres. Happy to share what we learned.',
            sourceLabel: 'Fictional contributed statement',
            occurredAt: '2026-10-21T15:00:00Z',
            sourceUrl: null,
            evidenceClass: 'explicit',
          },
        ],
        caveats: ['Current availability needs confirmation.'],
        availability: 'unknown',
      },
      {
        member: { id: 'demo-leo', displayName: 'Leo Martin', initials: 'LM', communityIds: ['kickstart-global'] },
        fitType: 'complementary_need',
        reason: 'Runs warehouse operations and is looking at picking automation.',
        evidence: [
          {
            id: 'demo-evidence-leo',
            signalId: 'demo-signal-leo',
            kind: 'seeking',
            summary: 'Runs warehouse operations and is looking at picking automation.',
            excerpt: 'We are looking at automating picking in our warehouse. Keen to hear from people working on this.',
            sourceLabel: 'Fictional contributed statement',
            occurredAt: '2026-10-21T15:00:00Z',
            sourceUrl: null,
            evidenceClass: 'explicit',
          },
        ],
        caveats: ['A relevant need, not a confirmed customer.'],
        availability: 'unknown',
      },
      {
        member: { id: 'demo-nina', displayName: 'Nina Shah', initials: 'NS', communityIds: ['kickstart-global'] },
        fitType: 'collaborator',
        reason: 'Building a robotics simulator and seeking a deployment collaborator.',
        evidence: [
          {
            id: 'demo-evidence-nina',
            signalId: 'demo-signal-nina',
            kind: 'seeking',
            summary: 'Building a robotics simulator and seeking a deployment collaborator.',
            excerpt: 'I am building a robotics simulator and looking for a deployment collaborator.',
            sourceLabel: 'Fictional contributed statement',
            occurredAt: '2026-10-21T15:00:00Z',
            sourceUrl: null,
            evidenceClass: 'explicit',
          },
        ],
        caveats: ['Deployment experience is not established.'],
        availability: 'unknown',
      },
    ],
    communities: [],
    circleDraft: {
      title: 'Robotics Build Circle',
      purpose: 'Help each other validate and build practical warehouse robotics.',
      activity: {
        title: 'Bring one deployment problem',
        description:
          'A 30-minute session where each person brings one robotics deployment problem or prototype. Time to be agreed.',
        proposedStartsAt: null,
        timezone: 'Europe/London',
        location: null,
      },
      proposedMemberIds: ['demo-amara', 'demo-leo', 'demo-nina'],
      capacity: 6,
      minimumMembers: 3,
    },
    message: null,
  },
};

export const SEARCH_PREVIEW_EMPTY: SearchPreviewResponse = {
  goal: 'Something nobody has mentioned yet.',
  discovery: {
    searchId: 'demo-search-empty',
    dataMode: 'sample',
    retrievalBackend: 'local',
    status: 'empty',
    people: [],
    communities: [],
    circleDraft: null,
    message: 'No one in the connected communities has described something relevant yet.',
  },
};
