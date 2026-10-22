import { describe, expect, it } from "vitest";
import type { CandidateContext, Community, Evidence, SignalKind } from "../../src/shared/contracts";
import {
  ROBOTICS_GOAL,
  amara,
  documentedWarehouseCommunity,
  eventShare,
  injectionOnly,
  leo,
  nameOnlyRoboticsClub,
  nina,
  privateOtherCommunity,
  roboticsCandidates,
  samA,
  samB,
  sampleViewer,
  secondDocumentedCommunity,
  staleAvailability,
  unavailableRobotics,
  unrelatedCommunity,
} from "../../src/server/intelligence/fixtures";
import { MAX_RETRIEVAL, matchBaseline, type MatchQuery } from "../../src/server/intelligence/match/baseline";

const at = "2026-10-21T15:00:00Z";
const scope = ["unicorn-mafia", "kickstart-global"];

const allPeople: CandidateContext[] = [
  ...roboticsCandidates,
  samA,
  samB,
  unavailableRobotics,
  eventShare,
  staleAvailability,
  injectionOnly,
  privateOtherCommunity,
];

const allCommunities: Community[] = [
  nameOnlyRoboticsClub,
  unrelatedCommunity,
  documentedWarehouseCommunity,
  secondDocumentedCommunity,
];

function query(overrides: Partial<MatchQuery> = {}): MatchQuery {
  return {
    goal: ROBOTICS_GOAL,
    mode: "connections",
    viewer: sampleViewer,
    communityIds: scope,
    candidates: allPeople,
    communities: allCommunities,
    ...overrides,
  };
}

function evidence(id: string, signalId: string, kind: SignalKind, summary: string, excerpt?: string | null): Evidence {
  return {
    id,
    signalId,
    kind,
    summary,
    excerpt: excerpt ?? summary,
    sourceLabel: "Test statement",
    occurredAt: at,
    sourceUrl: null,
    evidenceClass: "explicit",
  };
}

function person(options: {
  id: string;
  displayName?: string;
  communityIds?: string[];
  availability?: CandidateContext["currentAvailability"];
  signals: Array<{
    id: string;
    kind: SignalKind;
    topic: string;
    statement: string;
    evidence: Array<{ id: string; summary: string; excerpt?: string | null }>;
  }>;
}): CandidateContext {
  return {
    member: {
      id: options.id,
      displayName: options.displayName ?? options.id,
      initials: "TT",
      communityIds: options.communityIds ?? ["unicorn-mafia"],
    },
    currentAvailability: options.availability ?? "unknown",
    signals: options.signals.map((signal) => ({
      id: signal.id,
      kind: signal.kind,
      topic: signal.topic,
      statement: signal.statement,
      validUntil: null,
      evidence: signal.evidence.map((item) =>
        evidence(item.id, signal.id, signal.kind, item.summary, item.excerpt),
      ),
    })),
  };
}

function community(partial: Pick<Community, "id" | "name" | "description" | "focusTags"> & Partial<Community>): Community {
  return {
    publicUrl: "https://example.com/public",
    metadataSourceUrl: "https://example.com/source",
    metadataVerifiedAt: at,
    status: "listed",
    ...partial,
  };
}

function idsOn(candidate: CandidateContext): { evidenceIds: Set<string>; signalIds: Set<string> } {
  const evidenceIds = new Set<string>();
  const signalIds = new Set<string>();
  for (const signal of candidate.signals) {
    signalIds.add(signal.id);
    for (const item of signal.evidence) evidenceIds.add(item.id);
  }
  return { evidenceIds, signalIds };
}

