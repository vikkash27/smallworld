import type { FitType } from "@/shared/contracts";

const FIT_LABELS: Record<FitType, string> = {
  experience: "Relevant experience",
  complementary_need: "Complementary need",
  collaborator: "Potential collaborator",
  peer: "Peer",
  speaker: "Speaker",
};

export function fitLabel(fit: FitType): string {
  return FIT_LABELS[fit];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** en-GB style date, e.g. "21 Oct 2026". Uses UTC so the day never shifts with the viewer's timezone. */
export function formatEvidenceDate(iso: string | null): string {
  if (iso === null) return "date unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "date unknown";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
