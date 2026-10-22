# Small World WhatsApp Integration Plan

Date: 22 October 2026

Goal: Let an organiser pair WhatsApp, select groups, import a bounded amount of available history, and continuously turn new messages into evidence-backed member context for discovery and circle formation.

Architecture: Keep the existing Next.js interface and Convex platform. Add a long-running Node.js WhatsApp worker. Store authoritative identity, consent, evidence and sync state in Convex; index approved, permission-filtered professional summaries in Cognee.

Baseline: GitHub `vikkash27/smallworld`, main commit `75e9a41`. Relevant existing files are `convex/schema.ts`, `src/server/platform/`, `src/server/intelligence/identity/`, `src/server/intelligence/memory/cognee.ts`, and `src/server/intelligence/memory/retrieve.ts`. Recheck main before implementation; the Downloads Track D checkout contains later work that must not be overwritten.

This document is a plan. No WhatsApp connection or product implementation has been created.

## Decisions and assumptions

- Consent has already been obtained, as requested. This release does not build a new member consent campaign. Record the organiser's declaration, date, covered people and source groups. Never claim that pairing a device proves member consent.
- Existing consent must cover the intended import and use. Discovery scope defaults to the source group only. Selecting multiple groups does not grant cross-group discovery. Wider scope needs an existing recorded permission; absent scope grants no cross-group matching.
- Name visibility remains a separate choice, default off unless an existing explicit preference is supplied.
- Import both available history and new messages. Proposed default history bounds: the last 30 days, at most 1,000 text messages per selected group, with a 10,000-message total cap. These are implementation defaults, not user-specified limits.
- Use Baileys as the proposed linked-device transport. Isolate it behind an adapter so it can be replaced. Before committing to a version, prove pairing, group listing, history delivery, new-message delivery and reconnect on a test account. If the spike fails, report the limitation before choosing another transport.
- An unofficial linked-device connection can break or be restricted. Do not describe it as an official Meta integration.
- A linked session can access more than the selected groups. Enforce the selected-group allowlist before persistence or model processing. Discard unrelated traffic in memory without logging its content.
- Do not automatically send messages, invitations or consent requests through WhatsApp.
- Keep the existing discovery and circle contracts working. Add connection APIs in their own namespace rather than rewriting the app.

## Product flow

1. Add a primary “Connect WhatsApp” action to Communities and a connected-sources settings page.
2. An authenticated organiser starts a connection. Show “WhatsApp → Settings → Linked devices → Link a device” beside the QR.
3. Render the QR supplied by the worker. Reflect expiry and replacement; expose cancel and retry. Never place pairing data in a public URL or browser storage.
4. After pairing, show a searchable multi-select dropdown with group names and participant counts when available. Start with nothing selected. Use provider group IDs, not titles, as keys. In the first release list ordinary groups; label them as groups rather than promising WhatsApp Community container support.
5. Show a confirmation sheet with selected groups, history bounds, discovery scope and the recorded-consent declaration.
6. Save the selection and start ingestion. Show per-group progress: waiting for history, importing, extracting, awaiting review, indexing, live, paused or failed. Display the earliest message actually obtained and any gap.
7. Review extracted member context, approve or reject individual claims, and resolve uncertain identities. Only eligible approved context enters discovery.
8. Connected sources shows last successful sync, current status, reconnect, pause, disconnect and a separate delete-imported-data action.

Use the current app's visual language: white canvas, dark text, electric-blue action, large type and restrained labels. The group picker supports keyboard selection, touch controls, loading, empty and disconnected states, and a 360px viewport.

## Data and identity model

Extend the existing Convex schema rather than introduce another member store.

