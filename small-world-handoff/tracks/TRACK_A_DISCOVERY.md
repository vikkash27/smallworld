# Track A — Discovery & community interface

Read PRD.md, shared/contracts.ts, and all mockups. Own the first half of the product: describe a goal, understand people, find a community.

## Exclusive ownership

- `src/app/(product)/page.tsx`
- `src/app/(product)/communities/**`
- `src/app/(product)/admin/context/**` (P1)
- `src/app/layout.tsx`, `src/app/globals.css` after bootstrap
- `src/components/shell/**`, `src/components/discovery/**`, `src/components/communities/**`
- `src/ui/discovery/**`, `tests/discovery-ui/**`

Never edit circle/invitation/contribution pages, APIs/server/SQL, C's tooling, D's styles, or frozen contracts/ui-kit. C commits shared amendments. No competing root `src/app/page.tsx`.

## Build sequence

1. Bold shell/design tokens matching mockup 01; electric blue, clear contrast, purposeful whitespace. Define minimal shared primitives during bootstrap, freeze them with C, then read-only use.
2. Mock/live discovery client adapter with exact shared DTOs.
3. Goal form, max three people, one useful reason each; Why? reveals evidence/caveats. No-match is valid.
4. Directory of all 12 communities, verified URLs, actual status, compact detail.
5. Bring us together navigates to `/circles/new?searchId=<encoded ID>`. This is the A→D seam. Do not implement D's review sheet or pass result JSON/private text in URL.
6. Optional context-review UI after P0.
7. Connect B discover/C bootstrap-directory, then mobile/accessibility/error checks.

## Acceptance

360/768/1440px without overflow; primary action obvious; evidence on demand; no persistent graph panel or dashboard metrics; mocked/live response shape identical; safe searchId-only handoff; provider errors visible, never hidden by fake data.

## Agent prompt

Implement only Track A's files from the PRD. Build a complete discovery/community UI against frozen mocks, then live adapters. Preserve bold visual hierarchy and one main action per state. Stop feature ownership at the searchId route handoff to D. Do not write backend or circle pages. Coordinate shared changes with C; finish with relevant UI checks and build/typecheck.
