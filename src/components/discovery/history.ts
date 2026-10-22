import type { DiscoverResponse } from "@/shared/contracts";

const KEY = "smallworld.discover.history.v1";
const MAX_HISTORY = 24;

export type HistoryEntry = {
  searchId: string;
  goal: string;
  at: string;
  response: DiscoverResponse;
};

function isEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as HistoryEntry;
  return (
    typeof entry.searchId === "string" &&
    entry.searchId.length > 0 &&
    typeof entry.goal === "string" &&
    entry.goal.length > 0 &&
    typeof entry.at === "string" &&
    !!entry.response &&
    typeof entry.response === "object"
  );
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

export function rememberSearch(
  current: readonly HistoryEntry[],
  input: { goal: string; response: DiscoverResponse },
): HistoryEntry[] {
  const next: HistoryEntry = {
    searchId: input.response.searchId,
    goal: input.goal,
    at: new Date().toISOString(),
    response: input.response,
  };
  return [next, ...current.filter((entry) => entry.searchId !== next.searchId)].slice(0, MAX_HISTORY);
}

export function saveHistory(entries: readonly HistoryEntry[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // A full or blocked store should not fail the search the person just ran.
  }
}

export function formatHistoryTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
