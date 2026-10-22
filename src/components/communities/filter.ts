import type { Community, CommunityStatus } from "@/shared/contracts";

/** Case-insensitive substring match on name or any focus tag. Blank query returns all. */
export function filterCommunities(communities: Community[], query: string): Community[] {
  const q = query.trim().toLowerCase();
  if (!q) return communities;
  return communities.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.focusTags.some((tag) => tag.toLowerCase().includes(q)),
  );
}

export function statusLabel(status: CommunityStatus): "Listed" | "Participating" | "Connected" {
  switch (status) {
    case "participating":
      return "Participating";
    case "connected":
      return "Connected";
    default:
      return "Listed";
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** en-GB style date (e.g. "22 Oct 2026"), computed in UTC. Unparseable input is returned as-is. */
export function formatVerifiedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Hostname-based link label, e.g. "linkedin.com/company/unicorn-mafia". */
export function publicUrlLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return host + path;
  } catch {
    return url;
  }
}
