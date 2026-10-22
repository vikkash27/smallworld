import type { BootstrapResponse, DiscoverResponse } from "@/shared/contracts";

// Copied from small-world-handoff/shared/*.sample.json. Sample data only; never used in live mode.

export const SAMPLE_BOOTSTRAP: BootstrapResponse = {
  "viewer": {
    "displayName": "Vikkash",
    "initials": "VS"
  },
  "dataMode": "sample",
  "allowedCommunityIds": [
    "unicorn-mafia",
    "kickstart-global"
  ],
  "communities": [
    {
      "id": "unicorn-mafia",
      "name": "Unicorn Mafia",
      "description": null,
      "focusTags": [],
      "publicUrl": "https://www.linkedin.com/company/unicorn-mafia/",
      "metadataSourceUrl": "https://gb-community-eng-hackathon-10-2026.teamdeel.workers.dev/hackathon",
      "metadataVerifiedAt": "2026-10-22T00:00:00Z",
      "status": "participating"
    },
    {
      "id": "basedcollective",
      "name": "basedcollective",
      "description": null,
      "focusTags": [],
      "publicUrl": "https://www.linkedin.com/company/basedcollectives/",
      "metadataSourceUrl": "https://gb-community-eng-hackathon-10-2026.teamdeel.workers.dev/hackathon",
      "metadataVerifiedAt": "2026-10-22T00:00:00Z",
      "status": "listed"
    },
    {
      "id": "kickstart-global",
      "name": "Kickstart Global",
      "description": null,
      "focusTags": [],
      "publicUrl": "https://www.linkedin.com/company/kickstartglobal/",
      "metadataSourceUrl": "https://gb-community-eng-hackathon-10-2026.teamdeel.workers.dev/hackathon",
      "metadataVerifiedAt": "2026-10-22T00:00:00Z",
      "status": "participating"
    },
    {
      "id": "hackradar",
      "name": "Hackradar",
      "description": null,
      "focusTags": [],
      "publicUrl": "https://discord.gg/3njqCYmTys",
      "metadataSourceUrl": "https://gb-community-eng-hackathon-10-2026.teamdeel.workers.dev/hackathon",
      "metadataVerifiedAt": "2026-10-22T00:00:00Z",
      "status": "listed"
    },
    {
      "id": "ai-agents-lab",
      "name": "AI Agents Lab",
      "description": null,
      "focusTags": [],
      "publicUrl": "https://www.linkedin.com/company/ukaiagentslab/",
      "metadataSourceUrl": "https://gb-community-eng-hackathon-10-2026.teamdeel.workers.dev/hackathon",
      "metadataVerifiedAt": "2026-10-22T00:00:00Z",
      "status": "listed"
    },
    {
      "id": "corgi-community",
      "name": "Corgi Community",
      "description": null,
      "focusTags": [],
      "publicUrl": "https://www.linkedin.com/company/usecorgi/",
      "metadataSourceUrl": "https://gb-community-eng-hackathon-10-2026.teamdeel.workers.dev/hackathon",
      "metadataVerifiedAt": "2026-10-22T00:00:00Z",
      "status": "listed"
    },
    {
      "id": "night-office",
      "name": "Night Office",
      "description": null,
      "focusTags": [],
      "publicUrl": "https://www.linkedin.com/company/nightoffice/",
      "metadataSourceUrl": "https://gb-community-eng-hackathon-10-2026.teamdeel.workers.dev/hackathon",
      "metadataVerifiedAt": "2026-10-22T00:00:00Z",
      "status": "listed"
    },
    {
      "id": "the-hack-collective",
      "name": "The Hack Collective",
      "description": null,
      "focusTags": [],
      "publicUrl": "https://www.linkedin.com/company/the-hack-collective/",
      "metadataSourceUrl": "https://gb-community-eng-hackathon-10-2026.teamdeel.workers.dev/hackathon",
      "metadataVerifiedAt": "2026-10-22T00:00:00Z",
      "status": "listed"
    },
    {
      "id": "united-italian-societies",
      "name": "United Italian Societies",
      "description": null,
      "focusTags": [],
      "publicUrl": "https://www.linkedin.com/company/united-italian-societies/",
      "metadataSourceUrl": "https://gb-community-eng-hackathon-10-2026.teamdeel.workers.dev/hackathon",
      "metadataVerifiedAt": "2026-10-22T00:00:00Z",
      "status": "listed"
    },
    {
      "id": "outpost",
      "name": "Outpost",
      "description": null,
      "focusTags": [],
      "publicUrl": "https://www.linkedin.com/company/outpost-crew/",
      "metadataSourceUrl": "https://gb-community-eng-hackathon-10-2026.teamdeel.workers.dev/hackathon",
      "metadataVerifiedAt": "2026-10-22T00:00:00Z",
      "status": "listed"
    },
    {
      "id": "ai-pilled",
      "name": "AI Pilled",
      "description": null,
      "focusTags": [],
      "publicUrl": "https://www.linkedin.com/company/ai-pilled/",
      "metadataSourceUrl": "https://gb-community-eng-hackathon-10-2026.teamdeel.workers.dev/hackathon",
      "metadataVerifiedAt": "2026-10-22T00:00:00Z",
      "status": "listed"
    },
    {
      "id": "imperial-entrepreneurs",
      "name": "Imperial Entrepreneurs",
      "description": null,
      "focusTags": [],
      "publicUrl": "https://www.linkedin.com/company/imperial-entrepreneurs/",
      "metadataSourceUrl": "https://gb-community-eng-hackathon-10-2026.teamdeel.workers.dev/hackathon",
      "metadataVerifiedAt": "2026-10-22T00:00:00Z",
      "status": "listed"
    }
  ]
};

