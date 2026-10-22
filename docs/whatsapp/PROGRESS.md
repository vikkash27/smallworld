# WhatsApp implementation ledger

Plan: docs/whatsapp/PLAN.md
Baseline: 4b6bb76. Branch: feat/whatsapp-integration.
Baseline tests: 198 passed across 18 files.

Pre-flight: worker events feed scoped persistence; APIs expose only owner data; UI consumes API envelopes. Existing circle DTOs stay unchanged.
Ruling: implement locally on a feature branch in this dedicated clone. Preserve the existing generated next-env.d.ts change. No push or shared merge.
Ruling: real provider capability verification needs the user's QR scan; Cognee verification needs tenant configuration. Build and test the connection foundation and provider spike while those checks remain pending. Do not claim history coverage or indexing before observed evidence.
Ruling: use workspace and organiser ownership for connections; worker commands carry a fenced lease generation. Selected group IDs are validated against the provider's latest group list.

Connection foundation: implemented and exercised with MemoryStore and convex-test. Owner isolation, transactional worker fencing, QR expiry, group selection, consent declaration, source-only scope, stable unresolved source identities, duplicate suppression and bounded history are tested.
Provider adapter: Baileys 7.0.0-rc14 pinned in an isolated worker package. Real QR observed in the browser. User scan, paired restart, actual history coverage and provider logout remain operational checks.
UI: Communities has Connect WhatsApp; /settings/connections provides pairing, searchable checkbox dropdown, declaration, progress, pause/resume and disconnect.
Review: independent reviewer identified logout after restart, 200-message backlog overflow, lease renewal blocked by provider calls, discarded failed delivery, and unenforced retention.
Fixes: logout waits for provider success and preserves credentials on failure; history is chunked to encrypted outbox; renewal is decoupled and local expiry closes sockets; failed deliveries stay durable; indexed Convex retention cleanup runs every minute. Added regression checks for logout, 1,000-message outbox recovery, stale display, disconnect acknowledgement and expiry.
Ruling: this milestone stages source context only. Do not publish claims, create discoverable members, or send context to Cognee until provider capability and approval/index lifecycle checks are complete. Cost: imported data cannot yet affect discovery.
Ruling: WhatsApp history completeness remains unknown; UI reports partial coverage and earliest supplied time. No success flag is inferred from a history phase event. Cost: full requested history may need a later import path.
Ruling: raw text deletion is bounded to 100 expired records per minute and may lag under backlog; encrypted offline worker storage is pruned on delivery/resume. Operational retention is documented, not claimed as exact wall-clock deletion.
Remaining: plan task 1 live-account/Cognee verification; completion of tasks 2/3 (consent provenance, edit/delete, checkpoints); tasks 5/6/7 extraction, review, index lifecycle, purge and deployment. No push, merge or external deployment performed.
Verification: npm test passed 214 tests across 26 files; root TypeScript and worker TypeScript passed; production Next build passed with the new API and /settings/connections routes. Git diff whitespace check passed. Real QR handshake observed, no selected-group account import verified yet.
Provider finding: the Desktop browser descriptor repeatedly closed with provider code 428 before a QR. A fresh Chrome-descriptor socket produced a QR immediately. Switched the adapter to the observed working Chrome descriptor; no pairing payload was logged.
