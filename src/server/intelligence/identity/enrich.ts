import type { ExternalCandidate, IdentityGraph } from "./types";

export interface ProfileSearchHit {
  url: string;
  title: string;
  snippet: string;
}

export interface ProfileSearch {
  search(query: string): Promise<ProfileSearchHit[]>;
}

const GENERIC = new Set([
  "robotics",
  "ai",
  "startup",
  "tech",
  "software",
  "project",
  "app",
  "community",
  "london",
  "engineer",
  "founder",
]);

/**
 * Suggest public pages only when a sender has a multi-word name and a distinctive
 * project or company. A hit is an unresolved candidate. Several hits all stay.
 * Phone numbers and single first names are never queried.
 */
export async function addSearchCandidates(graph: IdentityGraph, search: ProfileSearch): Promise<IdentityGraph> {
  const cards = [];
  for (const card of graph.cards) {
    const project = distinctiveProject(card.claims.map((claim) => claim.text));
    if (!hasFullName(card.label) || !project || card.candidates.some((item) => item.source === "self_shared")) {
      cards.push(card);
      continue;
    }
    const query = `"${card.label}" "${project}"`;
    const hits = await search.search(query);
    const additions: ExternalCandidate[] = hits.slice(0, 3).map((hit) => ({
      id: `candidate:${card.senderKey}:search:${hashTail(hit.url)}`,
      senderKey: card.senderKey,
      url: hit.url,
      source: "public_search",
      supportingClues: [`Stated name ${card.label}.`, `Distinctive project ${project}.`, hit.snippet],
      contradictions: [],
      sourceUrls: [hit.url],
      status: "unresolved",
    }));
    cards.push({ ...card, candidates: [...card.candidates, ...additions] });
  }
  return { cards };
}

function hasFullName(label: string): boolean {
  if (label.startsWith("Unsaved contact")) return false;
  const words = label.split(/\s+/).filter((word) => word.length >= 2 && !/^\d+$/.test(word));
  return words.length >= 2;
}

function distinctiveProject(texts: readonly string[]): string | null {
  for (const text of texts) {
    const quoted = /"([^"]{4,80})"/.exec(text)?.[1];
    if (quoted && !GENERIC.has(quoted.toLowerCase())) return quoted;
    const named = /\b([A-Z][a-z]+(?: [A-Z][a-z]+)+)\b/.exec(text)?.[1];
    if (named && !GENERIC.has(named.toLowerCase())) return named;
  }
  return null;
}

function hashTail(value: string): string {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(16);
}