| Record | Required fields and purpose |
| --- | --- |
| `whatsapp_connections` | ID, workspace, organiser, status, worker reference, paired account identifier reference, created/updated times, last heartbeat and safe error code. No raw credentials. |
| `whatsapp_groups` | Connection, provider group ID, display title, optional participant count, selected flag, linked Small World community ID and permission scope. |
| `whatsapp_sync_jobs` | Connection/group, bounds, checkpoint, processed counts, coverage, status, retry count, last success and safe error. |
| `external_identities` | Workspace, provider, account namespace, provider identity, optional member ID, resolution state, confirmation basis and provenance. |
| `consent_records` | Member or covered source identity, purpose, allowed community IDs, separate roster preference, declaration source, recorded time, withdrawal time and revision. |
| `imported_messages` | Provider message key, connection/group, author identity reference, original time, received time, edit/delete state, content revision, permitted text and retention expiry. |
| Existing `sources`, `signals`, `signal_evidence` | Extend with origin message/revision references, extraction version and lifecycle metadata. Preserve pending/approved/rejected/withdrawn states. |
| `index_jobs` | Permission partition, context revision, requested/completed revision, status, attempts and obsolete-dataset cleanup status. |

Use a uniqueness check in the same Convex mutation for message identity and external-identity mapping. Namespace provider keys by account/workspace. Do not rely on a SQL-style unique index that Convex does not supply.

A member gets a permanent random internal ID. Display names can change without changing that ID. Same-name people remain separate. Support provider alternate IDs and mappings only when the provider supplies corroborated associations; otherwise leave the link unresolved. Never merge on display name, skills, company or a model's guess. Reuse existing identity review concepts, but do not reuse chat-name hashes as definitive person IDs.

An organiser's declaration must identify who it covers. Unknown senders can be staged as unresolved source identities; they do not become discoverable until both consent coverage and identity are established. Moderator approval alone does not manufacture consent.

## Extraction and evidence

Process permitted text in bounded batches with validated structured output. Message text is data and cannot issue tool commands or alter extraction rules. Ignore media, system messages and unsupported attachments in this release. Recognise replies, quotes and forwarded content so another person's words are not attributed to the sender.

| Information | Rule |
| --- | --- |
| Building | Preserve what the author says they are making; link to exact source evidence. |
| Offering | Preserve a stated willingness to help. Keep its date and expiry semantics. |
| Seeking | Extract an explicit request for help, collaborators, feedback or peers. |
| Stated experience | Require an explicit self-attributed statement. Event attendance and shared links do not establish expertise. |
| Availability | Store unknown unless supported. Record the stated time window; expire time-sensitive claims. A historical offer does not prove current availability. |
| Scope and consent | Read from authoritative records. Never infer these from conversational text or group membership. |
| Identity | Use the confirmed external identity to member mapping. Return unresolved attribution when mapping is uncertain. |
| Evidence | Keep source group, message reference, time, permitted excerpt and content revision. Unknown source dates remain unknown. |
| Goal and activity | Keep in existing search/circle records. Generate a proposal at search time from eligible evidence; do not treat it as an agreement by participants. |

A new extractor returns pending claims. Approval is explicit and recorded. Reimports of the same content do not reset an approved/rejected decision. Edited content creates a new revision and requires revalidation; deleted sources invalidate unsupported claims and saved searches.

## Worker and API boundary

Run the worker as a persistent service with a persistent encrypted session volume or secret store. A Next.js request or short-lived function must not own the WhatsApp socket. Use a single leased worker per connection to prevent competing sessions.

Proposed transport interface:

```ts
interface WhatsAppTransport {
  start(connectionId: string): Promise<void>;
  listGroups(connectionId: string): Promise<GroupSummary[]>;
  disconnect(connectionId: string, revoke: boolean): Promise<void>;
}
```

Worker events: `qr.updated`, `connection.updated`, `groups.updated`, `history.batch`, `message.upsert`, `message.deleted`, and `sync.updated`. QR events carry an expiry and generation number. Message events carry group ID, author reference, provider message key and revision.

The history path consumes only history the linked session actually supplies. A date limit is a processing bound, not a promise that the provider can retrieve all messages in that period. Report partial coverage and preserve live ingestion when history is incomplete.