export const SAMPLE_DISCOVER: DiscoverResponse = {
  "searchId": "demo-search-robotics",
  "dataMode": "sample",
  "retrievalBackend": "local",
  "status": "ready",
  "people": [
    {
      "member": {
        "id": "demo-amara",
        "displayName": "Amara Okafor",
        "initials": "AO",
        "communityIds": [
          "unicorn-mafia"
        ]
      },
      "fitType": "experience",
      "reason": "Spent two years deploying robots in fulfilment centres.",
      "evidence": [
        {
          "id": "demo-evidence-amara",
          "signalId": "demo-signal-amara",
          "kind": "stated_experience",
          "summary": "Spent two years deploying robots in fulfilment centres.",
          "excerpt": "I spent two years deploying robotics in fulfilment centres. Happy to share what we learned.",
          "sourceLabel": "Fictional contributed statement",
          "occurredAt": "2026-10-21T15:00:00Z",
          "sourceUrl": null,
          "evidenceClass": "explicit"
        }
      ],
      "caveats": [
        "Current availability needs confirmation."
      ],
      "availability": "unknown"
    },
    {
      "member": {
        "id": "demo-leo",
        "displayName": "Leo Martin",
        "initials": "LM",
        "communityIds": [
          "kickstart-global"
        ]
      },
      "fitType": "complementary_need",
      "reason": "Runs warehouse operations and is looking at picking automation.",
      "evidence": [
        {
          "id": "demo-evidence-leo",
          "signalId": "demo-signal-leo",
          "kind": "seeking",
          "summary": "Runs warehouse operations and is looking at picking automation.",
          "excerpt": "We are looking at automating picking in our warehouse. Keen to hear from people working on this.",
          "sourceLabel": "Fictional contributed statement",
          "occurredAt": "2026-10-21T15:00:00Z",
          "sourceUrl": null,
          "evidenceClass": "explicit"
        }
      ],
      "caveats": [
        "A relevant need, not a confirmed customer."
      ],
      "availability": "unknown"
    },
    {
      "member": {
        "id": "demo-nina",
        "displayName": "Nina Shah",
        "initials": "NS",
        "communityIds": [
          "kickstart-global"
        ]
      },
      "fitType": "collaborator",
      "reason": "Building a robotics simulator and seeking a deployment collaborator.",
      "evidence": [
        {
          "id": "demo-evidence-nina",
          "signalId": "demo-signal-nina",
          "kind": "seeking",
          "summary": "Building a robotics simulator and seeking a deployment collaborator.",
          "excerpt": "I am building a robotics simulator and looking for a deployment collaborator.",
          "sourceLabel": "Fictional contributed statement",
          "occurredAt": "2026-10-21T15:00:00Z",
          "sourceUrl": null,
          "evidenceClass": "explicit"
        }
      ],
      "caveats": [
        "Deployment experience is not established."
      ],
      "availability": "unknown"
    }
  ],
  "communities": [],
  "circleDraft": {
    "title": "Robotics Build Circle",
    "purpose": "Help each other validate and build practical warehouse robotics.",
    "activity": {
      "title": "Bring one deployment problem",
      "description": "A 30-minute session where each person brings one robotics deployment problem or prototype. Time to be agreed.",
      "proposedStartsAt": null,
      "timezone": "Europe/London",
      "location": null
    },
    "proposedMemberIds": [
      "demo-amara",
      "demo-leo",
      "demo-nina"
    ],
    "capacity": 6,
    "minimumMembers": 3
  },
  "message": null
};

export function buildEmptyDiscoverResponse(): DiscoverResponse {
  return {
    searchId: "demo-search-empty",
    dataMode: "sample",
    retrievalBackend: "local",
    status: "empty",
    people: [],
    communities: [],
    circleDraft: null,
    message: "No one matched this goal yet.",
  };
}
