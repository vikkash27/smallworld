# Track D — circles, invitations, participation

Everything here sits inside Track D's owned paths. Copy these folders into the repo after C's baseline commit:

```
src/app/(product)/circles/**      src/components/circles/**
src/app/(product)/invite/**       src/ui/circles/**
tests/circle-ui/**
```

Nothing outside those paths is touched. Imports of the shared contract are relative (`../../shared/contracts`), so no alias convention is assumed.

## Status

| Done (P0) | Not done |
|---|---|
| `/circles/new`, `/circles`, `/circles/[id]`, `/invite/[token]` | `/contribute/[token]` (P1) |
| Mock client that enforces the PRD rules; live client for C's API | Login screen (nobody owns it, see below) |
| Initials circles for every member, as in the mockups | Live client run against C's real API |
| 42 unit tests, strict typecheck, `next build` on the baseline | Procedural avatars (deferred, see below) |

Verified in a real browser on a throwaway Next 15 / React 19 harness: create circle → copy links → two recipients join on a 360px phone view → creator view updates → confirm activity → ACTIVE; plus expired, invalid, empty and missing-search states and no horizontal overflow at 360px. **Not verified against C's backend, because it doesn't exist yet.**

Mock mode is the default (`NEXT_PUBLIC_DATA_MODE` unset or `mock`) and shows a visible "Mock data" badge. Set `NEXT_PUBLIC_DATA_MODE=live` to use C's API. A failing live call shows an error; it never falls back to mock. Mock state lives in `localStorage`, so a circle made in one tab can be joined from another. Magic mock tokens: `/invite/demo-ok`, `/invite/demo-expired`; mock searches: `demo-search-robotics` (default), `demo-search-empty`, `demo-search-expired`.

## Needs from C (shared files)

1. **No new dependencies.** D adds nothing to `package.json`; it builds on the baseline as is.
2. **Endpoint examples and invitation URL shape**, ideally with the real response for each endpoint in the PRD table.
3. **Send `Cache-Control: no-store` on `/api/platform/invitations/*` and `/invite/*`.** Metadata already sets `noindex` and `referrer: no-referrer`.
4. **`APP_BASE_URL` must be reachable from a phone** (deployed URL or tunnel). If it is `localhost`, the two-phone demo cannot work.

## Needs from A

- **Hide the organiser nav on `/invite/*` and `/contribute/*`.** D may not add a layout, and the recipient page should be the phone view in the mockup, not the organiser shell.
- URL-encode `searchId` in the `/circles/new?searchId=` link.

## Avatars: deferred on purpose

An earlier version drew each member with Bible Strong Avatar Lab (`@bible-strong/avatar-react` and `avatar-core`). Those packages are **AGPL-3.0-only**, and the repo is MIT, so they were removed to keep the branch mergeable. Members now appear as initials circles from the mockups. A member who hasn't agreed to be named is drawn as a neutral "?".

To bring the avatars back, C would have to switch the root `LICENSE` and `package.json` to AGPL-3.0 (an allowed submission licence) and add the two packages. The avatar version is in git history on this branch (commit `5003660`).

## Flaws found in the spec, and what this code does

| # | Flaw | Fix here | Owner to confirm |
|---|---|---|---|
| 1 | Minimum members can exceed host + invitees, so a circle can never go active | Form blocks it and lowers the minimum as guests are removed | C: reject server-side too |
| 2 | Activity times in London time and the clocks go back on **25 Oct 2026**; a fixed offset is wrong afterwards | `london-time.ts` converts with Intl, rejects non-existent times; tested either side of the change | — |
| 3 | No idempotency on `POST /circles`; a double click or retry creates two circles with two sets of links | In-flight guard, `router.replace` so Back can't resubmit, and on a network failure the UI says "check Your circles first" | C: accept an idempotency key |
| 4 | Invitation links are returned once and there is no re-issue endpoint; a lost link is unrecoverable | Links kept in `sessionStorage` for this tab only, with a clear warning | C: add revoke-and-reissue |
| 5 | **Nobody owns the login screen**, but every creator page needs a session | 401 shows "sign in again" with a link home | Team: assign (A or C) |
| 6 | `RosterMember.id` for a member who hid their name is probably their member id; the creator could join it against `invitations[].member.id` and de-anonymise them | UI never joins the two and draws hidden members as "?" | **C: make roster ids opaque** |
| 7 | `GET` invitation: the spec says 410 for expired, but `InvitationView` also has `expired`/`revoked` statuses | UI handles both shapes | C: pick one |
| 8 | Ambiguous mutation failure (timeout after the server applied it) | Join re-reads the invitation before offering a retry, so it never blindly double-submits | — |
| 9 | Poll responses can arrive out of order or overwrite a just-saved edit | Sequential poller (no overlap), pauses when the tab is hidden, backs off on errors, an epoch guard drops stale responses | — |
| 10 | Clipboard API fails on plain-http LAN addresses, which is how phones test | Falls back to select-and-copy, plus a native Share button where available | — |
| 11 | Length and capacity limits are not in the contract | Assumed: title 80, purpose 400, activity 80/500, capacity ≤ 12. The server's `BAD_INPUT` message is shown if it disagrees | C |
| 12 | Form requires a seat for the host and every invitee; the spec allows over-inviting (first come, first served) | Deliberately stricter, to avoid inviting people who can't join. Easy to relax in `validation.ts` | D |
| 13 | The page `<title>`/URL of an invitation is a private capability | `noindex`, `no-referrer` | C: `no-store` header |

## Behaviour worth knowing

- "Active" is shown only from the server's `status`; the UI never computes it. Pending invitations are never counted as members. The host is member one.
- The name-on-roster checkbox is separate, unchecked, and only sent with a join.
- Declining takes a second, deliberate click.
- "Joining confirms this invitation link, not your identity."
- A time that is still undecided reads "Time to be agreed", never as a booking.
- Editing the activity is only offered before it is confirmed, because the contract doesn't say what un-confirming does to an active circle.
