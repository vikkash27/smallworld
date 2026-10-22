# Baileys rc14 pairing compatibility

The phone-side linking failure can occur before a session is established. The installed rc14 release dereferences a missing account identity while acknowledging pre-login notifications and ignores registration refresh notifications. The latter leaves the QR advertising a retired secret.

This worker applies narrowly scoped backports to the pinned official package, rather than installing an unverified fork:

- https://github.com/WhiskeySockets/Baileys/pull/2749: allow pre-login acknowledgements without `creds.me`.
- https://github.com/WhiskeySockets/Baileys/pull/2765: recognise the two registration-refresh child forms, rotate the pending secret, persist it, and re-render the current reference without consuming another reference. Never rotate an established account's secret.

`scripts/pairing-patch.mjs` applies and verifies these changes during install and every worker start. It refuses an unexpected package version or source layout. It is idempotent. The QR lifetime is explicitly 20 seconds, and the UI hides it conservatively after 18 seconds.

Regression tests execute the patched pairing and acknowledgement code with controlled socket events. They verify pending-secret rotation, preservation of paired identities, rejection of malformed refreshes, reference reuse, future-code freshness, safe pre-login acknowledgements and patch idempotence.

A rendered QR does not establish successful phone linking. The full phone scan and post-pair reconnect still require live verification. A separate upstream report describes rc14 failures after a successful pair; inspect observed lifecycle events before attributing a failure to that issue.

The small original-source test fixtures and backported logic come from Baileys, licensed under MIT. Copyright (c) 2025 Rajeh Taher/WhiskeySockets. The full upstream MIT license is reproduced below.
MIT License

Copyright (c) 2025 Rajeh Taher/WhiskeySockets

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