Organiser-facing endpoints:

| Method and route | Behaviour |
| --- | --- |
| `POST /api/platform/whatsapp/connections` | Create an organiser-owned connection and request pairing. |
| `GET /api/platform/whatsapp/connections/:id` | Return safe status and current short-lived QR to the owner only. |
| `GET /api/platform/whatsapp/connections/:id/groups` | Return accessible group metadata after pairing. |
| `PUT /api/platform/whatsapp/connections/:id/selection` | Validate selected group IDs, bounds, consent coverage and scope; enqueue sync. |
| `GET /api/platform/whatsapp/connections/:id/sync` | Return progress, coverage and safe errors. |
| `POST /api/platform/whatsapp/connections/:id/pause` | Stop ingestion while retaining the paired connection. |
| `POST /api/platform/whatsapp/connections/:id/resume` | Resume from checkpoint and report any gap. |
| `DELETE /api/platform/whatsapp/connections/:id` | Disconnect and revoke/erase session credentials. |
| `POST /api/platform/whatsapp/connections/:id/purge` | Separate explicit deletion workflow for imported data and derived context. |

Use existing API envelopes, signed organiser sessions, same-origin mutation checks and no-store headers. Server validates ownership on every request. Authenticate worker events separately using a rotating service credential and event IDs for replay-safe processing. Do not expose Convex admin keys to the worker's browser-facing responses.

## Cognee storage and retrieval

The existing Cognee adapter supports remember and recall. It is not yet a complete sync, deletion or index-lifecycle implementation.

1. Keep session secrets, contact identifiers and raw chat history out of Cognee.
2. Index only approved professional statements with stable member, signal and evidence IDs, scope, source date and context revision. Strip contact details.
3. Partition datasets by workspace and allowed discovery scope. Extend the existing revision naming to include workspace isolation explicitly.
4. Write to a new revision, verify retrieval readiness, then atomically mark it current. An accepted upload is not proof that indexing is complete.
5. On withdrawal, deletion or reduced scope, immediately exclude affected records in Convex and invalidate dependent searches. Query only an eligible current revision; use the labelled local retrieval path while rebuilding.
6. Implement removal of obsolete Cognee material using the actual tenant's documented API. Verify deletion behaviour in the initial spike; do not invent an endpoint. Retain a cleanup retry job until completion.
7. Intersect all recalled evidence IDs with current permission-filtered Convex records before ranking or display. Cognee output cannot override identity, approval or consent.

## Implementation tasks

### 1. Prove the provider boundary

- [ ] Pin a supported Node/runtime and WhatsApp library version in a worker package.
- [ ] On a test account, prove QR rotation, paired-session restart, group listing, available history and new message delivery.
- [ ] Check alternate sender identifiers, edit/delete delivery and reconnect coverage. Document unsupported events and gaps.
- [ ] Prove a small Cognee ingest/retrieve/delete round trip against the real tenant.
- [ ] Deliver a capability report with observed limits before building the full UI.

### 2. Add connection state and identity storage

Files: `convex/schema.ts`; new focused modules under `convex/whatsapp/` and `src/server/platform/whatsapp/`; `tests/platform/whatsapp/`.

- [ ] Write failing tests for organiser isolation, duplicate message delivery, same-name people and confirmed alternate identity mapping.
- [ ] Implement records, transactional uniqueness checks, selection validation and explicit state transitions.
- [ ] Test missing consent coverage, no cross-group permission, and separate roster visibility.
- [ ] Run focused tests and commit the storage boundary.

### 3. Implement the persistent worker

Files: proposed `workers/whatsapp/src/{transport,session-store,ingest,runner}.ts` and worker-local configuration.

- [ ] Write tests using a fake transport for expired QR, dropped sockets, repeated events, stale generations and single-worker leases.
- [ ] Implement encrypted session persistence and authenticated event delivery.
- [ ] Filter unselected groups before durable queues or extraction. Bound queues, batch sizes and retries.
- [ ] Checkpoint history and live events idempotently. Expose lag and partial-history coverage.
- [ ] Verify reconnect and restart without duplicate claims; commit.

