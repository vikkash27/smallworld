# Small World — team handoff

Start with **PRD.md**. It supersedes the earlier Relay plan.

## Assign one owner to each track

- **Track A: Discovery & community interface** — give the teammate `tracks/TRACK_A_DISCOVERY.md`.
- **Track B: Context & intelligence** — give the teammate `tracks/TRACK_B_INTELLIGENCE.md`.
- **Track C: Platform & integration** — give the teammate `tracks/TRACK_C_PLATFORM.md`. This person is also integration lead.

- **Track D: Circle creation & participation interface** — give the teammate `tracks/TRACK_D_CIRCLES.md`.

Send each teammate this entire folder so everyone has the PRD, frozen contracts, fixture, and visual mockups.

## First 10–15 minutes

C creates one baseline repository commit with tooling, `src/shared/contracts.ts` copied from `shared/contracts.ts`, shared fixtures, and reserved directories. All teammates branch from that same commit. Once frozen, do not change shared types independently.

A owns discovery/community UI. D owns circle/invitation/contribution UI. Both use HTTP APIs and read-only shared primitives. B owns `/api/intelligence` and calls C's typed PlatformPort. C owns `/api/platform`, all SQL/storage/auth, and root configuration. There are no shared editable feature files after bootstrap.

The four “parallel tracks” are implementation ownership tracks; the hackathon entry is **Track 2 — Know Your Members**.

## Visual direction

Open `mockups/01-discover.png`, `02-communities.png`, and `03-circle.png`. Editable SVG versions are included. Implement their hierarchy, strong typography, electric blue, and single-action states. Keep evidence behind Why?. The visuals contain fictional sample people and flows; no real messages were imported.

## Core demo

Goal → three grounded people → circle purpose/activity → create invitations → two people join → host confirms first activity → circle active.

P0 uses opt-in contributions/fictional data. Cognee Cloud credits are available: B owns the intended memory/retrieval adapter, with an explicit local fallback. Historical chat import, a visible graph, and speaker mode can follow the full loop.

## Submission

Public GitHub repository with compatible approved LICENSE, runnable setup/seed, and a video under three minutes. Code freeze: 21:50 Europe/London, 22 October 2026. Keep all private chat exports, credentials, and contact data out of git.

This package is a specification, contract, fixtures, and mockups. It is not a runnable implementation.
