# Track C implementation record

Owned source set: `src/app/api/platform`, `src/server/platform`, `convex`,
`tests/platform`, root configuration, README and env template. Contracts and
fixtures are frozen. Baseline had schema/seed only and no feature callers.
No graphify connection/artifacts are available; this is the manual source map.

Flow: route → signed session and zod validation → platform service →
admin-authenticated Convex internal query/mutation → scoped domain records.
Fixture adapter runs the same domain operations against isolated memory tables.
Inputs: trusted Viewer, validated DTOs, hashed capability tokens.
Outputs: frozen DTOs in request-ID envelopes. Important state: search ownership,
workspace/data mode, signal consent/approval, invitation status/expiry, unique
circle membership, accepted count, activity confirmation.

Plan:

1. Implement scoped seed/domain functions and both platform adapters.
2. Implement session guard, envelopes, validation, and all specified routes.
3. Exercise the vertical slice and security/state regressions; run build,
   typecheck and tests; document setup, clean the diff and commit locally.

Verification results and limitations are recorded below when complete.

## Verified outcome

- `npm test`: 29 tests pass across route harness, fixture runtime and convex-test.
- `npx tsc --noEmit`: passes.
- `npm run build`: passes; all 11 platform paths are dynamic API routes.
- `npm run platform:smoke`: real local Convex search/circle/preview/two joins,
  duplicate join and activation pass; anonymous internal reads are denied.
- Production Next HTTP smoke: session cookie, 12-community bootstrap, saved search,
  circle creation, public previews/joins, activation, 404 error envelope and demo
  reset pass against the real local backend.
- Frozen contracts/fixtures and Tracks A/B/D paths are unchanged.

Decisions: GET expiry is derived and returns 410 without writing an expired flag,
resolving the task's read-only GET requirement against lazy expiry wording.
The seed script computes the contribution HMAC on the server so Convex receives
only a hash; direct CLI seed calls must supply `contributionTokenHash`.
`convex-test@0.0.41` is compatible with the baseline's pinned Convex 1.31.7.

Scope limitations: one organizer/password per workspace, per-process login
throttling, manual link sharing, pending contribution review/onboarding and leave
flows delegated to later product work. Fixture mutations are process-local.
No deployment, push or merge was performed. Temporary HTTP/Convex processes are
stopped before task completion; `.env.local` and local deployment state stay
ignored and uncommitted. Cleanup removed unused schema exports and moved the
task record into the owned test directory; no unrelated files were removed.
