import type { CandidateContext } from "../../../shared/contracts";
import type { CogneeTransport } from "./cognee";
import { contextRevision, datasetName } from "./revision";

export interface MemoryResult {
  backend: "cognee" | "local";
  evidenceIds: string[];
  fallbackReason?: string;
}

const EVIDENCE_ID = /evidenceId:([A-Za-z0-9_-]+)/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+?\(?\d[\d().\-\s]{7,}\d)/g;
const MAX_IDS = 30;
const MIN_TOKEN = 3;
const MIN_PREFIX = 4;

function byId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => token.length >= MIN_TOKEN);
}

/** Plural fold: robots → robot, warehouses → warehouse, robotics → robotic. */
function lightStem(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function sameStem(left: string, right: string): boolean {
  const a = lightStem(left);
  const b = lightStem(right);
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= MIN_PREFIX && longer.startsWith(shorter);
}

function overlaps(goalTokens: string[], text: string): boolean {
  const docTokens = tokens(text);
  return goalTokens.some((goalToken) => docTokens.some((docToken) => sameStem(goalToken, docToken)));
}

function redactContacts(value: string): string {
  return value.replace(EMAIL, "").replace(PHONE, "").replace(/[ \t]{2,}/g, " ").trim();
}

export function localEvidenceIds(goal: string, candidates: CandidateContext[]): string[] {
  const goalTokens = tokens(goal);
  const hits: { memberId: string; evidenceId: string }[] = [];
  for (const candidate of candidates) {
    if (candidate.currentAvailability === "unavailable") continue;
    for (const signal of candidate.signals) {
      for (const item of signal.evidence) {
        const fields = [signal.statement, signal.topic, item.summary, item.excerpt ?? ""];
        if (fields.some((field) => overlaps(goalTokens, field))) {
          hits.push({ memberId: candidate.member.id, evidenceId: item.id });
        }
      }
    }
  }
  hits.sort((a, b) => byId(a.memberId, b.memberId) || byId(a.evidenceId, b.evidenceId));
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    if (seen.has(hit.evidenceId)) continue;
    seen.add(hit.evidenceId);
    ids.push(hit.evidenceId);
    if (ids.length >= MAX_IDS) break;
  }
  return ids;
}

/** One block per evidence item. Statements are stored as data, not instructions. */
export function indexText(candidates: CandidateContext[]): string {
  const blocks: string[] = [];
  const ordered = [...candidates].sort((a, b) => byId(a.member.id, b.member.id));
  for (const candidate of ordered) {
    if (candidate.currentAvailability === "unavailable") continue;
    const communityIds = [...candidate.member.communityIds].sort(byId).join(",");
    const signals = [...candidate.signals].sort((a, b) => byId(a.id, b.id));
    for (const signal of signals) {
      const evidence = [...signal.evidence].sort((a, b) => byId(a.id, b.id));
      for (const item of evidence) {
        blocks.push(
          [
            `memberId: ${candidate.member.id}`,
            `signalId: ${signal.id}`,
            `evidenceId: ${item.id}`,
            `kind: ${item.kind}`,
            `communityIds: ${communityIds}`,
            `summary: ${redactContacts(item.summary)}`,
            `statement: ${redactContacts(signal.statement)}`,
          ].join("\n"),
        );
      }
    }
  }
  return blocks.join("\n\n");
}

function allowedEvidenceIds(candidates: CandidateContext[]): Set<string> {
  const ids = new Set<string>();
  for (const candidate of candidates) {
    for (const signal of candidate.signals) {
      for (const item of signal.evidence) ids.add(item.id);
    }
  }
  return ids;
}

function evidenceIdsInRecall(text: string, allowed: Set<string>): string[] {
  const normalized = text.replace(/evidenceId:\s+/g, "evidenceId:");
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const match of normalized.matchAll(EVIDENCE_ID)) {
    const id = match[1];
    if (!id || !allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= MAX_IDS) break;
  }
  return ids;
}

const RECALL_ATTEMPTS = 4;
const RECALL_DELAYS_MS = [0, 750, 1500, 3000];

export async function pauseForRecall(ms: number, signal: AbortSignal): Promise<void> {
  if (ms === 0 || signal.aborted) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function retrieveEvidence(args: {
  goal: string;
  communityIds: string[];
  candidates: CandidateContext[];
  transport: CogneeTransport;
  signal: AbortSignal;
  indexed?: Set<string>;
  pause?: (ms: number, signal: AbortSignal) => Promise<void>;
}): Promise<MemoryResult> {
  const pause = args.pause ?? pauseForRecall;
  const evidenceIds = localEvidenceIds(args.goal, args.candidates);
  if (!args.transport.configured) {
    return { backend: "local", evidenceIds, fallbackReason: "cognee_not_configured" };
  }

  const dataset = datasetName(args.communityIds, contextRevision(args.candidates));
  if (!args.indexed?.has(dataset)) {
    const remembered = await args.transport.remember(dataset, indexText(args.candidates), args.signal);
    if (!remembered.ok) {
      return { backend: "local", evidenceIds, fallbackReason: "cognee_remember_failed" };
    }
    args.indexed?.add(dataset);
  }

  let recalled = await args.transport.recall(dataset, args.goal, args.signal);
  for (let attempt = 1; attempt < RECALL_ATTEMPTS && !recalled.ok && recalled.retryable; attempt += 1) {
    try {
      await pause(RECALL_DELAYS_MS[attempt] ?? 3000, args.signal);
    } catch {
      break;
    }
    recalled = await args.transport.recall(dataset, args.goal, args.signal);
  }
  if (!recalled.ok) {
    return { backend: "local", evidenceIds, fallbackReason: "cognee_recall_failed" };
  }

  const fromCognee = evidenceIdsInRecall(recalled.text, allowedEvidenceIds(args.candidates));
  if (fromCognee.length === 0) {
    return { backend: "local", evidenceIds, fallbackReason: "cognee_no_intersection" };
  }
  return { backend: "cognee", evidenceIds: fromCognee };
}
