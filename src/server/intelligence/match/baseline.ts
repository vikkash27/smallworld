import type {
  CandidateContext,
  Community,
  CommunityFit,
  FitType,
  SignalKind,
  Viewer,
} from "../../../shared/contracts";

export const MAX_RETRIEVAL = 30;

export interface MatchQuery {
  goal: string;
  mode: "connections" | "speaker";
  viewer: Viewer;
  communityIds: string[];
  candidates: CandidateContext[];
  communities: Community[];
  restrictToEvidenceIds?: ReadonlySet<string> | null;
}

export interface BaselineHit {
  memberId: string;
  fitType: FitType;
  evidenceIds: string[];
  signalIds: string[];
  reason: string;
  availability: "stated_available" | "unknown";
  score: number;
}

export interface BaselineMatch {
  hits: BaselineHit[];
  communities: CommunityFit[];
  modelInputMemberIds: string[];
}

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "with",
  "and",
  "or",
  "of",
  "in",
  "for",
  "on",
  "my",
  "i",
  "me",
  "we",
  "our",
  "want",
  "is",
  "am",
  "are",
]);

const KIND_WEIGHT = {
  stated_experience: 3,
  offering: 2.5,
  building: 2.5,
  seeking: 2.5,
  interest: 1,
  availability: 0,
} as const satisfies Record<SignalKind, number>;

interface CitedEvidence {
  evidenceId: string;
  signalId: string;
  weight: number;
  overlap: number;
  summary: string;
}

interface ScoredCandidate {
  memberId: string;
  fitType: FitType;
  evidenceIds: string[];
  signalIds: string[];
  reason: string;
  availability: "stated_available" | "unknown";
  score: number;
}

function compareId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}

/** Light stem: equal after one trailing s, or a shared prefix of 5+ letters. */
function stemsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const strip = (token: string) =>
    token.length > 1 && token.endsWith("s") ? token.slice(0, -1) : token;
  const left = strip(a);
  const right = strip(b);
  if (left === right) return true;
  return sharedPrefixLength(left, right) >= 5 || sharedPrefixLength(a, b) >= 5;
}

function sharedPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let index = 0;
  while (index < limit && a[index] === b[index]) index += 1;
  return index;
}

function overlapCount(goalTokens: readonly string[], docTokens: readonly string[]): number {
  const uniqueGoal = [...new Set(goalTokens)];
  let count = 0;
  for (const goalToken of uniqueGoal) {
    if (docTokens.some((docToken) => stemsMatch(goalToken, docToken))) count += 1;
  }
  return count;
}

function evidenceAllowed(
  evidenceId: string,
  restrictToEvidenceIds: ReadonlySet<string> | null | undefined,
): boolean {
  if (restrictToEvidenceIds == null) return true;
  return restrictToEvidenceIds.has(evidenceId);
}

function inScope(candidate: CandidateContext, viewer: Viewer, communityIds: readonly string[]): boolean {
  const allowed = new Set(viewer.allowedCommunityIds);
  const requested = new Set(communityIds);
  return candidate.member.communityIds.some((communityId) => allowed.has(communityId) && requested.has(communityId));
}

function fitTypeFor(kind: SignalKind, mode: MatchQuery["mode"]): FitType {
  if (mode === "speaker" && (kind === "stated_experience" || kind === "offering")) return "speaker";
  switch (kind) {
    case "stated_experience":
      return "experience";
    case "seeking":
      return "complementary_need";
    case "building":
      return "collaborator";
    case "offering":
    case "interest":
    case "availability":
      return "peer";
  }
}

