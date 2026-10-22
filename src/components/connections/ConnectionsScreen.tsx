"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import { SignInForm } from "@/components/shell/SignInForm";
import { GroupPicker } from "./GroupPicker";
import type {
  ConnectionDetail,
  Selection,
} from "../../../convex/whatsapp/contracts";
import s from "./connections.module.css";
type Snapshot = {
  connections: ConnectionDetail[];
  workerConfigured: boolean;
  persistent: boolean;
};
class CallError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function call<T>(
  path = "",
  method = "GET",
  input?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/platform/whatsapp/connections${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: input === undefined ? undefined : JSON.stringify(input),
    signal,
  });
  const result = await response.json();
  if (!response.ok)
    throw new CallError(
      result.error?.message ?? "Connection request failed",
      response.status,
    );
  return result.data as T;
}
function PairingCode({
  value,
  expiresAt,
}: {
  value: string;
  expiresAt: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [expired, setExpired] = useState(Date.now() >= expiresAt);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setExpired(Date.now() >= expiresAt);
    setFailed(false);
    if (canvas.current)
      void QRCode.toCanvas(canvas.current, value, {
        width: 260,
        margin: 3,
        errorCorrectionLevel: "M",
      }).catch(() => setFailed(true));
    const timer = setTimeout(
      () => setExpired(true),
      Math.max(0, expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [value, expiresAt]);
  return expired || failed ? (
    <p role="status">
      {failed
        ? "The pairing code could not be rendered."
        : "Waiting for a fresh pairing code…"}
    </p>
  ) : (
    <canvas
      ref={canvas}
      className={s.qr}
      role="img"
      aria-label="Scan this QR code using WhatsApp Linked devices"
    />
  );
}
const statusText: Record<string, string> = {
  connecting: "Connecting",
  pairing: "Scan to connect",
  connected: "WhatsApp connected",
  disconnected: "Disconnected",
  failed: "Connection needs attention",
};
export function ConnectionsScreen() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [error, setError] = useState<string | null>(null);
  const [auth, setAuth] = useState(false),
    [busy, setBusy] = useState(false),
    [focused, setFocused] = useState<string | null>(null);
  const mutating = useRef(false),
    mounted = useRef(true);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const result = await call<Snapshot>("", "GET", undefined, signal);
    if (mounted.current) {
      setSnapshot(result);
      setAuth(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout>,
      controller: AbortController | undefined,
      stopped = false;
    const tick = async () => {
      if (stopped) return;
      controller = new AbortController();
      try {
        if (!document.hidden) await refresh(controller.signal);
      } catch (e) {
        if (!stopped && !controller.signal.aborted) {
          if (e instanceof CallError && e.status === 401) setAuth(true);
          else
            setError(
              e instanceof Error ? e.message : "Could not load connections",
            );
        }
      }
      if (!stopped) timer = setTimeout(() => void tick(), 2500);
    };
    void tick();
    return () => {
      stopped = true;
      mounted.current = false;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [refresh]);
  async function mutate(path: string, method: string, input?: unknown) {
    if (mutating.current) return;
    mutating.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await call<ConnectionDetail>(path, method, input);
      if (mounted.current) setFocused(result.id);
      await refresh();
    } catch (e) {
      if (mounted.current) {
        if (e instanceof CallError && e.status === 401) setAuth(true);
        setError(e instanceof Error ? e.message : "Connection request failed");
      }
    } finally {
      mutating.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const connection =
    snapshot?.connections.find((c) => c.id === focused) ??
    snapshot?.connections.find((c) => c.desired !== "disconnected") ??
    snapshot?.connections[0];
  return (
    <main className={s.page}>
      <Link href="/communities" className={s.back}>
        Back to communities
      </Link>
      <div className={s.heading}>
        <h1>
          Your communities,
          <br />
          connected.
        </h1>
        <p>
          Bring the useful conversations into Small World.
          <br />
          Start with the groups you choose.
        </p>
      </div>
      {error && (
        <div role="alert" className={s.error}>
          {error}
          <button
            onClick={() => {
              setError(null);
              void refresh().catch((e) => setError(e.message));
            }}
          >
            Retry
          </button>
        </div>
      )}
      {auth ? (
        <SignInForm />
      ) : !snapshot ? (
        <p role="status">Loading connections…</p>
      ) : (
        <>
          {!snapshot.workerConfigured && (
            <p className={s.notice}>
              WhatsApp pairing is not configured on this server yet. A
              persistent worker and Convex backend are required.
            </p>
          )}
          {snapshot.connections.length > 1 && (
            <div className={s.tabs} aria-label="Your connections">
              {snapshot.connections.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setFocused(c.id)}
                  aria-pressed={connection?.id === c.id}
                >
                  Connection {i + 1}
                </button>
              ))}
            </div>
          )}
          {!connection || connection.desired === "disconnected" ? (
            <section className={s.connect}>
              <div className={s.symbol} aria-hidden>
                ↗
              </div>
              <h2>Connect WhatsApp.</h2>
              <p>
                Scan a code with WhatsApp, then choose the groups to integrate.
              </p>
              <button
                className={s.primary}
                disabled={busy || !snapshot.workerConfigured}
                onClick={() => void mutate("", "POST")}
              >
                {busy ? "Starting…" : "Connect WhatsApp"}
              </button>
              <p className={s.note}>
                Connect an account you control. This uses a linked device
                through an unofficial integration.
              </p>
              {connection?.desired === "disconnected" && (
                <p role="status">
                  Disconnection requested. The worker will revoke the linked
                  session. You can also remove it in WhatsApp → Linked devices.
                </p>
              )}
            </section>
          ) : (
            <div className={s.layout}>
              <section className={s.connection}>
                <p className={s.status} role="status">
                  <span
                    className={
                      connection.status === "connected" ? s.dotConnected : s.dot
                    }
                  />
                  {statusText[connection.status] ?? connection.status}
                </p>
                {connection.status === "pairing" ||
                connection.status === "connecting" ? (
                  <>
                    <h2>
                      Open WhatsApp
                      <br />
                      on your phone.
                    </h2>
                    <p>Go to Settings → Linked devices → Link a device.</p>
                    <div className={s.qrFrame}>
                      {connection.qr && connection.qrExpiresAt ? (
                        <PairingCode
                          key={connection.qrExpiresAt}
                          value={connection.qr}
                          expiresAt={connection.qrExpiresAt}
                        />
                      ) : (
                        <p role="status">Waiting for a pairing code…</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <h2>
                      {connection.desired === "paused"
                        ? "Sync paused."
                        : connection.status === "connected"
                          ? "Ready for your groups."
                          : "Reconnect your account."}
                    </h2>
                    <p>
                      {connection.errorCode === "LOGGED_OUT"
                        ? "WhatsApp signed this device out. Disconnect here, then pair a new connection."
                        : "Your selected groups control which conversations enter Small World."}
                    </p>
                  </>
                )}
                <div className={s.controls}>
                  {connection.status === "connected" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          `/${connection.id}/${connection.desired === "paused" ? "resume" : "pause"}`,
                          "POST",
                        )
                      }
                    >
                      {connection.desired === "paused"
                        ? "Resume sync"
                        : "Pause sync"}
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => void mutate(`/${connection.id}`, "DELETE")}
                  >
                    Disconnect
                  </button>
                </div>
                <p className={s.note}>
                  The linked session can access the account. Small World imports
                  text only from selected groups. Disconnecting retains already
                  imported context.
                </p>
              </section>
              <div>
                {connection.status === "connected" && (
                  <GroupPicker
                    key={`${connection.id}:${connection.groups
                      .filter((g) => g.selected)
                      .map((g) => g.id)
                      .join(",")}`}
                    groups={connection.groups}
                    busy={busy}
                    onSave={(selection: Selection) =>
                      mutate(`/${connection.id}/selection`, "PUT", selection)
                    }
                  />
                )}
                {connection.consent && (
                  <section className={s.progress} aria-label="Import progress">
                    <h2>Import progress</h2>
                    <p className={s.count}>
                      {connection.importedCount}
                      <span> text messages imported</span>
                    </p>
                    <p>
                      {connection.earliestMessageAt
                        ? `Earliest supplied message: ${new Date(connection.earliestMessageAt).toLocaleString()}.`
                        : "Waiting for available messages from WhatsApp."}
                    </p>
                    <p className={s.note}>
                      History coverage may be partial. Imported text is staged;
                      profile extraction, approval and Cognee indexing are not
                      enabled in this connection preview.
                    </p>
                  </section>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
