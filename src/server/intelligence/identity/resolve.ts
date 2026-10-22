import type { ChatExport } from "./parse";
import { parseChatExport } from "./parse";
import type {
  ChatClaim,
  ClaimKind,
  ExternalCandidate,
  IdentityEdge,
  IdentityGraph,
  ParsedMessage,
  ReviewCard,
  UnattributedLink,
} from "./types";

const URL_RE = /https?:\/\/[^\s<>]+/gi;
const EVENT_HOST = /(luma\.|lu\.ma|eventbrite|meetup\.com|discord\.gg|chat\.whatsapp\.com)/i;
const PROFILE_HOST = /(linkedin\.com\/in\/|github\.com\/)/i;

const CLAIM_RULES: { kind: ClaimKind; pattern: RegExp }[] = [
  {
    kind: "introduction",
    pattern:
      /\b(i am|i'm|i’m)\b.{0,80}\b(founder|co-founder|engineer|designer|student|researcher|building|based)\b/i,
  },
  { kind: "building", pattern: /\b(i'm building|i’m building|i am building|we're building|we’re building|we are building|working on)\b/i },
  { kind: "offering", pattern: /\b(i can help|happy to help|i offer)\b/i },
  { kind: "seeking", pattern: /\b(looking for|seeking a|we need a|hiring)\b/i },
  { kind: "experience", pattern: /\b(i spent|i worked|my background|i've built|i’ve built)\b/i },
  { kind: "role", pattern: /\b(i am|i'm|i’m).{0,40}\b(founder|co-founder|engineer|designer|student|researcher)\b/i },
  { kind: "location", pattern: /\b(i'm at|i’m at|i am at|based in)\s+[A-Z]/ },
];

const COFOUNDER = /\b[Mm]y cofounder(?: is)? ([A-Z][a-z]+(?: [A-Z][a-z]+)?)/;

export function buildIdentityGraph(chats: readonly ChatExport[]): IdentityGraph {
  const messages = chats.flatMap((chat) => parseChatExport(chat));
  const bySender = groupMessages(messages);
  const cards = [...bySender.entries()].map(([senderKey, senderMessages]) =>
    buildCard(senderKey, senderMessages, bySender),
  );
  const named = notePossibleNameMatches(cards);
  named.sort((a, b) => score(b) - score(a) || a.label.localeCompare(b.label));
  return {
    cards: named.filter(
      (card) =>
        card.candidates.length > 0 ||
        card.edges.some((edge) => edge.type === "multi_community" || edge.type === "stated_relationship") ||
        card.claims.some((claim) => claim.kind !== "seeking"),
    ),
  };
}

function buildCard(
  senderKey: string,
  messages: readonly ParsedMessage[],
  all: ReadonlyMap<string, ParsedMessage[]>,
): ReviewCard {
  const chatIds = [...new Set(messages.map((message) => message.chatId))].sort();
  const label = messages[messages.length - 1]?.label ?? senderKey;
  const own = messages.filter((message) => message.attribution === "own");
  const claims = extractClaims(senderKey, own);
  const candidates = extractSelfSharedProfiles(senderKey, own, claims);
  const unattributedLinks = unattributed(messages);
  const edges = [
    ...multiCommunityEdges(senderKey, chatIds),
    ...statedRelationships(senderKey, own, all),
  ];
  const contradictions = profileContradictions(candidates);
  return { senderKey, label, chatIds, claims, candidates, unattributedLinks, contradictions, edges };
}

function extractClaims(senderKey: string, messages: readonly ParsedMessage[]): ChatClaim[] {
  const claims: ChatClaim[] = [];
  for (const message of messages) {
    const excerpt = clip(message.body);
    for (const rule of CLAIM_RULES) {
      if (!rule.pattern.test(message.body)) continue;
      claims.push({
        id: claimId(senderKey, rule.kind, excerpt),
        messageId: message.messageId,
        senderKey,
        kind: rule.kind,
        text: excerpt,
        sourceExcerpt: excerpt,
        occurredAt: message.occurredAt,
        chatId: message.chatId,
        status: "pending",
      });
    }
    for (const url of urls(message.body)) {
      if (EVENT_HOST.test(url) || profileUrl(url)) continue;
      claims.push({
        id: claimId(senderKey, "project", url),
        messageId: message.messageId,
        senderKey,
        kind: "project",
        text: url,
        sourceExcerpt: excerpt,
        occurredAt: message.occurredAt,
        chatId: message.chatId,
        status: "pending",
      });
    }
  }
  return dedupeClaims(claims).slice(0, 12);
}

function extractSelfSharedProfiles(
  senderKey: string,
  messages: readonly ParsedMessage[],
  claims: readonly ChatClaim[],
): ExternalCandidate[] {
  const clues = claims.map((claim) => claim.text).slice(0, 4);
  const found = new Map<string, ExternalCandidate>();
  for (const message of messages) {
    for (const url of urls(message.body)) {
      const canonical = profileUrl(url);
      if (!canonical || !isSelfAttributed(message.body) || found.has(canonical)) continue;
      found.set(canonical, {
        id: `candidate:${senderKey}:${hashTail(canonical)}`,
        senderKey,
        url: canonical,
        source: "self_shared",
        supportingClues: clues,
        contradictions: [],
        sourceUrls: [],
        status: "unresolved",
      });
    }
  }
  return [...found.values()];
}

function statedRelationships(
  senderKey: string,
  messages: readonly ParsedMessage[],
  all: ReadonlyMap<string, ParsedMessage[]>,
): IdentityEdge[] {
  const edges: IdentityEdge[] = [];
  for (const message of messages) {
    const match = COFOUNDER.exec(message.body);
    const name = match?.[1]?.trim();
    if (!name) continue;
    const other = findSenderByLabel(all, message.chatId, name);
    edges.push({
      type: "stated_relationship",
      fromSenderKey: senderKey,
      toSenderKey: other,
      toLabel: name,
      evidenceExcerpt: clip(message.body),
      chatId: message.chatId,
    });
  }
  return edges;
}

function multiCommunityEdges(senderKey: string, chatIds: readonly string[]): IdentityEdge[] {
  if (chatIds.length < 2) return [];
  return [
    {
      type: "multi_community",
      fromSenderKey: senderKey,
      evidenceExcerpt: `Same sender identifier in ${chatIds.join(", ")}.`,
      chatId: chatIds[0] ?? "",
    },
  ];
}

/** A pasted profile URL is not the sender's unless they called it theirs. */
export function isSelfAttributed(body: string): boolean {
  if (/\bmy (linkedin|github|profile|website|site)\b/i.test(body)) return true;
  if (/\b(here is my|here's my|here’s my|this is my)\b/i.test(body)) return true;
  return /\b(i am|i'm|i’m)\b/i.test(body) && /\b(founder|co-founder|building)\b/i.test(body);
}

function unattributed(messages: readonly ParsedMessage[]): UnattributedLink[] {
  const links: UnattributedLink[] = [];
  for (const message of messages) {
    if (message.attribution === "own" && isSelfAttributed(message.body)) continue;
    const reason =
      message.attribution === "forwarded" || message.attribution === "job_advert"
        ? message.attribution
        : "third_party";
    for (const url of urls(message.body)) {
      const canonical = profileUrl(url);
      if (!canonical) continue;
      links.push({ url: canonical, messageId: message.messageId, reason });
    }
  }
  return links;
}

function notePossibleNameMatches(cards: readonly ReviewCard[]): ReviewCard[] {
  const byLabel = new Map<string, ReviewCard[]>();
  for (const card of cards) {
    if (card.label.startsWith("Unsaved contact")) continue;
    const key = card.label.toLowerCase();
    const list = byLabel.get(key) ?? [];
    list.push(card);
    byLabel.set(key, list);
  }
  const extras = new Map<string, IdentityEdge[]>();
  for (const group of byLabel.values()) {
    if (group.length < 2) continue;
    for (const card of group) {
      for (const other of group) {
        if (other.senderKey === card.senderKey) continue;
        const edge: IdentityEdge = {
          type: "possible_name_match",
          fromSenderKey: card.senderKey,
          toSenderKey: other.senderKey,
          toLabel: other.label,
          evidenceExcerpt: "Same display name in another source. Not merged.",
          chatId: card.chatIds[0] ?? "",
        };
        const list = extras.get(card.senderKey) ?? [];
        list.push(edge);
        extras.set(card.senderKey, list);
      }
    }
  }
  return cards.map((card) => ({ ...card, edges: [...card.edges, ...(extras.get(card.senderKey) ?? [])] }));
}

function profileContradictions(candidates: readonly ExternalCandidate[]): string[] {
  const linkedin = candidates.filter((candidate) => candidate.url.includes("linkedin.com/in/"));
  if (linkedin.length < 2) return [];
  return [`More than one LinkedIn profile was shared: ${linkedin.map((item) => item.url).join(", ")}.`];
}

function findSenderByLabel(
  all: ReadonlyMap<string, ParsedMessage[]>,
  chatId: string,
  name: string,
): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, messages] of all) {
    const inChat = messages.some((message) => message.chatId === chatId && message.label.toLowerCase() === wanted);
    if (inChat) return key;
  }
  return undefined;
}

function groupMessages(messages: readonly ParsedMessage[]): Map<string, ParsedMessage[]> {
  const grouped = new Map<string, ParsedMessage[]>();
  for (const message of messages) {
    const list = grouped.get(message.senderKey) ?? [];
    list.push(message);
    grouped.set(message.senderKey, list);
  }
  return grouped;
}

function urls(body: string): string[] {
  return [...body.matchAll(URL_RE)].map((match) => (match[0] ?? "").replace(/[),.;]+$/, ""));
}

/** Person profile only. Company pages and event links stay project clues. */
export function profileUrl(url: string): string | null {
  if (EVENT_HOST.test(url)) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (host === "linkedin.com" && parts[0] === "in" && parts[1]) {
      return `https://linkedin.com/in/${parts[1].toLowerCase()}`;
    }
    if (host === "github.com" && parts[0] && !["orgs", "topics"].includes(parts[0])) {
      return `https://github.com/${parts[0]}`;
    }
  } catch {
    return null;
  }
  return null;
}

function dedupeClaims(claims: readonly ChatClaim[]): ChatClaim[] {
  const seen = new Set<string>();
  const unique: ChatClaim[] = [];
  for (const claim of claims) {
    if (seen.has(claim.id)) continue;
    seen.add(claim.id);
    unique.push(claim);
  }
  return unique;
}

function claimId(senderKey: string, kind: string, text: string): string {
  return `claim:${senderKey}:${kind}:${hashTail(text)}`;
}

function hashTail(value: string): string {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(16);
}

function clip(value: string): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > 240 ? `${flat.slice(0, 237)}...` : flat;
}

function score(card: ReviewCard): number {
  const intro = card.claims.some((claim) => claim.kind === "introduction") ? 3 : 0;
  return card.candidates.length * 5 + card.claims.length * 2 + intro + card.chatIds.length;
}

export function emptyGraph(): IdentityGraph {
  return { cards: [] };
}