### 4. Add APIs and the connection interface

Files: proposed `src/app/api/platform/whatsapp/**`, `src/app/(product)/settings/connections/page.tsx`, `src/components/connections/**`, `src/ui/connections/**`; modify the Communities action and shell navigation through their existing owners.

- [ ] Test session ownership, expired QR, invalid group selection and repeated selection submissions.
- [ ] Implement API handlers and a typed client adapter with deterministic mocks.
- [ ] Build pairing, searchable selection, import confirmation, progress and disconnect states.
- [ ] Verify keyboard behaviour, 360px layout and recovery after reload. Never report connected or imported before worker acknowledgement.
- [ ] Commit the complete connection flow.

### 5. Extract and review grounded context

Files: new `src/server/intelligence/whatsapp/` modules; extend the existing identity review layer and context-review UI.

- [ ] Add fixtures for same-name senders, quoted third-party experience, forwarded profiles, stale offers, conflicting claims and prompt injection.
- [ ] Implement schema-validated extraction into pending signals with evidence references and source revision.
- [ ] Build approve/reject and identity-resolution review. Preserve prior decisions on unchanged reimport.
- [ ] Test edits, deletion, missing dates and availability expiry. Commit.

### 6. Connect approved context to Cognee and discovery

Files: `src/server/intelligence/memory/{cognee,retrieve,revision}.ts`, new index lifecycle modules and jobs, existing platform search validation.

- [ ] Test workspace/scope partitioning, stale revisions, delayed indexing and obsolete recall IDs.
- [ ] Implement revision activation, bounded retries, withdrawal exclusion and eventual provider cleanup.
- [ ] Verify discovery finds a newly approved member using its actual evidence and creates a circle from the server-saved search.
- [ ] Ensure sample mode uses the intended server pipeline. Reconcile the existing frontend mock/sample mode mismatch before claiming an integrated demonstration.
- [ ] Commit the retrieval integration.

### 7. Rehearse and document deployment

- [ ] Deploy the worker with persistent encrypted storage, health checks and restart policy; deploy the existing web/platform components separately.
- [ ] Document server-only secrets and rotation. Redact QR payloads, credentials, message text and contact identifiers from logs.
- [ ] Set a proposed seven-day staged-message retention default; preserve approved evidence only for its stated purpose and permission period. Make retention configurable.
- [ ] Pair a test account, select one group, import bounded history, approve one profile, send a new message and observe updated evidence.
- [ ] Search, create a circle, accept two invitations and confirm the activity. Verify the existing accepted-count and activation rules remain intact.
- [ ] Disconnect, revoke consent and delete a source in separate tests. Confirm matching stops immediately and Cognee cleanup completes.
- [ ] Run `npm test`, `npx tsc --noEmit`, `npm run build`, and worker-specific checks. Record actual results, history coverage and limitations.

## Release acceptance

- Pairing, selection and sync reflect real worker state.
- Only selected, permitted group content enters durable processing.
- Historical coverage is reported honestly and live sync survives reconnects.
- Duplicate deliveries never create duplicate messages, members or signals.
- Same-name people stay separate; uncertain identities remain unresolved.
- Every displayed claim has eligible evidence and a usable source date or explicit unknown date.
- Existing recorded consent and scope govern matching. Roster visibility stays separate.
- Cognee contains only permitted approved summaries; current platform checks remain authoritative.
- Withdrawal, deletion and disconnect have distinct, tested behaviour.
- The current discovery-to-circle flow still works.

## Remaining operational inputs

Implementation will need a test WhatsApp account, representative consenting groups, the Cognee tenant API details and credentials, and a persistent worker hosting target. Keep credentials in server-side secret configuration. The spike must establish the provider's actual history and deletion capabilities before delivery dates are promised.