describe("matchBaseline", () => {
  it("exports a retrieval cap of 30", () => {
    expect(MAX_RETRIEVAL).toBe(30);
  });

  it("finds amara, leo, and nina for the robotics goal and keeps same-name people distinct", () => {
    const result = matchBaseline(query());
    const memberIds = result.hits.map((hit) => hit.memberId);

    expect(memberIds).toEqual([
      "demo-amara",
      "demo-leo",
      "demo-nina",
      "demo-sam-b",
      "demo-stale",
      "demo-sam-a",
      "demo-event",
    ]);
    expect(new Set(memberIds).size).toBe(memberIds.length);
    expect(memberIds).toContain("demo-sam-a");
    expect(memberIds).toContain("demo-sam-b");
    expect(result.modelInputMemberIds).toEqual(memberIds);

    const byId = new Map(result.hits.map((hit) => [hit.memberId, hit]));
    expect(byId.get("demo-amara")).toMatchObject({
      fitType: "experience",
      score: 6,
      availability: "unknown",
      reason: "Spent two years deploying robots in fulfilment centres.",
      evidenceIds: ["demo-evidence-amara"],
      signalIds: ["demo-signal-amara"],
    });
    expect(byId.get("demo-leo")).toMatchObject({
      fitType: "complementary_need",
      score: 5,
      availability: "unknown",
      reason: "Runs warehouse operations and is looking at picking automation.",
      evidenceIds: ["demo-evidence-leo"],
      signalIds: ["demo-signal-leo"],
    });
    expect(byId.get("demo-nina")).toMatchObject({
      fitType: "complementary_need",
      score: 5,
      availability: "unknown",
      reason: "Building a robotics simulator and seeking a deployment collaborator.",
      evidenceIds: ["demo-evidence-nina"],
      signalIds: ["demo-signal-nina"],
    });
    expect(byId.get("demo-sam-a")).toMatchObject({
      fitType: "peer",
      score: 2.5,
      availability: "stated_available",
      reason: "Offers review of robotics control software.",
      evidenceIds: ["demo-evidence-sam-a"],
      signalIds: ["demo-signal-sam-a"],
    });
    expect(byId.get("demo-sam-b")).toMatchObject({
      fitType: "collaborator",
      score: 5,
      availability: "unknown",
      reason: "Building a warehouse slotting tool.",
      evidenceIds: ["demo-evidence-sam-b"],
      signalIds: ["demo-signal-sam-b"],
    });
    expect(byId.get("demo-event")).toMatchObject({
      fitType: "peer",
      score: 2,
      reason: "Shared a London robotics meetup link.",
      evidenceIds: ["demo-evidence-event"],
      signalIds: ["demo-signal-event"],
    });
    expect(byId.get("demo-stale")).toMatchObject({
      fitType: "experience",
      score: 3,
      availability: "unknown",
      reason: "Shipped a robotics picking cell.",
      evidenceIds: ["demo-evidence-stale-exp"],
      signalIds: ["demo-signal-stale-exp"],
    });
  });

  it("drops people outside viewer scope or the requested communities, including private other-community members", () => {
    const split = person({
      id: "demo-split",
      communityIds: ["unicorn-mafia", "night-office"],
      signals: [
        {
          id: "sig-split",
          kind: "stated_experience",
          topic: "robotics",
          statement: "I deploy warehouse robotics.",
          evidence: [{ id: "ev-split", summary: "Deploys warehouse robotics." }],
        },
      ],
    });
    const result = matchBaseline(
      query({
        communityIds: ["night-office", "unicorn-mafia", "kickstart-global"],
        candidates: [...allPeople, split],
      }),
    );
    const memberIds = result.hits.map((hit) => hit.memberId);

    expect(memberIds).not.toContain("demo-private");
    expect(result.modelInputMemberIds).not.toContain("demo-private");
    expect(memberIds).toContain("demo-split");

    const kickstartOnly = matchBaseline(query({ communityIds: ["kickstart-global"] }));
    expect(kickstartOnly.hits.map((hit) => hit.memberId)).toEqual([
      "demo-leo",
      "demo-nina",
      "demo-sam-b",
      "demo-stale",
    ]);

    const nightOfficeSearch = matchBaseline(
      query({
        communityIds: ["night-office"],
        candidates: [...allPeople, split],
      }),
    );
    expect(nightOfficeSearch.hits.map((hit) => hit.memberId)).not.toContain("demo-private");
    expect(nightOfficeSearch.hits.map((hit) => hit.memberId)).not.toContain("demo-split");
    expect(nightOfficeSearch.modelInputMemberIds).toEqual([]);
  });

  it("excludes unavailable people and does not let an old free-tonight note upgrade unknown availability", () => {
    const result = matchBaseline(query());
    const stale = result.hits.find((hit) => hit.memberId === "demo-stale");

    expect(result.hits.map((hit) => hit.memberId)).not.toContain("demo-unavailable");
    expect(result.modelInputMemberIds).not.toContain("demo-unavailable");
    expect(stale?.availability).toBe("unknown");
    expect(stale?.evidenceIds).not.toContain("demo-evidence-stale-avail");
    expect(stale?.signalIds).not.toContain("demo-signal-stale-avail");
    expect(stale?.reason).toBe("Shipped a robotics picking cell.");
  });

  it("does not create a hit from availability text alone, even when that text overlaps the goal", () => {
    const availabilityOnly = person({
      id: "demo-avail-only",
      availability: "unknown",
      signals: [
        {
          id: "sig-avail-only",
          kind: "availability",
          topic: "robotics",
          statement: "I am free tonight for warehouse robotics.",
          evidence: [{ id: "ev-avail-only", summary: "Free tonight for warehouse robotics." }],
        },
      ],
    });
    const result = matchBaseline(query({ candidates: [availabilityOnly] }));

    expect(result.hits).toEqual([]);
    expect(result.modelInputMemberIds).toEqual([]);
  });

  it("omits in-scope people with no token overlap from hits and model input", () => {
    const baker = person({
      id: "demo-baker",
      displayName: "Sam Lee",
      signals: [
        {
          id: "sig-baker",
          kind: "stated_experience",
          topic: "sourdough",
          statement: "I bake bread on weekends.",
          evidence: [{ id: "ev-baker", summary: "Bakes bread on weekends." }],
        },
      ],
    });
    const result = matchBaseline(query({ candidates: [...allPeople, baker] }));

    expect(result.hits.map((hit) => hit.memberId)).not.toContain("demo-baker");
    expect(result.modelInputMemberIds).not.toContain("demo-baker");
    expect(result.modelInputMemberIds).toEqual(result.hits.map((hit) => hit.memberId));
  });

  it("stems robot, robots, and robotics together and ignores stopwords and punctuation", () => {
    const robotsOnly = person({
      id: "demo-robots",
      signals: [
        {
          id: "sig-robots",
          kind: "stated_experience",
          topic: "shipping",
          statement: "Operates robots.",
          evidence: [{ id: "ev-robots", summary: "Operates robots." }],
        },
      ],
    });
    const robes = person({
      id: "demo-robes",
      signals: [
        {
          id: "sig-robes",
          kind: "stated_experience",
          topic: "textiles",
          statement: "Operates robes.",
          evidence: [{ id: "ev-robes", summary: "Operates robes." }],
        },
      ],
    });
    const stopwordsOnly = person({
      id: "demo-stop",
      signals: [
        {
          id: "sig-stop",
          kind: "stated_experience",
          topic: "the",
          statement: "I am the one we want.",
          evidence: [{ id: "ev-stop", summary: "I am the one we want." }],
        },
      ],
    });
    const result = matchBaseline(
      query({
        goal: "Robotics!!!",
        candidates: [robotsOnly, robes, stopwordsOnly],
        communities: [],
      }),
    );

    expect(result.hits.map((hit) => hit.memberId)).toEqual(["demo-robots"]);
    expect(result.hits[0]?.score).toBe(3);
    expect(result.hits[0]?.reason).toBe("Operates robots.");
  });

  it("counts each overlapping goal token once per signal and sums kind weights", () => {
    const repeated = person({
      id: "demo-repeated",
      signals: [
        {
          id: "sig-repeated",
          kind: "stated_experience",
          topic: "robotics robotics",
          statement: "robotics robotics robotics",
          evidence: [{ id: "ev-repeated", summary: "robotics robotics" }],
        },
      ],
    });
    const experience = person({
      id: "demo-weight-exp",
      signals: [
        {
          id: "sig-weight-exp",
          kind: "stated_experience",
          topic: "robotics",
          statement: "robotics",
          evidence: [{ id: "ev-weight-exp", summary: "Worked on robotics." }],
        },
      ],
    });
    const offering = person({
      id: "demo-weight-off",
      signals: [
        {
          id: "sig-weight-off",
          kind: "offering",
          topic: "robotics",
          statement: "robotics",
          evidence: [{ id: "ev-weight-off", summary: "Offers robotics help." }],
        },
      ],
    });
    const seeking = person({
      id: "demo-weight-seek",
      signals: [
        {
          id: "sig-weight-seek",
          kind: "seeking",
          topic: "robotics",
          statement: "robotics",
          evidence: [{ id: "ev-weight-seek", summary: "Seeking robotics help." }],
        },
      ],
    });
    const building = person({
      id: "demo-weight-build",
      signals: [
        {
          id: "sig-weight-build",
          kind: "building",
          topic: "robotics",
          statement: "robotics",
          evidence: [{ id: "ev-weight-build", summary: "Building robotics tools." }],
        },
      ],
    });
    const interest = person({
      id: "demo-weight-int",
      signals: [
        {
          id: "sig-weight-int",
          kind: "interest",
          topic: "robotics",
          statement: "robotics",
          evidence: [{ id: "ev-weight-int", summary: "Interested in robotics." }],
        },
      ],
    });
    const result = matchBaseline(
      query({
        goal: "robotics robotics robotics",
        candidates: [interest, seeking, repeated, building, offering, experience],
        communities: [],
      }),
    );

    expect(result.hits.map((hit) => [hit.memberId, hit.score, hit.fitType])).toEqual([
      ["demo-repeated", 3, "experience"],
      ["demo-weight-exp", 3, "experience"],
      ["demo-weight-build", 2.5, "collaborator"],
      ["demo-weight-off", 2.5, "peer"],
      ["demo-weight-seek", 2.5, "complementary_need"],
      ["demo-weight-int", 1, "peer"],
    ]);
  });

  it("takes fit type from the highest-weight matching signal and copies that evidence summary", () => {
    const mixed = person({
      id: "demo-mixed",
      signals: [
        {
          id: "sig-mixed-interest",
          kind: "interest",
          topic: "warehouse",
          statement: "Curious about warehouse london people.",
          evidence: [{ id: "ev-mixed-interest", summary: "Curious about warehouse work in London." }],
        },
        {
          id: "sig-mixed-exp",
          kind: "stated_experience",
          topic: "robotics",
          statement: "I know robotics.",
          evidence: [{ id: "ev-mixed-exp", summary: "Knows robotics." }],
        },
      ],
    });
    const result = matchBaseline(query({ candidates: [mixed], communities: [] }));
    const hit = result.hits[0];

    expect(hit).toMatchObject({
      memberId: "demo-mixed",
      fitType: "experience",
      reason: "Knows robotics.",
      score: 6,
    });
    expect(hit?.evidenceIds).toContain("ev-mixed-exp");
    expect(hit?.evidenceIds).toContain("ev-mixed-interest");
    expect(hit?.signalIds).toContain("sig-mixed-exp");
    expect(hit?.signalIds).toContain("sig-mixed-interest");
    expect(hit?.reason).toBe("Knows robotics.");
  });

  it("uses speaker only for stated experience or offering", () => {
    const connections = matchBaseline(query());
    const speaker = matchBaseline(query({ mode: "speaker" }));
    const speakerById = new Map(speaker.hits.map((hit) => [hit.memberId, hit.fitType]));

    expect(speaker.hits.map((hit) => hit.memberId)).toEqual(connections.hits.map((hit) => hit.memberId));
    expect(speaker.hits.map((hit) => hit.score)).toEqual(connections.hits.map((hit) => hit.score));
    expect(speakerById.get("demo-amara")).toBe("speaker");
    expect(speakerById.get("demo-stale")).toBe("speaker");
    expect(speakerById.get("demo-sam-a")).toBe("speaker");
    expect(speakerById.get("demo-sam-b")).toBe("collaborator");
    expect(speakerById.get("demo-leo")).toBe("complementary_need");
    expect(speakerById.get("demo-nina")).toBe("complementary_need");
    expect(speakerById.get("demo-event")).toBe("peer");
    expect(speakerById.get("demo-event")).not.toBe("experience");
    expect(speakerById.get("demo-event")).not.toBe("speaker");
  });

  it("keeps at most three scoring evidence ids and only ids that belong to that candidate", () => {
    const many = person({
      id: "demo-many",
      signals: [
        {
          id: "sig-many",
          kind: "stated_experience",
          topic: "robotics",
          statement: "robotics",
          evidence: [
            { id: "ev-d", summary: "Notes on robotics." },
            { id: "ev-b", summary: "Notes on robotics." },
            { id: "ev-a", summary: "Notes on robotics." },
            { id: "ev-c", summary: "Notes on robotics." },
            { id: "ev-bake", summary: "Brought biscuits." },
          ],
        },
      ],
    });
    const result = matchBaseline(query({ candidates: [...allPeople, many], communities: [] }));
    const hit = result.hits.find((item) => item.memberId === "demo-many");
    const owned = idsOn(many);

    expect(hit?.evidenceIds).toEqual(["ev-a", "ev-b", "ev-c"]);
    expect(hit?.evidenceIds).not.toContain("ev-d");
    expect(hit?.evidenceIds).not.toContain("ev-bake");
    expect(hit?.signalIds).toEqual(["sig-many"]);
    expect(hit?.reason).toBe("Notes on robotics.");

    for (const item of result.hits) {
      const candidate = [...allPeople, many].find((entry) => entry.member.id === item.memberId);
      expect(candidate).toBeDefined();
      const present = idsOn(candidate as CandidateContext);
      expect(item.evidenceIds.length).toBeGreaterThan(0);
      expect(item.evidenceIds.length).toBeLessThanOrEqual(3);
      for (const evidenceId of item.evidenceIds) expect(present.evidenceIds.has(evidenceId)).toBe(true);
      for (const signalId of item.signalIds) expect(present.signalIds.has(signalId)).toBe(true);
      expect(owned.evidenceIds.has("ev-bake")).toBe(true);
    }
  });

  it("ignores evidence outside restrictToEvidenceIds and treats null as unrestricted", () => {
    const restricted = matchBaseline(
      query({ restrictToEvidenceIds: new Set(["demo-evidence-amara", "demo-evidence-event"]) }),
    );
    expect(restricted.hits.map((hit) => hit.memberId)).toEqual(["demo-amara", "demo-event"]);
    expect(restricted.hits.every((hit) => hit.evidenceIds.every((id) => ["demo-evidence-amara", "demo-evidence-event"].includes(id)))).toBe(true);

    const blocked = person({
      id: "demo-blocked",
      signals: [
        {
          id: "sig-blocked",
          kind: "stated_experience",
          topic: "baking",
          statement: "I bake.",
          evidence: [
            { id: "ev-hidden-robotics", summary: "Deploys warehouse robotics." },
            { id: "ev-visible-bake", summary: "Bakes bread." },
          ],
        },
      ],
    });
    const hidden = matchBaseline(
      query({
        candidates: [blocked, amara],
        restrictToEvidenceIds: new Set(["ev-visible-bake"]),
        communities: [],
      }),
    );
    expect(hidden.hits).toEqual([]);

    const unrestricted = matchBaseline(query({ restrictToEvidenceIds: null }));
    const omitted = matchBaseline(query());
    expect(unrestricted.hits).toEqual(omitted.hits);
    expect(matchBaseline(query({ restrictToEvidenceIds: new Set() })).hits).toEqual([]);
  });

  it("caps hits and model input at 30 in score order, then member id", () => {
    const crowd = Array.from({ length: 31 }, (_, index) => {
      const id = `m${String(index).padStart(2, "0")}`;
      const rich = index === 30;
      return person({
        id,
        signals: [
          {
            id: `sig-${id}`,
            kind: "stated_experience",
            topic: rich ? "warehouse robotics" : "robotics",
            statement: rich ? "People in London build warehouse robotics." : "robotics",
            evidence: [{ id: `ev-${id}`, summary: rich ? "People in London build warehouse robotics." : "Knows robotics." }],
          },
        ],
      });
    });
    const baker = person({
      id: "m-baker",
      signals: [
        {
          id: "sig-m-baker",
          kind: "interest",
          topic: "bread",
          statement: "sourdough",
          evidence: [{ id: "ev-m-baker", summary: "Bakes sourdough." }],
        },
      ],
    });
    const result = matchBaseline(query({ candidates: [...crowd, baker], communities: [] }));
    const keptByScore = ["m30", ...Array.from({ length: 29 }, (_, index) => `m${String(index).padStart(2, "0")}`)];

    expect(result.hits).toHaveLength(30);
    expect(result.hits.map((hit) => hit.memberId)).toEqual(keptByScore);
    expect(result.modelInputMemberIds).toEqual(keptByScore);
    expect(result.hits[0]?.score).toBe(15);
    expect(result.modelInputMemberIds).not.toContain("m29");
    expect(result.modelInputMemberIds).not.toContain("m-baker");
  });

  it("matches communities on description or focus tags, never the name, and keeps two verbatim fits", () => {
    const tagsOnly = community({
      id: "tags-only",
      name: "Quiet Circle",
      description: null,
      focusTags: ["warehouse", "robotics"],
      metadataSourceUrl: "https://example.com/tags",
      publicUrl: "https://example.com/tags-public",
    });
    const best = community({
      id: "zzz-best",
      name: "Baking Friends",
      description: "People in London build warehouse robotics.",
      focusTags: [],
      metadataSourceUrl: "https://example.com/best-source",
      publicUrl: "https://example.com/best-public",
    });
    const result = matchBaseline(
      query({
        communities: [unrelatedCommunity, nameOnlyRoboticsClub, documentedWarehouseCommunity, tagsOnly, secondDocumentedCommunity, best],
      }),
    );

    expect(result.communities).toEqual([
      {
        communityId: "zzz-best",
        reason: "People in London build warehouse robotics.",
        sourceUrl: "https://example.com/best-source",
      },
      {
        communityId: "documented-london",
        reason: "A London group documenting robotics deployment writeups.",
        sourceUrl: "https://example.com/builders/focus",
      },
    ]);
    expect(result.communities.map((fit) => fit.communityId)).not.toContain("name-only-robotics");
    expect(result.communities.map((fit) => fit.communityId)).not.toContain("unrelated-bakery");
    expect(JSON.stringify(result.communities)).not.toContain("Robotics Club");

    const tagsResult = matchBaseline(query({ communities: [tagsOnly, nameOnlyRoboticsClub, unrelatedCommunity] }));
    expect(tagsResult.communities).toEqual([
      {
        communityId: "tags-only",
        reason: "warehouse robotics",
        sourceUrl: "https://example.com/tags",
      },
    ]);

    const tied = matchBaseline(query());
    expect(tied.communities.map((fit) => fit.communityId)).toEqual(["documented-london", "documented-warehouse"]);
    expect(tied.communities[1]?.reason).toBe("Members compare warehouse robotics deployments and picking automation.");
    expect(tied.communities[1]?.sourceUrl).toBe("https://example.com/night-office/focus");
  });

  it("treats injected source text as data and does not mint other member ids", () => {
    const result = matchBaseline(query());
    const serialized = JSON.stringify(result);

    expect(result.hits.map((hit) => hit.memberId)).not.toContain("demo-injection");
    expect(result.modelInputMemberIds).not.toContain("demo-injection");
    expect(serialized).not.toContain("demo-admin");
    expect(serialized).not.toContain("demo-private");
    expect(serialized).not.toContain("demo-unavailable");
  });

  it("returns no people or communities when nothing overlaps the goal", () => {
    const result = matchBaseline(query({ goal: "underwater basket weaving" }));

    expect(result.hits).toEqual([]);
    expect(result.communities).toEqual([]);
    expect(result.modelInputMemberIds).toEqual([]);
  });
});
