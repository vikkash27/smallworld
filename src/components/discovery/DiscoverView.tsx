"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import type {
  ApiFailure,
  BootstrapResponse,
  DiscoverRequest,
  DiscoverResponse,
  Id,
  PersonRecommendation,
} from "@/shared/contracts";
import { circleHandoffPath, discover, type DiscoveryResult } from "@/ui/discovery/client";
import { WhyDrawer } from "./WhyDrawer";
import { fitLabel } from "./labels";

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; response: DiscoverResponse }
  | { kind: "empty"; response: DiscoverResponse }
  | { kind: "error"; error: ApiFailure["error"] };

const MAX_PEOPLE = 3;

const CARD_BASE = {
  color: "#FFFFFF",
  borderRadius: 12,
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 16,
  minHeight: 280,
  boxSizing: "border-box",
} as const;

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
  const [whyPerson, setWhyPerson] = useState<PersonRecommendation | null>(null);
  const requestSeq = useRef(0);
  const openerRef = useRef<HTMLElement | null>(null);

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
        setState({ kind: "empty", response });
      } else {
        setState({ kind: "ready", response });
      }
    },
    [run, bootstrap.allowedCommunityIds],
  );

  const loading = state.kind === "loading";
  const searchingIn = namesFor(bootstrap.allowedCommunityIds, bootstrap);
  const responseMode =
    state.kind === "ready" || state.kind === "empty" ? state.response.dataMode : null;
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading) void search(goal);
        }}
        style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 10, maxWidth: 880 }}
      >
        <label htmlFor="goal" className="sw-label" style={{ fontWeight: 600, fontSize: 15 }}>
          What do you want to build?
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <input
            id="goal"
            name="goal"
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="I want to build warehouse robotics with people in London."
            autoComplete="off"
            style={{
              flex: "999 1 320px",
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
              flex: "1 1 160px",
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

      <div
        style={{
          marginTop: 20,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px 16px",
          fontSize: 14,
          color: "#55555D",
        }}
      >
        {isSample ? (
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
        ) : null}
        {searchingIn.length > 0 ? (
          <span style={{ marginLeft: "auto" }}>Searching in: {searchingIn.join(" · ")}</span>
        ) : null}
      </div>

      {state.kind === "idle" ? (
        <div
          style={{
            marginTop: 48,
            padding: 32,
            border: "1px dashed #DEDEE5",
            borderRadius: 12,
            color: "#55555D",
            fontSize: 15,
          }}
        >
          Describe a goal. We&apos;ll suggest up to three people from your communities, and why.
        </div>
      ) : null}

      {state.kind === "ready" ? (
        <ReadyResults
          bootstrap={bootstrap}
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
  response: DiscoverResponse;
  onWhy: (person: PersonRecommendation, opener: HTMLElement) => void;
}) {
  const { bootstrap, response, onWhy } = props;
  const people = response.people.slice(0, MAX_PEOPLE);
  const fits = response.communities
    .map((fit) => ({ fit, name: bootstrap.communities.find((c) => c.id === fit.communityId)?.name ?? null }))
    .filter((x): x is { fit: (typeof response.communities)[number]; name: string } => x.name !== null);
  const draft = response.circleDraft;

  return (
    <div style={{ marginTop: 48 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 22, letterSpacing: "-0.01em" }}>
        {people.length} people for this goal
      </h2>
      <div
        className="sw-people"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: 16,
        }}
      >
        {people.map((p, i) => {
          const lead = i === 0;
          const names = namesFor(p.member.communityIds, bootstrap).join(" · ");
          return (
            <article
              key={p.member.id}
              className={lead ? "sw-card-lead" : "sw-tile"}
              style={{ ...CARD_BASE, background: lead ? "#4334F5" : "#18181C" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div
                  aria-hidden="true"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.16)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                  }}
                >
                  {p.member.initials}
                </div>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.16)",
                  }}
                >
                  {fitLabel(p.fitType)}
                </span>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.02em" }}>{p.member.displayName}</h3>
                {names ? (
                  <p style={{ margin: "2px 0 0", fontSize: 14, color: lead ? "rgba(255,255,255,0.82)" : "#B4B4BC" }}>{names}</p>
                ) : null}
              </div>
              <p style={{ margin: 0, fontSize: 15, flex: "1 1 auto" }}>{p.reason}</p>
              <button
                type="button"
                className="on-brand"
                aria-haspopup="dialog"
                onClick={(e) => onWhy(p, e.currentTarget)}
                style={{
                  alignSelf: "flex-start",
                  minHeight: 44,
                  padding: "0 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.5)",
                  background: "transparent",
                  color: "#FFFFFF",
                  font: "inherit",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                Why this person?
              </button>
            </article>
          );
        })}
      </div>

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