function scoreCandidate(
  candidate: CandidateContext,
  goalTokens: readonly string[],
  mode: MatchQuery["mode"],
  restrictToEvidenceIds: ReadonlySet<string> | null | undefined,
): ScoredCandidate | null {
  const cited: CitedEvidence[] = [];
  let score = 0;
  let best: {
    weight: number;
    overlap: number;
    signalId: string;
    kind: SignalKind;
    evidenceId: string;
    summary: string;
  } | null = null;

  for (const signal of candidate.signals) {
    const weight = KIND_WEIGHT[signal.kind];
    const allowed = signal.evidence.filter((evidence) => evidenceAllowed(evidence.id, restrictToEvidenceIds));
    if (allowed.length === 0 || weight <= 0) continue;

    const parts = [signal.topic, signal.statement];
    const own: { id: string; summary: string; overlap: number }[] = [];
    for (const evidence of allowed) {
      parts.push(evidence.summary);
      if (evidence.excerpt) parts.push(evidence.excerpt);
      own.push({
        id: evidence.id,
        summary: evidence.summary,
        overlap: overlapCount(goalTokens, tokenize(`${evidence.summary}\n${evidence.excerpt ?? ""}`)),
      });
    }

    const signalOverlap = overlapCount(goalTokens, tokenize(parts.join("\n")));
    if (signalOverlap === 0) continue;
    score += signalOverlap * weight;

    const matching = own
      .filter((item) => item.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap || compareId(a.id, b.id));
    const supporting =
      matching.length > 0
        ? matching
        : [...own].sort((a, b) => compareId(a.id, b.id)).slice(0, 1);
    const chosen = supporting[0];
    if (!chosen) continue;

    for (const item of supporting) {
      cited.push({
        evidenceId: item.id,
        signalId: signal.id,
        weight,
        overlap: item.overlap,
        summary: item.summary,
      });
    }

    const contender = {
      weight,
      overlap: signalOverlap,
      signalId: signal.id,
      kind: signal.kind,
      evidenceId: chosen.id,
      summary: chosen.summary,
    };
    if (
      !best ||
      contender.weight > best.weight ||
      (contender.weight === best.weight && contender.overlap > best.overlap) ||
      (contender.weight === best.weight &&
        contender.overlap === best.overlap &&
        compareId(contender.signalId, best.signalId) < 0)
    ) {
      best = contender;
    }
  }

  if (!best || score <= 0) return null;

  const rankedEvidence = [...cited].sort(
    (a, b) =>
      b.overlap * b.weight - a.overlap * a.weight ||
      b.overlap - a.overlap ||
      b.weight - a.weight ||
      compareId(a.evidenceId, b.evidenceId),
  );
  const evidenceIds = [
    best.evidenceId,
    ...rankedEvidence.map((item) => item.evidenceId).filter((id) => id !== best.evidenceId),
  ].slice(0, 3);

  const citedById = new Map(cited.map((item) => [item.evidenceId, item]));
  const signalIds = [...new Set(evidenceIds.map((id) => citedById.get(id)?.signalId).filter((id): id is string => !!id))];
  signalIds.sort((a, b) => {
    const weightA = citedById.get(evidenceIds.find((id) => citedById.get(id)?.signalId === a) ?? "")?.weight ?? 0;
    const weightB = citedById.get(evidenceIds.find((id) => citedById.get(id)?.signalId === b) ?? "")?.weight ?? 0;
    return weightB - weightA || compareId(a, b);
  });

  return {
    memberId: candidate.member.id,
    fitType: fitTypeFor(best.kind, mode),
    evidenceIds,
    signalIds,
    reason: best.summary,
    availability: candidate.currentAvailability === "stated_available" ? "stated_available" : "unknown",
    score,
  };
}

function matchCommunities(communities: readonly Community[], goalTokens: readonly string[]): CommunityFit[] {
  return communities
    .map((community) => {
      const documented = [community.description ?? "", ...community.focusTags].join("\n");
      return { community, overlap: overlapCount(goalTokens, tokenize(documented)) };
    })
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || compareId(a.community.id, b.community.id))
    .slice(0, 2)
    .map(({ community }) => ({
      communityId: community.id,
      reason: community.description ?? community.focusTags.join(" "),
      sourceUrl: community.metadataSourceUrl,
    }));
}

export function matchBaseline(query: MatchQuery): BaselineMatch {
  const goalTokens = tokenize(query.goal);
  const ranked: ScoredCandidate[] = [];

  for (const candidate of query.candidates) {
    if (!inScope(candidate, query.viewer, query.communityIds)) continue;
    if (candidate.currentAvailability === "unavailable") continue;
    const scored = scoreCandidate(candidate, goalTokens, query.mode, query.restrictToEvidenceIds);
    if (!scored) continue;
    ranked.push(scored);
  }

  ranked.sort((a, b) => b.score - a.score || compareId(a.memberId, b.memberId));
  const capped = ranked.slice(0, MAX_RETRIEVAL);

  return {
    hits: capped.map((hit) => ({
      memberId: hit.memberId,
      fitType: hit.fitType,
      evidenceIds: hit.evidenceIds,
      signalIds: hit.signalIds,
      reason: hit.reason,
      availability: hit.availability,
      score: hit.score,
    })),
    communities: matchCommunities(query.communities, goalTokens),
    modelInputMemberIds: capped.map((hit) => hit.memberId),
  };
}
