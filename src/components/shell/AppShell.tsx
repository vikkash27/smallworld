"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { loadBootstrap } from "@/ui/discovery/client";

type Session =
  | { state: "loading" }
  | { state: "ready"; initials: string }
  | { state: "unknown" };

async function ensureSession() {
  let result = await loadBootstrap();
  if (!result.ok && result.error.code === "UNAUTHENTICATED") {
    const opened = await fetch("/api/platform/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (opened.ok) result = await loadBootstrap();
  }
  return result;
}

const navBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 500,
};

const NAV = [
  { href: "/", label: "Discover", match: (p: string) => p === "/" },
  {
    href: "/communities",
    label: "Communities",
    match: (p: string) => p === "/communities" || p.startsWith("/communities/"),
  },
  {
    href: "/circles",
    label: "Your circles",
    match: (p: string) => p === "/circles" || p.startsWith("/circles/"),
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [session, setSession] = useState<Session>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    ensureSession()
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          const initials = result.data.viewer?.initials;
          setSession(
            initials ? { state: "ready", initials } : { state: "unknown" },
          );
        } else {
          setSession({ state: "unknown" });
        }
      })
      .catch(() => {
        if (!cancelled) setSession({ state: "unknown" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const initials = session.state === "ready" ? session.initials : null;

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", color: "#111113" }}>
      <header style={{ borderBottom: "1px solid #DEDEE5" }}>
        <div className="sw-header">
          <Link
            href="/"
            className="sw-header-brand"
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: "-0.02em",
              color: "#111113",
              textDecoration: "none",
            }}
          >
            smallworld
          </Link>
          <nav
            aria-label="Primary"
            className="sw-header-nav"
          >
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="sw-nav-link"
                  style={{
                    ...navBase,
                    color: active ? "#111113" : "#55555D",
                    background: active ? "#F0F0F4" : undefined,
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div
            role={initials ? "img" : undefined}
            aria-label={initials ? `Signed in as ${initials}` : undefined}
            aria-hidden={initials ? undefined : true}
            className="sw-header-avatar"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#18181C",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {initials}
          </div>
        </div>
      </header>
      {session.state === "loading" ? null : children}
    </div>
  );
}
