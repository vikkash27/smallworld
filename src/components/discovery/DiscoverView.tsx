"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ApiFailure,
  BootstrapResponse,
  DiscoverRequest,
  DiscoverResponse,
  Id,
  PersonRecommendation,
} from "@/shared/contracts";
import { circleHandoffPath, discover, type DiscoveryResult } from "@/ui/discovery/client";
import { formatHistoryTime, loadHistory, rememberSearch, saveHistory, type HistoryEntry } from "./history";
import { ResultGraph } from "./ResultGraph";
import { WhyDrawer } from "./WhyDrawer";

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; response: DiscoverResponse; goal: string }
  | { kind: "empty"; response: DiscoverResponse; goal: string }
  | { kind: "error"; error: ApiFailure["error"] };

function peopleHeading(count: number): string {
  return count === 1 ? "1 person for this goal" : `${count} people for this goal`;
}

function namesFor(ids: Id[], bootstrap: BootstrapResponse): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const c = bootstrap.communities.find((x) => x.id === id);
    if (c) out.push(c.name);
  }
  return out;
}

export function DiscoverView(props: {
  bootstrap: BootstrapResponse;
  runDiscover?: (input: DiscoverRequest) => Promise<DiscoveryResult>;
  initialGoal?: string;
}) {
  const { bootstrap, initialGoal } = props;
  const run = props.runDiscover ?? discover;

  const [goal, setGoal] = useState(initialGoal ?? "");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [whyPerson, setWhyPerson] = useState<PersonRecommendation | null>(null);
  const requestSeq = useRef(0);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const search = useCallback(
    async (rawGoal: string) => {
      const trimmed = rawGoal.trim();
      if (!trimmed) return;
      const seq = ++requestSeq.current;
      setWhyPerson(null);
      setState({ kind: "loading" });
      let result: DiscoveryResult;
      try {
        result = await run({
          goal: trimmed,
          communityIds: bootstrap.allowedCommunityIds,
          mode: "connections",
        });
      } catch {
        if (seq !== requestSeq.current) return;
        setState({
          kind: "error",
          error: { code: "PROVIDER_UNAVAILABLE", message: "The search request failed unexpectedly.", retryable: true },
        });
        return;
      }
      if (seq !== requestSeq.current) return;
      if (!result.ok) {
        setState({ kind: "error", error: result.error });
        return;
      }
      const response = result.data;
      if (response.status === "empty" || response.people.length === 0) {
        setState({ kind: "empty", response, goal: trimmed });
      } else {
        setState({ kind: "ready", response, goal: trimmed });
      }
      setHistory((current) => {
        const next = rememberSearch(current, { goal: trimmed, response });
        saveHistory(next);
        return next;
      });
    },
    [run, bootstrap.allowedCommunityIds],
  );

  const openHistory = useCallback((entry: HistoryEntry) => {
    setGoal(entry.goal);
    setWhyPerson(null);
    if (entry.response.status === "empty" || entry.response.people.length === 0) {
      setState({ kind: "empty", response: entry.response, goal: entry.goal });
    } else {
      setState({ kind: "ready", response: entry.response, goal: entry.goal });
    }
  }, []);

  function startNew() {
    setGoal("");
    setWhyPerson(null);
    setState({ kind: "idle" });
    document.getElementById("goal")?.focus();
  }

  const loading = state.kind === "loading";
  const responseMode =
    state.kind === "ready" || state.kind === "empty" ? state.response.dataMode : null;
  const activeSearchId = state.kind === "ready" || state.kind === "empty" ? state.response.searchId : null;
  const isSample = bootstrap.dataMode === "sample" || responseMode === "sample";

  function closeWhy() {
    setWhyPerson(null);
    const opener = openerRef.current;
    if (opener) requestAnimationFrame(() => opener.isConnected && opener.focus());
  }

  return (
    <section aria-labelledby="discover-title">
      <h1
        id="discover-title"
        className="sw-headline"
        style={{
          margin: 0,
          fontSize: "clamp(38px, 2.6vw + 26px, 64px)",
          lineHeight: 1.04,
          letterSpacing: "-0.035em",
          fontWeight: 700,
        }}
      >
        Find your people.
        <br />
        Start something.
      </h1>
      <p className="sw-sub" style={{ margin: "16px 0 0", fontSize: 18, color: "#55555D" }}>
        A shared goal. A good reason to meet.
      </p>

      <div className="sw-discover">
        <aside className="sw-history" aria-label="Search history">
          <h2 className="sw-history-label">History</h2>
          <button type="button" className="sw-history-new" onClick={startNew}>
            New goal
          </button>
          {history.length === 0 ? (
            <p className="sw-history-empty">Goals you search stay on this device.</p>
          ) : (
            <ul className="sw-history-list">
              {history.map((entry) => (
                <li key={entry.searchId}>
                  <button
                    type="button"
                    className="sw-history-item"
                    aria-current={entry.searchId === activeSearchId ? "true" : undefined}
                    onClick={() => openHistory(entry)}
                  >
                    <span className="sw-history-goal">{entry.goal}</span>
                    <time className="sw-history-time" dateTime={entry.at}>
                      {formatHistoryTime(entry.at)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="sw-discover-main">
      <form
        className="sw-search"
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading) void search(goal);
        }}
      >
        <label htmlFor="goal" className="sw-label" style={{ fontWeight: 600, fontSize: 15 }}>
          What do you want to build?
        </label>
        <div className="sw-search-row">
          <input
            id="goal"
            name="goal"
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="I want to build warehouse robotics with people in London."
            autoComplete="off"
            style={{
              minWidth: 0,
              minHeight: 52,
              boxSizing: "border-box",
              padding: "0 16px",
              font: "inherit",
              fontSize: 16,
              color: "#111113",
              background: "#FFFFFF",
              border: "1px solid #DEDEE5",
              borderRadius: 12,
            }}
          />
          <button
            type="submit"
            disabled={loading}
            className="sw-btn sw-btn-brand"
            style={{
              minHeight: 52,
              padding: "0 24px",
              border: 0,
              borderRadius: 12,
              background: "#4334F5",
              color: "#FFFFFF",
              font: "inherit",
              fontWeight: 600,
              fontSize: 16,
              whiteSpace: "nowrap",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Finding people…" : "Find people"}
          </button>
        </div>
      </form>

      {isSample ? (
        <div className="sw-search-meta">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              border: "1px dashed #55555D",
              borderRadius: 999,
              fontWeight: 500,
              color: "#111113",
            }}
          >
            Sample context
          </span>
        </div>
      ) : null}

      {state.kind === "ready" ? (
        <ReadyResults
          bootstrap={bootstrap}
          goal={state.goal}
          response={state.response}
          onWhy={(person, opener) => {
            openerRef.current = opener;
            setWhyPerson(person);
          }}
        />
      ) : null}

      {state.kind === "empty" ? (
        <div
          role="status"
          style={{
            marginTop: 48,
            border: "1px solid #DEDEE5",
            borderRadius: 12,
            padding: 32,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            maxWidth: 720,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22 }}>No one matched this goal yet.</h2>
          <p style={{ margin: 0, color: "#55555D", fontSize: 15 }}>
            {state.response.message && state.response.message !== "No one matched this goal yet."
              ? state.response.message
              : "We only suggest people we have a real reason for. Try a broader goal, or start from a community that already exists."}
          </p>
          <Link
            href="/communities"
            style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", minHeight: 44, fontWeight: 600 }}
          >
            Browse communities
          </Link>
        </div>
      ) : null}

      {state.kind === "error" ? (
        <div
          role="alert"
          style={{
            marginTop: 48,
            border: "1px solid #DEDEE5",
            borderRadius: 12,
            padding: 32,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            maxWidth: 720,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "#55555D", letterSpacing: "0.04em" }}>{state.error.code}</div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Search couldn&apos;t finish.</h2>
          <p style={{ margin: 0, color: "#55555D", fontSize: 15 }}>{state.error.message}</p>
          {state.error.retryable ? (
            <button
              type="button"
              onClick={() => void search(goal)}
              style={{
                alignSelf: "flex-start",
                minHeight: 44,
                padding: "0 20px",
                borderRadius: 10,
                border: "1px solid #111113",
                background: "#FFFFFF",
                color: "#111113",
                font: "inherit",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
        </div>
      </div>

      {whyPerson ? (
        <WhyDrawer
          person={whyPerson}
          communityNames={namesFor(whyPerson.member.communityIds, bootstrap).join(" · ")}
          onClose={closeWhy}
        />
      ) : null}
    </section>
  );
}

function ReadyResults(props: {
  bootstrap: BootstrapResponse;
  goal: string;
  response: DiscoverResponse;
  onWhy: (person: PersonRecommendation, opener: HTMLElement) => void;
}) {
  const { bootstrap, goal, response, onWhy } = props;
  const people = response.people;
  const graphCommunities = useMemo(() => {
    const seen = new Map<string, string>();
    for (const person of people) {
      for (const id of person.member.communityIds) {
        if (seen.has(id)) continue;
        const name = bootstrap.communities.find((community) => community.id === id)?.name;
        if (name) seen.set(id, name);
      }
    }
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [people, bootstrap.communities]);
  const fits = response.communities
    .map((fit) => ({ fit, name: bootstrap.communities.find((c) => c.id === fit.communityId)?.name ?? null }))
    .filter((x): x is { fit: (typeof response.communities)[number]; name: string } => x.name !== null);
  const draft = response.circleDraft;

  return (
    <div style={{ marginTop: 48 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 22, letterSpacing: "-0.01em" }}>{peopleHeading(people.length)}</h2>
      <p style={{ margin: "0 0 16px", fontSize: 14, color: "#55555D" }}>Linked by the communities they share.</p>
      <ResultGraph goal={goal} people={people} communities={graphCommunities} onWhy={onWhy} />

      {fits.length > 0 ? (
        <section aria-labelledby="community-fit-title" style={{ marginTop: 24 }}>
          <h3
            id="community-fit-title"
            style={{
              margin: "0 0 12px",
              fontSize: 13,
              fontWeight: 600,
              color: "#55555D",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Communities that fit
          </h3>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {fits.map(({ fit, name }) => (
              <li
                key={fit.communityId}
                style={{ border: "1px solid #DEDEE5", borderRadius: 12, padding: "16px 24px", display: "flex", flexDirection: "column", gap: 4 }}
              >
                <div style={{ fontSize: 18, fontWeight: 600 }}>{name}</div>
                <div style={{ fontSize: 15, color: "#55555D" }}>{fit.reason}</div>
                <a
                  href={fit.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", minHeight: 44, fontWeight: 600 }}
                >
                  Source
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {draft !== null ? (
        <div
          style={{
            marginTop: 24,
            border: "1px solid #DEDEE5",
            borderRadius: 12,
            padding: "20px 24px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "16px 24px",
          }}
        >
          <div style={{ flex: "999 1 320px", minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#55555D",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Start a circle
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{draft.title}</div>
            <div style={{ fontSize: 15, color: "#55555D" }}>First activity: {draft.activity.title}</div>
          </div>
          <Link
            href={circleHandoffPath(response.searchId)}
            style={{
              flex: "1 1 200px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 52,
              padding: "0 24px",
              borderRadius: 12,
              background: "#111113",
              color: "#FFFFFF",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Bring us together
          </Link>
        </div>
      ) : (
        <p style={{ margin: "24px 0 0", fontSize: 15, color: "#55555D" }}>
          A circle needs a clearer shared goal. Try describing what you want to build together.
        </p>
      )}
    </div>
  );
}
