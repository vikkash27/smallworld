"use client";

import { useEffect, useState } from "react";
import type { ApiFailure, BootstrapResponse } from "@/shared/contracts";
import { loadBootstrap } from "@/ui/discovery/client";
import { DiscoverView } from "./DiscoverView";

type BootState =
  | { kind: "loading" }
  | { kind: "ready"; bootstrap: BootstrapResponse }
  | { kind: "error"; error: ApiFailure["error"] };

export function DiscoverScreen() {
  const [state, setState] = useState<BootState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadBootstrap().then(
      (res) => {
        if (cancelled) return;
        setState(res.ok ? { kind: "ready", bootstrap: res.data } : { kind: "error", error: res.error });
      },
      () => {
        if (cancelled) return;
        setState({
          kind: "error",
          error: { code: "PROVIDER_UNAVAILABLE", message: "Could not load your workspace.", retryable: true },
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <p className="sw-muted" style={{ margin: 0, fontSize: 15, color: "#55555D" }}>
        Loading…
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <div
        role="alert"
        style={{
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
        <p style={{ margin: 0, color: "#111113", fontSize: 15 }}>{state.error.message}</p>
      </div>
    );
  }

  return <DiscoverView bootstrap={state.bootstrap} />;
}
