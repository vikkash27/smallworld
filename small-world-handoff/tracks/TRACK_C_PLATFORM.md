# Track C — Platform & integration (integration lead)

Read PRD.md sections 2, 7–8, 10–19 and shared/contracts.ts. Your objective is reliable state, access control, and a circle people can actually join.

## You own

`src/app/api/platform/**`, `src/server/platform/**`, `tests/platform/**`, `supabase/**`, `scripts/**`, root package/lock/build/deploy configuration, README, LICENSE, `.env.example`.

You create the shared contracts/fixtures/ui-kit baseline and apply agreed amendments after freeze. Root layout/styles transfer to A after bootstrap; D owns circle-specific UI only. Do not edit A's discovery/shell, D's circle/invitation UI, or B's prompts/matching/routes.

## First 10–15 minutes

1. Scaffold one Next.js/TypeScript application, Tailwind, Lucide, validation library, test runner; pin lockfile.
2. Copy shared/contracts.ts to src/shared/contracts.ts and add shared fixtures.
3. Reserve all four ownership paths; one alias convention; no conflicting root pages.
4. Add typed public port and auth guard exports; provide fixture implementation immediately.
5. Commit/push a baseline. All four teammates branch from this commit. Coordinate later dependency/contract changes in small commits.

## Public server exports

`src/server/platform/public.ts` exports requireOrganizer(request): Promise<Viewer> and getPlatformPort(): PlatformPort. Never return a dummy authorised viewer in live mode. B must not need your database schema to call these.

## Platform delivery

- All migrations and DB client; context/member/evidence/search persistence too, not just circles.
- 12 listed communities with verified public links. Real participation status changes only after onboarding; fictional data mode explicit.
- Organiser signed server session, bootstrap, community list, scoped opt-in contribution intake.
- Postgres PlatformPort permission-filters contexts and stores validated search snapshots.
- GET /api/platform/searches/:id returns SearchPreviewResponse for viewer-owned nonexpired searches (A→D handoff).
- CreateCircle accepts only candidate IDs in a valid viewer-owned search; revalidate withdrawn signals.
- Creator host is member one; per-recipient hashed expiring tokens returned only once.
- Public preview contains no chat history, other private invitees, or tokens beyond its own URL.
- Explicit join/decline POST with atomic invitation transition and capacity check. Unique circle/member membership; duplicate responses idempotent.
- Activity confirmation + minimum accepted members governs active state.
- Creator list/detail polling APIs; sample-only reset.
- README/migrations/seed/env/LICENSE and deployment.

## Security and evidence

Service-role key stays server-side. RLS denies anonymous access to private tables; handlers enforce scope. GET must not accept invitations. Tokens are not verified personal identity. Roster visibility is separate opt-in. No raw tokens/source text in logs. Creator access to one circle must not reveal another workspace.

## Acceptance tests

GET safety; duplicate join; accept/decline race; two joins competing for final seat; expired/revoked capability; private data omitted; arbitrary member injection rejected; stale evidence rejected; active-state rule; fictional reset isolation; fresh clone setup.

## Integration cadence

T+15 baseline; T+45 port/directory; T+90 Postgres/search preview/circle create; T+130 complete joins; T+160 end-to-end deployed. Merge small commits from owned paths. Ask teammates for endpoint examples and known limitations. Do not defer integration until code freeze.

## Suggested agent instruction

Implement only Track C's owned paths. Bootstrap the frozen contract first and give A/B/D a working fixture interface immediately. Own all persistence and security, use atomic invitation/member transitions, and keep private source context out of public pages. Coordinate shared changes; do not implement teammates' feature logic. Finish reproducible deployment/setup and submission readiness.
