import type { CandidateContext, Evidence, SignalKind } from "../../../shared/contracts";
import { buildIdentityGraph } from "./resolve";
import type { ChatExport } from "./parse";
import type {
  ChatClaim,
  ClaimKind,
  ConfirmationBasis,
  ExternalCandidate,
  IdentityGraph,
} from "./types";

const KIND_TO_SIGNAL: Record<ClaimKind, SignalKind> = {
  introduction: "interest",
  building: "building",
  offering: "offering",
  seeking: "seeking",
  experience: "stated_experience",
  role: "interest",
  location: "interest",
  project: "building",
};

export function setClaimStatus(graph: IdentityGraph, claimId: string, status: ChatClaim["status"]): IdentityGraph {
  return mapCards(graph, (card) => ({
    ...card,
    claims: card.claims.map((claim) => (claim.id === claimId ? { ...claim, status } : claim)),
  }));
}

/** An organiser-recorded URL is still unresolved until confirmCandidate. */
export function recordOrganiserCandidate(
  graph: IdentityGraph,
  senderKey: string,
  url: string,
  supportingClues: readonly string[],
): IdentityGraph {
  return mapCards(graph, (card) => {
    if (card.senderKey !== senderKey) return card;
    const candidate: ExternalCandidate = {
      id: `candidate:${senderKey}:organiser:${card.candidates.length + 1}`,
      senderKey,
      url,
      source: "organiser_recorded",
      supportingClues: [...supportingClues],
      contradictions: [],
      sourceUrls: [],
      status: "unresolved",
    };
    return { ...card, candidates: [...card.candidates, candidate] };
  });
}

export function confirmCandidate(
  graph: IdentityGraph,
  candidateId: string,
  confirmation: { by: string; basis: ConfirmationBasis },
): IdentityGraph {
  if (!confirmation.by.trim()) throw new Error("Confirmation requires the person who confirmed it.");
  return mapCards(graph, (card) => ({
    ...card,
    candidates: card.candidates.map((candidate) =>
      candidate.id === candidateId
        ? { ...candidate, status: "confirmed", confirmationBasis: confirmation.basis, confirmedBy: confirmation.by }
        : candidate,
    ),
  }));
}

/**
 * Approves outstanding chat claims and self-shared profile links.
 * A rejection stays rejected. Search hits and organiser-recorded guesses stay unresolved.
 */
export function approveOutstanding(
  graph: IdentityGraph,
  confirmation: { by: string },
): IdentityGraph {
  if (!confirmation.by.trim()) throw new Error("Approval requires the person who approved it.");
  return mapCards(graph, (card) => ({
    ...card,
    claims: card.claims.map((claim) => (claim.status === "pending" ? { ...claim, status: "approved" } : claim)),
    candidates: card.candidates.map((candidate) => {
      if (candidate.status !== "unresolved" || candidate.source !== "self_shared") return candidate;
      return {
        ...candidate,
        status: "confirmed",
        confirmationBasis: "documented_corroboration",
        confirmedBy: confirmation.by,
      };
    }),
  }));
}

/** Reimport keeps stable sender, message, claim, and candidate ids. A rejection stays rejected. */
export function reimport(previous: IdentityGraph, chats: readonly ChatExport[]): IdentityGraph {
  const next = buildIdentityGraph(chats);
  const previousClaims = new Map(previous.cards.flatMap((card) => card.claims.map((claim) => [claim.id, claim])));
  const previousCandidates = new Map(
    previous.cards.flatMap((card) => card.candidates.map((candidate) => [candidate.id, candidate])),
  );
  return mapCards(next, (card) => ({
    ...card,
    claims: card.claims.map((claim) => {
      const prior = previousClaims.get(claim.id);
      return prior ? { ...claim, status: prior.status } : claim;
    }),
    candidates: card.candidates.map((candidate) => {
      const prior = previousCandidates.get(candidate.id);
      if (!prior) return candidate;
      return {
        ...candidate,
        status: prior.status,
        confirmationBasis: prior.confirmationBasis,
        confirmedBy: prior.confirmedBy,
        contradictions: prior.contradictions,
      };
    }),
  }));
}

export function rejectCandidate(graph: IdentityGraph, candidateId: string): IdentityGraph {
  return mapCards(graph, (card) => ({
    ...card,
    candidates: card.candidates.map((candidate) =>
      candidate.id === candidateId ? { ...candidate, status: "rejected" } : candidate,
    ),
  }));
}

/**
 * Discovery context comes from approved chat claims.
 * An unresolved or rejected external profile does not become a fact.
 * A confirmed profile is included only as a confirmed link, separate from the chat claim.
 */
export function approvedContext(graph: IdentityGraph): CandidateContext[] {
  return graph.cards.flatMap((card) => {
    const approved = card.claims.filter((claim) => claim.status === "approved");
    const confirmed = card.candidates.filter((candidate) => candidate.status === "confirmed");
    if (approved.length === 0 && confirmed.length === 0) return [];
    const signals = [
      ...approved.map((claim) => signalFromClaim(claim)),
      ...confirmed.map((candidate) => signalFromProfile(candidate)),
    ];
    return [
      {
        member: {
          id: card.senderKey,
          displayName: card.label,
          initials: initials(card.label),
          communityIds: card.chatIds,
        },
        currentAvailability: "unknown",
        signals,
      },
    ];
  });
}

function signalFromClaim(claim: ChatClaim): CandidateContext["signals"][number] {
  const kind = KIND_TO_SIGNAL[claim.kind];
  const evidence: Evidence = {
    id: claim.id,
    signalId: claim.id,
    kind,
    summary: claim.text,
    excerpt: claim.sourceExcerpt,
    sourceLabel: `Approved chat statement in ${claim.chatId}`,
    occurredAt: claim.occurredAt,
    sourceUrl: claim.kind === "project" ? claim.text : null,
    evidenceClass: "explicit",
  };
  return {
    id: claim.id,
    kind,
    topic: claim.chatId,
    statement: claim.sourceExcerpt,
    evidence: [evidence],
    validUntil: null,
  };
}

function signalFromProfile(candidate: ExternalCandidate): CandidateContext["signals"][number] {
  const id = `${candidate.id}:confirmed`;
  const evidence: Evidence = {
    id,
    signalId: id,
    kind: "interest",
    summary: `Confirmed profile ${candidate.url}.`,
    excerpt: candidate.supportingClues[0] ?? candidate.url,
    sourceLabel: `Confirmed by ${candidate.confirmationBasis ?? "member"}`,
    occurredAt: null,
    sourceUrl: candidate.url,
    evidenceClass: "explicit",
  };
  return {
    id,
    kind: "interest",
    topic: "confirmed profile",
    statement: evidence.summary,
    evidence: [evidence],
    validUntil: null,
  };
}

function initials(label: string): string {
  const words = label.split(/\s+/).filter((word) => /^[A-Za-z]/.test(word));
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("") || "•";
}

function mapCards(graph: IdentityGraph, map: (card: IdentityGraph["cards"][number]) => IdentityGraph["cards"][number]): IdentityGraph {
  return { cards: graph.cards.map(map) };
}
