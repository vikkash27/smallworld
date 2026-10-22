"use client";

import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { DiscoverScreen } from "@/components/discovery/DiscoverScreen";
import { loadBootstrap } from "@/ui/discovery/client";
import { FloatingTiles } from "./FloatingTiles";
import { HeroThemeToggle, useHeroTheme } from "./HeroThemeToggle";

type Session = "loading" | "ready" | "unauthenticated";

const DISCOVER_ID = "discover";

/**
 * Landing hero followed by the discovery screen on the same page. The CTA scrolls to the goal input;
 * without an organizer session it goes to /login and the discovery area is not rendered at all.
 */
export function LandingFlow() {
  const [session, setSession] = useState<Session>("loading");
  const [heroTheme, setHeroTheme] = useHeroTheme();

  useEffect(() => {
    let cancelled = false;
    // Memoised, so this shares the request AppShell and DiscoverScreen make.
    loadBootstrap().then(
      (res) => {
        if (cancelled) return;
        setSession(!res.ok && res.error.code === "UNAUTHENTICATED" ? "unauthenticated" : "ready");
      },
      () => {
        if (!cancelled) setSession("ready");
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  function revealDiscover(event: MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById(DISCOVER_ID);
    if (!target) return;
    event.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    const goal = document.getElementById("goal");
    (goal ?? target).focus({ preventScroll: true });
    history.replaceState(null, "", `#${DISCOVER_ID}`);
  }

  return (
    <>
      <section
        className={heroTheme === "light" ? "sw-hero sw-hero--light" : "sw-hero"}
        aria-labelledby="hero-title"
      >
        <div className="sw-hero-grid" aria-hidden="true" />
        <div className="sw-hero-glow" aria-hidden="true" />
        <FloatingTiles />
        <HeroThemeToggle theme={heroTheme} onChange={setHeroTheme} />
        <div className="sw-hero-content">
          <h1 id="hero-title" className="sw-hero-title">
            Find your people.
            <br />
            Start something together.
          </h1>
          <p className="sw-hero-sub">
            Enter a concrete goal. Get grounded intros to the right people from opt-in community
            context, then spin up a small circle that actually meets.
          </p>
          {session === "unauthenticated" ? (
            <Link href="/login" className="sw-btn sw-btn-brand sw-hero-cta on-brand">
              Find your people
              <ArrowRight aria-hidden size={18} strokeWidth={2.25} />
            </Link>
          ) : (
            <a
              href={`#${DISCOVER_ID}`}
              onClick={revealDiscover}
              className="sw-btn sw-btn-brand sw-hero-cta on-brand"
            >
              Find your people
              <ArrowDown aria-hidden size={18} strokeWidth={2.25} />
            </a>
          )}
        </div>
      </section>

      {session !== "unauthenticated" && (
        <div id={DISCOVER_ID} className="sw-shell sw-flow-discover" tabIndex={-1}>
          <DiscoverScreen />
        </div>
      )}
    </>
  );
}
