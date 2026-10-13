# Hosted public demo verification — 13 October 2026

Live: https://banyan-workflow.vercel.app. Shared saved synthetic board with no login. Vercel production deployment `dpl_75gquXmyfNAYGdGf2ztfd8vHDD4a` is READY, serving application commit `df38875`.

- Added seven regression tests covering hosted CRUD/conflicts and actor labels, denied origins/hosts/boards, fail-closed configuration, fixed collection isolation, blocked writes on limiter failure, shared atomic rate counters, and full-demo creation rejection.
- All 22 regression tests, lint, type checking and production build passed. Vercel independently built and deployed the same application successfully.
- Seeded five synthetic cards into the separate `cards_public_demo` collection. The local `cards` collection has five records; a private checksum baseline was captured before hosted tests and matched after testing.
- Vercel production secrets configured with explicit user approval for reuse of the app credential. No Atlas network-rule or permission change was made.
- Initial deployments used the Vercel CLI. On 13 October 2026, after the user authorized GitHub in Vercel, project settings confirmed `oli-deacon/banyan-workflow` is connected, production branch is `main`, automatic domain assignment is enabled and fork protection is on. The documentation update is the push-triggered deployment verification change.
- Live browser: loaded five samples, displayed public/synthetic-data warnings, created a temporary card, edited its summary and moved it to Ready for Review. A fresh tab showed the same saved record and four coherent activity events after API concurrency testing.
- Live API: GET 200 with `public-demo` mode; simultaneous same-version PATCH requests returned 200 and 409. A cross-origin write returned 403; another board returned 404.
- Live database: the browser fixture matched its saved API snapshot in `cards_public_demo`. Removed only that exact unchanged fixture, leaving five demo samples. The local board checksum remained unchanged.
- Hosting compatibility: Vercel adds proxy headers. Hosted mode validates the configured HTTPS URL and Host directly and does not trust forwarded headers; local-only forwarding restrictions remain. Regression tests cover spoofed forwarding headers.
- Browser console error list was empty after final reload. Vercel error-log query for the final deployment returned no logs; that is a bounded check, not ongoing monitoring. The drain-inspection endpoint returned 404, so external drain configuration could not be verified.
- Screenshot: `output/vercel-public-demo.jpg`.

Limits: access has been verified from this machine, not the office network. No login, individual attribution, automatic refresh, ongoing monitoring or private-data protection is provided by this public demo. Shared rate limits and a best-effort card capacity guard are enabled. No Atlas network access changes were required.

The sections below are historical evidence for the original local-only implementation.

# Server-backed version verification

## Live Atlas verification — 2026-10-13

Completed against the approved dedicated Atlas connection:

- Confirmed the dedicated application user with exactly `readWrite` on `banyan_workflow`, with the Atlas UI showing one-cluster resource scope.
- Confirmed local connection file has `0600` permissions. No connection string or password was printed.
- Seeded `banyan_workflow.cards` / board `modernization`: 0 records before, 5 samples after; second seed made no changes.
- Created one uniquely identified temporary synthetic test card through the live API (201), edited it (200), and sent concurrent moves with the same expected version (one 200, one 409 VERSION_CONFLICT).
- Verified three committed versions and three activity events; the rejected write added no activity.
- Stopped the app process, started it again, and verified the full test record was identical through the live API.
- Compared the test fixture against its saved synthetic snapshot, then removed only that exact ID/version. Final count: 5 cards, all samples; collection: `cards`.
- Reloaded Brave after restart/cleanup and confirmed the five-card board displays **MongoDB · local development access**.
- Reran all 15 regression tests, lint, type checking and production build successfully.

The preview remains local-only at http://127.0.0.1:3101. No deployment, paid infrastructure or network-policy changes occurred.

## Earlier mock-mode verification

The following automated and browser regressions were first run against explicitly labelled mock mode. Mongo adapter unit tests still use test doubles; the live checks above now supplement them.

## Automated checks

- `npm test`: 15 regression tests pass (6 original model/codec tests, 9 server/API tests).
- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm run build`: pass; API routes are dynamic and runtime production access is denied.
- API cases: create/edit/move, validation, unknown/injected fields, request size, stale versions, simultaneous writes, activity coherence, idempotent non-destructive seeding, board boundaries, local-origin gating, production denial and sanitized database errors.
- Mongo test doubles verify the board/id/version compare-and-set predicate and `$setOnInsert` seed behavior.

## Browser QA (Chromium / Playwright CLI)

- New card saves through the API; 12,000-character detail content survives browser reload.
- A second API write while the editor is open causes HTTP 409 on the stale save; the draft remains intact and the panel stays open.
- Simulated HTTP 503 on write retains the draft with an honest error.
- Move and native desktop drag/drop update the server model; keyboard focus follows the moved control.
- Version and activity counts reflect successful writes only, excluding rejected/conflicted saves.
- Repeated expand/collapse and modal Tab cycling; Escape closes a clean editor.
- Legacy browser storage is left untouched and is never imported.
- Responsive 390, 768 and 1440 pixel widths without page horizontal overflow.
- Simulated initial load failure shows an error and disables creation; Refresh recovers after the service is restored.

Evidence: `output/api-board-desktop.png` and `output/api-detail-activity.png`. These use synthetic mock data. Original version screenshots remain in `output/` as historical evidence.

## Limitations

No Atlas setup blocker remains. Team authentication and board-membership authorization are still required before public/team use; production API access remains disabled. Safari, Firefox, a physical touch device and a screen-reader audit were not performed.
