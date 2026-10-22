"use client";

import { ArrowDown } from "lucide-react";
import { type MouseEvent } from "react";
import { DiscoverScreen } from "@/components/discovery/DiscoverScreen";
import { FloatingTiles } from "./FloatingTiles";

const DISCOVER_ID = "discover";

/**
 * Landing hero followed by the discovery screen on the same page.
 * The CTA scrolls to the goal input. The demo is open — no password.
 */
export function LandingFlow() {
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
      <section className="sw-hero" aria-labelledby="hero-title">
        <div className="sw-hero-grid" aria-hidden="true" />
        <div className="sw-hero-glow" aria-hidden="true" />
        <FloatingTiles />
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
          <a
            href={`#${DISCOVER_ID}`}
            onClick={revealDiscover}
            className="sw-btn sw-btn-brand sw-hero-cta on-brand"
          >
            Find your people
            <ArrowDown aria-hidden size={18} strokeWidth={2.25} />
          </a>
        </div>
      </section>

      <div id={DISCOVER_ID} className="sw-shell sw-flow-discover" tabIndex={-1}>
        <DiscoverScreen />
      </div>
    </>
  );
}
