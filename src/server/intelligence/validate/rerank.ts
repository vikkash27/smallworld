import type {
  CandidateContext,
  CommunityFit,
  Evidence,
  FitType,
  PersonRecommendation,
  SignalKind,
} from "../../../shared/contracts";

const FIT_TYPES: readonly FitType[] = [
  "experience",
  "complementary_need",
  "collaborator",
  "peer",
  "speaker",
];

/** Shortlist shown on the graph. A circle still proposes only the first few. */
export const MAX_PEOPLE = 12;
export const MAX_COMMUNITIES = 2;

const CAVEAT_UNKNOWN_AVAILABILITY = "Current availability needs confirmation.";
const CAVEAT_INTEREST = "This is a stated interest, not verified experience.";
const CAVEAT_INFERRED = "This match uses an inferred signal.";

export interface AllowedEvidence {
  evidenceId: string;
  signalId: string;
  memberId: string;
  summary: string;
  excerpt: string | null;
  kind: SignalKind;
  evidenceClass: "explicit" | "inferred";
}

export interface AllowedCommunity {
  communityId: string;
  description: string | null;
  focusTags: string[];
  sourceUrl: string;
}

export interface ValidationContext {
  candidates: CandidateContext[];
  communities: AllowedCommunity[];
  allowedMemberIds: ReadonlySet<string>;
}

export interface ValidatedRerank {
  people: PersonRecommendation[];
  communities: CommunityFit[];
  rejected: string[];
}

type Check<T> = { ok: true; value: T } | { ok: false; code: string };

export function validateRerank(raw: unknown, context: ValidationContext): ValidatedRerank {
  if (!isRecord(raw)) {
    return { people: [], communities: [], rejected: ["malformed"] };
  }

  const rejected: string[] = [];
  const evidenceOwners = indexEvidenceOwners(context.candidates);
  const candidates = indexCandidates(context.candidates);
  const people = takePeople(raw.people, context, candidates, evidenceOwners, rejected);
  const communities = takeCommunities(raw.communities, context.communities, rejected);
  return { people, communities, rejected };
}

function takePeople(
  rawPeople: unknown,
  context: ValidationContext,
  candidates: ReadonlyMap<string, CandidateContext>,
  evidenceOwners: ReadonlyMap<string, ReadonlySet<string>>,
  rejected: string[],
): PersonRecommendation[] {
  if (rawPeople === undefined) return [];
  if (!Array.isArray(rawPeople)) {
    rejected.push("malformed");
    return [];
  }

  const people: PersonRecommendation[] = [];
  for (const entry of rawPeople) {
    const result = validatePerson(entry, context, candidates, evidenceOwners);
    if (!result.ok) {
      rejected.push(result.code);
      continue;
    }
    if (people.length >= MAX_PEOPLE) {
      rejected.push("over_cap");
      continue;
    }
    people.push(result.value);
  }
  return people;
}

function validatePerson(
  raw: unknown,
  context: ValidationContext,
  candidates: ReadonlyMap<string, CandidateContext>,
  evidenceOwners: ReadonlyMap<string, ReadonlySet<string>>,
): Check<PersonRecommendation> {
  if (!isRecord(raw)) return { ok: false, code: "malformed" };

  const memberId = raw.memberId;
  if (typeof memberId !== "string" || memberId.length === 0) return { ok: false, code: "malformed" };
  if (!context.allowedMemberIds.has(memberId)) return { ok: false, code: "not_allowed" };

  const candidate = candidates.get(memberId);
  if (!candidate) return { ok: false, code: "unknown_member" };
  if (candidate.currentAvailability === "unavailable") return { ok: false, code: "unavailable" };

  const matched = matchEvidence(raw.evidenceIds, candidate, evidenceOwners);
  if (!matched.ok) return matched;

  if (typeof raw.excerpt === "string" && !quoteMatchesExcerpt(raw.excerpt, matched.value)) {
    return { ok: false, code: "bad_excerpt" };
  }

  if (!isFitType(raw.fitType)) return { ok: false, code: "bad_fit" };
  if (
    (raw.fitType === "experience" || raw.fitType === "speaker") &&
    matched.value.some((item) => item.kind === "interest")
  ) {
    return { ok: false, code: "bad_fit" };
  }

  if (typeof raw.reason !== "string" || !matched.value.some((item) => reasonGrounded(raw.reason as string, item))) {
    return { ok: false, code: "ungrounded_reason" };
  }

  const availability = candidate.currentAvailability;
  return {
    ok: true,
    value: {
      member: candidate.member,
      fitType: raw.fitType,
      reason: raw.reason,
      evidence: matched.value,
      caveats: caveatsFor(availability, matched.value),
      availability,
    },
  };
}

