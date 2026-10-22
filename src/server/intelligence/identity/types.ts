/** Internal sender id. Phone numbers are hashed and never stored raw. */
export type SenderKey = string;

export type ClaimKind =
  | "introduction"
  | "building"
  | "offering"
  | "seeking"
  | "experience"
  | "role"
  | "location"
  | "project";

export type ClaimStatus = "pending" | "approved" | "rejected";

export type CandidateSource = "self_shared" | "organiser_recorded" | "public_search";

export type CandidateStatus = "unresolved" | "confirmed" | "rejected";

export type ConfirmationBasis = "member" | "organiser_knowledge" | "documented_corroboration";

/** What the evidence actually supports. These are not the same kind of link. */
export type EdgeType =
  | "multi_community"
  | "possible_name_match"
  | "stated_relationship"
  | "observed_interaction"
  | "suggested_collaboration"
  | "shared_topic";

export type MessageAttribution = "own" | "forwarded" | "job_advert" | "about_other";

export interface ParsedMessage {
  messageId: string;
  chatId: string;
  occurredAt: string | null;
  senderKey: SenderKey;
  /** Display name, or a non-reversible unsaved-contact label. Never a phone number. */
  label: string;
  body: string;
  attribution: MessageAttribution;
}

export interface ChatClaim {
  id: string;
  messageId: string;
  senderKey: SenderKey;
  kind: ClaimKind;
  text: string;
  sourceExcerpt: string;
  occurredAt: string | null;
  chatId: string;
  status: ClaimStatus;
}

export interface ExternalCandidate {
  id: string;
  senderKey: SenderKey;
  url: string;
  source: CandidateSource;
  supportingClues: string[];
  contradictions: string[];
  /** Pages or messages that support this candidate. Not proof of ownership. */
  sourceUrls: string[];
  status: CandidateStatus;
  confirmationBasis?: ConfirmationBasis;
  confirmedBy?: string;
}

export interface IdentityEdge {
  type: EdgeType;
  fromSenderKey: SenderKey;
  toSenderKey?: SenderKey;
  toLabel?: string;
  evidenceExcerpt: string;
  chatId: string;
}

export interface UnattributedLink {
  url: string;
  messageId: string;
  reason: "third_party" | "forwarded" | "job_advert";
}

export interface ReviewCard {
  senderKey: SenderKey;
  label: string;
  chatIds: string[];
  claims: ChatClaim[];
  candidates: ExternalCandidate[];
  /** Profile URLs in this sender's messages that were not self-attributed. */
  unattributedLinks: UnattributedLink[];
  contradictions: string[];
  edges: IdentityEdge[];
}

export interface IdentityGraph {
  cards: ReviewCard[];
}
