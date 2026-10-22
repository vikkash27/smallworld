# WhatsApp connection preview

This branch adds real linked-device pairing, a searchable group picker, bounded text staging and a separate persistent worker. It does not yet publish extracted profiles or index imported context in Cognee.

## Local setup

Use the app's supported Node 22 runtime. From the repository root:

```sh
npm ci
npx convex dev --local
```

Keep Convex running. In a second terminal:

```sh
npm run platform:env
```

Set `ADMIN_PASSWORD`, `APP_BASE_URL=http://localhost:3001` and a strong server-only `WHATSAPP_WORKER_TOKEN` in `.env.local`. Keep its file permissions private. Seed only the isolated fictional workspace using `npm run seed`, then run `npm run dev -- --port 3001`.

In `workers/whatsapp`, run `npm ci` and copy `.env.example` to `.env.local`. Give it the same worker token, the web server URL, and a separate 32-byte random encryption key expressed as 64 hexadecimal characters. Keep those secrets out of Git. `npm start` maintains the socket independently of Next.js. One worker claims a connection at a time through a fenced 15-second lease.

Open `/settings/connections`, sign in, and click Connect WhatsApp. Scan the code in WhatsApp's Linked devices screen. Select groups and confirm that existing consent covers their import. Incoming text is persisted only for selected groups. Forwarded messages, quoted replies, media and system events are omitted by this first decoder to avoid attributing someone else's words to a sender.

## What this milestone establishes

- Real provider-generated QR pairing with expiry, rather than a decorative code.
- Group listing keyed by provider group ID, including duplicate titles.
- Selection recorded separately from account-level linked-device access.
- Thirty-day history processing bound, up to 1,000 texts per group and 10,000 overall. The provider may deliver less. No full-history promise.
- Opaque provider cursors retained in memory for requesting available history after selection; unselected text is discarded.
- New selected-group messages staged in Convex with source identity, provider message key and original timestamp. No name-based merging.
- Unresolved identities remain unresolved. Imported text never becomes an approved discoverable claim automatically.
- AES-256-GCM session and outbox encryption, authenticated worker calls, owner-only APIs, same-origin mutations and no-store responses.
- Idempotent delivery with an encrypted retry outbox. Provider operations do not block lease renewal; sockets close before the local lease expires.
- Disconnect requests provider logout, preserving session material if logout fails. Imported server-side text remains until retention cleanup.
- Seven-day staged-text expiry, with Convex cleanup processing up to 100 expired messages per minute. Cleanup can lag under a large backlog. Outbox expiry is checked when delivery is attempted; a stopped worker cannot physically erase its offline disk.

## Verification

```sh
npm test
npx tsc --noEmit
npm run build
npm run check --prefix workers/whatsapp
```

Tests cover persisted Convex ownership and worker fencing, source filtering, duplicate delivery, same-name identity separation, stale history, expiry, pause, encryption and restart, failed logout retention, a 1,000-message durable retry backlog, group selection and API access checks.

Actual paired-account restart, accessible history, alternate-ID mappings and provider logout must still be verified with a user-controlled test account. A QR being rendered proves only the pairing handshake. The worker uses pinned Baileys 7.0.0-rc14, an unofficial integration; provider changes can require adapter updates.

## Next milestone

1. Observe a complete paired test-account flow and record history coverage.
2. Add edit/delete propagation and explicit gap/checkpoint recovery for missed provider events.
3. Build pending claim extraction and identity review, preserving evidence and consent provenance.
4. Link approved members and scopes into the existing platform context port without exposing private group directory metadata.
5. Implement Cognee index revision activation, tenant-verified deletion and withdrawal handling.
6. Add explicit imported-data purge and operational deployment tooling.

The current UI names extraction and indexing as unavailable. Do not present staged messages as a completed knowledge graph or a working discovery integration.
