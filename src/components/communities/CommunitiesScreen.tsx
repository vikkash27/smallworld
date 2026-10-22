"use client";

import { useEffect, useState } from "react";
import type { ApiFailure, Community } from "@/shared/contracts";
import { loadCommunities } from "@/ui/discovery/client";
import { CommunitiesView } from "./CommunitiesView";

type State =
  | { phase: "loading" }
  | { phase: "error"; error: ApiFailure["error"] }
  | { phase: "ready"; communities: Community[] };

export function CommunitiesScreen() {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadCommunities()
      .then((res) => {
        if (cancelled) return;
        setState(res.ok ? { phase: "ready", communities: res.data } : { phase: "error", error: res.error });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          phase: "error",
          error: { code: "PROVIDER_UNAVAILABLE", message: "Communities could not be loaded.", retryable: true },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.phase === "loading") {
    return (
      <p className="m-0 text-[15px] text-[#55555D]" role="status">
        Loading…
      </p>
    );
  }

  if (state.phase === "error") {
    const { error } = state;
    return (
      <div role="alert" className="flex max-w-[720px] flex-col gap-3 rounded-xl border border-solid border-[#DEDEE5] p-8">
        <div className="text-[13px] font-semibold tracking-[0.04em] text-[#55555D]">{error.code}</div>
        <p className="m-0 text-[15px] text-[#55555D]">{error.message}</p>
        {error.retryable && (
          <button
            type="button"
            onClick={() => {
              setState({ phase: "loading" });
              setAttempt((n) => n + 1);
            }}
            className="min-h-11 cursor-pointer self-start rounded-[10px] border border-solid border-[#111113] bg-white px-5 font-[inherit] font-semibold text-[#111113]"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return <CommunitiesView communities={state.communities} />;
}
