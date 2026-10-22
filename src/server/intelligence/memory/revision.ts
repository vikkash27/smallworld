import { createHash } from "node:crypto";
import type { CandidateContext } from "../../../shared/contracts";

function byId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Canonical hash of the candidate set. Order of the input array does not matter. */
export function contextRevision(candidates: CandidateContext[]): string {
  const canonical = [...candidates]
    .sort((a, b) => byId(a.member.id, b.member.id))
    .map((candidate) => ({
      member: { id: candidate.member.id },
      communityIds: [...candidate.member.communityIds].sort(byId),
      currentAvailability: candidate.currentAvailability,
      signals: [...candidate.signals]
        .sort((a, b) => byId(a.id, b.id))
        .map((signal) => ({
          id: signal.id,
          kind: signal.kind,
          statement: signal.statement,
          evidenceIds: signal.evidence.map((item) => item.id).sort(byId),
        })),
    }));
  return sha256(JSON.stringify(canonical));
}

/** Scope-partitioned dataset name. Only lowercase letters, digits, and hyphens. */
export function datasetName(communityIds: string[], revision: string): string {
  const material = `${[...communityIds].sort(byId).join(",")}|${revision}`;
  return `sw-${sha256(material).slice(0, 24)}`;
}
