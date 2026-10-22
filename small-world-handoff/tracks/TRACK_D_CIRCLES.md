# Track D — Circle creation & participation interface

Read PRD.md sections 5–7 and 10–16, shared/contracts.ts, and mockup 03. Own the second half of the user journey: turn recommendations into a group that opts in and starts something.

## Exclusive ownership

- `src/app/(product)/circles/**` including `/circles/new`
- `src/app/(product)/invite/**`
- `src/app/(product)/contribute/**` (P1 UI)
- `src/components/circles/**`, `src/ui/circles/**`, `tests/circle-ui/**`

Never edit discovery/directory pages, root layout/global styles, API/server/SQL, package/lock/config, or frozen shared files. Use shared ui-kit read-only and owned CSS modules. Do not create a competing product layout.

## Handoff and APIs

A navigates to `/circles/new?searchId=<encoded ID>`. Read SearchPreviewResponse from `GET /api/platform/searches/:id`; do not rerun matching. The server derives the viewer. All other circle/invitation APIs are C-owned. You own your mock/live client adapter, not backend stubs.

## Build sequence

1. New-circle page from mocked SearchPreviewResponse: editable name, purpose, concrete first activity, selected candidate subset, capacity. Creator defaults to host; no assumed participant agreement.
2. POST CreateCircleRequest; show only returned invitation links in creator view, with explicit copy/manual sharing. Creating links is not sending messages.
3. Creator circles list/detail: pending/accepted states, acceptedCount includes host, activity confirmation, forming/active state from server.
4. Recipient phone page: read-only preview GET, explicit Join/Decline POST, separate unchecked roster-name consent.
5. Poll creator detail every three seconds while visible/forming; stop timers on unmount/background/archived state. Reconcile acceptedCount from response, not optimistic increment.
6. Handle bad/missing/expired search, invitation expiry/revocation, capacity conflicts, retries, duplicate responses.
7. Optional member contribution UI after core flow. Do not build extraction/review intelligence.
8. Swap to live C adapter and rehearse join on a second device.

## Acceptance

Complete flow works independently with mocks. Live adapter swap preserves props. Duplicate join never inflates count; pending never means joined; identity possession is not called verified identity; no public private-chat payload. “Active” appears only when server confirms host activity + minimum membership. Mobile 360px works without clipping and unknown time stays proposed/to be agreed.

## Agent prompt

Implement only Track D's owned circle, invitation, and contribution UI paths. Build against shared DTO mocks first. Consume A's searchId route handoff and C's APIs. Keep one clear action per state and follow the supplied bold mockup. Do not change root styles, discovery UI, server logic, or SQL. Report exact API expectations and finish the end-to-end phone join and creator update flow.
