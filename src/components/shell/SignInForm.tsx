"use client";

import { useState, type FormEvent } from "react";

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body?.error?.message) return body.error.message;
  } catch {
    // fall through to generic message
  }
  return `Sign-in failed (HTTP ${res.status}).`;
}

export function SignInForm() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      setError(await readErrorMessage(res));
    } catch {
      setError("Could not reach the server. Try again.");
    }
    setBusy(false);
  }

  return (
    <div className="sw-shell">
      <form
        onSubmit={onSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: 420,
        }}
      >
        <label htmlFor="sw-organiser-password" className="sw-label">
          Organiser password
        </label>
        <input
          id="sw-organiser-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby={error ? "sw-signin-error" : undefined}
          aria-invalid={error ? true : undefined}
          style={{
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
        {error ? (
          <p
            id="sw-signin-error"
            role="alert"
            style={{ margin: 0, fontSize: 15, color: "#B3261E" }}
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="sw-btn sw-btn-brand"
          style={{ opacity: busy ? 0.7 : 1 }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