function matchEvidence(
  rawIds: unknown,
  candidate: CandidateContext,
  evidenceOwners: ReadonlyMap<string, ReadonlySet<string>>,
): Check<Evidence[]> {
  if (!Array.isArray(rawIds) || rawIds.length === 0) return { ok: false, code: "missing_evidence" };

  const matched: Evidence[] = [];
  const seen = new Set<string>();
  for (const evidenceId of rawIds) {
    if (typeof evidenceId !== "string" || evidenceId.length === 0) {
      return { ok: false, code: "missing_evidence" };
    }
    if (seen.has(evidenceId)) continue;
    seen.add(evidenceId);

    const own = findOwnEvidence(candidate, evidenceId);
    if (own) {
      matched.push(own);
      continue;
    }

    const owners = evidenceOwners.get(evidenceId);
    if (owners && [...owners].some((ownerId) => ownerId !== candidate.member.id)) {
      return { ok: false, code: "misattributed_evidence" };
    }
    return { ok: false, code: "missing_evidence" };
  }

  return { ok: true, value: matched };
}

function quoteMatchesExcerpt(quote: string, evidence: readonly Evidence[]): boolean {
  if (quote.length === 0) return false;
  return evidence.some((item) => item.excerpt !== null && item.excerpt.includes(quote));
}

function reasonGrounded(reason: string, evidence: Evidence): boolean {
  if (reason.length === 0) return false;
  if (evidence.summary.includes(reason)) return true;
  return evidence.excerpt !== null && evidence.excerpt.includes(reason);
}

function caveatsFor(
  availability: "stated_available" | "unknown",
  evidence: readonly Evidence[],
): string[] {
  const caveats: string[] = [];
  if (availability === "unknown") caveats.push(CAVEAT_UNKNOWN_AVAILABILITY);
  if (evidence.some((item) => item.kind === "interest")) caveats.push(CAVEAT_INTEREST);
  if (evidence.some((item) => item.evidenceClass === "inferred")) caveats.push(CAVEAT_INFERRED);
  return caveats;
}

function takeCommunities(
  rawCommunities: unknown,
  allowed: readonly AllowedCommunity[],
  rejected: string[],
): CommunityFit[] {
  if (rawCommunities === undefined) return [];
  if (!Array.isArray(rawCommunities)) {
    rejected.push("malformed");
    return [];
  }

  const byId = new Map<string, AllowedCommunity>();
  for (const community of allowed) {
    if (!byId.has(community.communityId)) byId.set(community.communityId, community);
  }

  const communities: CommunityFit[] = [];
  for (const entry of rawCommunities) {
    const result = validateCommunity(entry, byId);
    if (!result.ok) {
      rejected.push(result.code);
      continue;
    }
    if (communities.length >= MAX_COMMUNITIES) {
      rejected.push("over_cap");
      continue;
    }
    communities.push(result.value);
  }
  return communities;
}

function validateCommunity(
  raw: unknown,
  allowed: ReadonlyMap<string, AllowedCommunity>,
): Check<CommunityFit> {
  if (!isRecord(raw)) return { ok: false, code: "malformed" };
  const communityId = raw.communityId;
  if (typeof communityId !== "string" || communityId.length === 0) return { ok: false, code: "malformed" };

  const community = allowed.get(communityId);
  if (!community) return { ok: false, code: "unknown_community" };
  if (typeof raw.reason !== "string" || !communityReasonOk(raw.reason, community)) {
    return { ok: false, code: "ungrounded_community" };
  }

  return {
    ok: true,
    value: {
      communityId: community.communityId,
      reason: raw.reason,
      sourceUrl: community.sourceUrl,
    },
  };
}

function communityReasonOk(reason: string, community: AllowedCommunity): boolean {
  if (reason.length === 0) return false;
  if (community.description !== null && community.description.includes(reason)) return true;
  return community.focusTags.some((tag) => tag.includes(reason));
}

function indexCandidates(candidates: readonly CandidateContext[]): Map<string, CandidateContext> {
  const byId = new Map<string, CandidateContext>();
  for (const candidate of candidates) {
    if (!byId.has(candidate.member.id)) byId.set(candidate.member.id, candidate);
  }
  return byId;
}

function indexEvidenceOwners(candidates: readonly CandidateContext[]): Map<string, Set<string>> {
  const owners = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    for (const signal of candidate.signals) {
      for (const item of signal.evidence) {
        const memberIds = owners.get(item.id) ?? new Set<string>();
        memberIds.add(candidate.member.id);
        owners.set(item.id, memberIds);
      }
    }
  }
  return owners;
}

function findOwnEvidence(candidate: CandidateContext, evidenceId: string): Evidence | undefined {
  for (const signal of candidate.signals) {
    for (const item of signal.evidence) {
      if (item.id === evidenceId) return item;
    }
  }
  return undefined;
}

function isFitType(value: unknown): value is FitType {
  return typeof value === "string" && (FIT_TYPES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
