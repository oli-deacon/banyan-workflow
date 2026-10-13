## Board polish — 14 October 2026

- Refined card spacing and typography; added subtle column surfaces, aligned desktop column heights, consistent count badges, toolbar/Add/Move interaction treatments and quieter completed cards with decorative SVG checks. Move arrows now use SVG, and coarse-pointer Move controls have 44px minimum targets.
- 32 unit/API tests and all 12 existing Chromium browser regressions passed. Lint, typecheck and production build passed.
- Focused mock-mode checks at 1440, 768 and 390px verified no horizontal overflow, distinct column surfaces, completion marks, accessible control names, keyboard focus, touch targets, drag/drop and Move/Undo (including completion-style updates). A second pass confirmed cursor glow, pointer reset, reduced motion, touch opening and card details remained functional. No browser page errors were observed; desktop/mobile screenshots were inspected.
- All mutations used only the isolated memory mock. No live data changes or production deployment occurred during implementation. Safari, Firefox and physical-device checks remain unperformed.

## Card Border Glow — 14 October 2026

- Adapted React Bits Border Glow for the existing light board cards: cursor-directed mesh border, soft outer glow and restrained edge fill. Preserved card controls, desktop drag handlers, native focus outlines and responsive geometry. Upstream attribution/license retained in `THIRD_PARTY_NOTICES.md`; no runtime dependency added.
- `npm test`: 32 passing; `npm run test:browser` with the system Chromium override: 12 passing. Lint, typecheck and production build passed.
- Focused isolated-memory browser QA verified cursor direction changes, increased edge intensity, reset after leaving, keyboard focus/opening, Move and Undo, preference changes to reduced motion, touch opening and 390px layout without horizontal overflow. Desktop 1440px idle/hover screenshots and the mobile screenshot were inspected. No browser page errors were captured.
- Cursor tracking is disabled for touch and reduced motion. A static mesh border accompanies focus; decorative layers cannot intercept controls. Pointer updates are batched to one animation frame and canceled on leave, drag and unmount.
- Browser checks modified only the memory mock. No MongoDB or hosted card records were changed. Safari, Firefox and physical-device checks were not performed.

## Stop Condition — 13 October 2026

- Added optional Stop Condition to the shared model, create/edit Context, reading view, activity labels, typed client payloads, strict API validation and MongoDB serialization. Empty legacy records remain readable/editable; older clients omitting the field preserve existing values. This is descriptive context only.
- `npm test`: **32 passing** unit/API tests. New coverage includes field create/edit/read/clear, omitted legacy payloads, invalid types and the 20,000-character boundary, Mongo legacy reads with no writes, persistence/version conflicts, and the targeted backfill's dry run, repeat runs, changed-context skips, collection selection and concurrent-write safeguards.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed.
- `BANYAN_CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`: **12 passing**. Chromium 154 was available in the coding environment; the Playwright browser download endpoint returned 403. The optional executable-path override supports this environment without changing the default Playwright browser elsewhere.
- Browser coverage includes actual memory-API Stop Condition create/edit/reload and readable activity, a legacy detail response without the field, and reading/editing at 390px and 1440px without panel horizontal overflow. Screenshots under the ignored `test-results/` directory were visually inspected. All test mutations were in the isolated memory mock; no Brave or user-computer UI was used.
- Corrected an existing browser-test text locator to scope its summary assertion to the dialog; the summary also appears on the underlying board. The final full suite passes.
- The five repository samples have distinct proposed conditions. The new maintenance script defaults to dry run, requires an explicit approved collection target, skips changed sample context, uses atomic version/context/missing-field predicates, updates only Stop Condition and revision metadata, and never inserts/deletes cards.
- **Live verification blocked:** this environment has no approved MongoDB configuration; the dry-run command exits safely without connecting or writing. The hosted API request returns HTTP 403 from the environment network path. Current live IDs/content could not be confirmed. Source sample content is the proposal, not proof of the live state.
- No live backfill, seed, merge, credential/access changes or manual deployment was performed. `vercel.json` disables automatic deployments only for `feat/card-stop-condition`, so publishing this draft branch does not request a preview deployment. Main remains enabled; this branch-specific rule can be removed after publication approval. Before the hosted board reflects the change, approve publication, merge/deploy the code, inspect live sample contents and the targeted dry run using existing approved access, then approve/apply the demo-collection backfill. Changed samples require task-specific review.

## Review fixes and cleanup — 13 October 2026

- Split the board presentation, card editor, board-data hook and typed API client. Removed the retired browser-storage codec and mutation helpers with their obsolete tests.
- Unchanged edits and moves retain the version, timestamp and history. Expected-version checks still apply, including Mongo's atomic predicate. The public limiter still counts attempted writes; unchanged Save is disabled in the UI.
- Successful background reads clear stale refresh errors without clearing uncertain write warnings. Non-JSON write failures retain the draft and explain the uncertain outcome.
- Board reads now return compact summaries; opening or explicitly reloading a card fetches its full detail/history through the same access gate. No schema migration or credential changes.
- `npm test`: 25 passing server/model tests, including four new regressions replacing four retired-code tests. `npm run test:browser`: nine passing Chromium regressions for unchanged saves, recovery after manual/poll failures, delayed reads overlapping a move, dirty-draft replacement, stale Undo, non-JSON failures, five-minute polling, uncertain move warnings, and a real mock API create/edit/reload flow.
- Lint, typecheck and production build passed. Browser tests start an isolated memory mock on port 3107 and never write to Atlas.
- CSS duplicate rules and obsolete selectors were consolidated. A temporary Chromium comparison at 1440×1000 found identical computed layout, typography and spacing for the board, reading panel and editor before/after consolidation. Screenshots were inspected locally; the temporary comparison script was removed.
- Dependency audit separately reports five high-severity entries in the existing ESLint → fast-glob → micromatch → braces development-tool chain. Playwright adds none of these. No forced framework downgrade was applied; dependency remediation is outside this behavioural cleanup.

## Consolidated board actions — 13 October 2026

Moved Refresh board beside New card and removed the persistent update-status row. Five-minute polling and focus/reconnect refresh remain; a failed sync still displays its warning. Local/mock storage labels remain explicit.

## Compact public-demo notice — 13 October 2026

Replaced the board’s padded warning banner with a compact text line. Public editing, synthetic-only use and the prohibition on personal/customer/confidential information remain explicit. Editor reminders and actual error alerts retain their existing styling.

## Footer and refresh cadence — 13 October 2026

Removed the workspace footer and its unused styles. Background polling now runs every five minutes; focus, visibility-return, reconnect and manual refresh remain. A separate one-minute display clock keeps relative timestamps current without making API requests.

## Shared updates, activity and polish — 13 October 2026

- Added visible-tab polling every 15 seconds and focus/visibility/online refresh. Read epochs discard in-flight reads that overlap newer writes; polling skips pending writes and drag operations. Failed background checks retain the board/draft and show a retry notice.
- Open-card snapshots and drafts are preserved. Newer versions show a notice and disable stale Save. Loading the latest dirty card now uses an inline two-step discard confirmation, with Keep my draft available.
- Activity uses readable action/field names, honest anonymous actor labels, relative times, optional exact timestamps/revisions and a latest-500 retention note when applicable.
- Added an original canopy motif in status-specific empty columns and the footer, completion copy, and reduced-motion-aware panel/toast transitions. No mobile-layout changes.
- All 25 tests, lint, typecheck and production build passed. New regressions cover combined edit/move descriptions, actor/seed labels, relative-time boundaries and clock skew.
- Browser mock check confirmed a move in a second tab appears as a newer-version notice in an open editor, leaves its unsaved summary intact, and disables stale Save.
- Follow-up laptop browser checks verified inline Keep my draft and explicit discard/load, newer status/history on load, readable activity entries and the original canopy empty state. Stopping the local mock server left the board visible and showed Updates paused. Automatic recovery after a failed poll is implemented; a full outage/recovery browser check was inconclusive because the development server’s restart triggered page reload, and the temporary proxy did not hydrate. All test mutations were confined to the memory mock; no Atlas records were changed.

## First-priority experience update — 13 October 2026

- Reading-first cards show the actual title, status, summary, objective and acceptance criteria before supporting detail; empty sections are hidden. Editing is explicit, and new-card detail fields are optional disclosures grouped by Purpose, Context and Progress.
- Visible create/save/move feedback, version-checked move Undo, quiet board columns, warmer typography and restrained move/drop feedback with reduced-motion support.
- Local mock browser verification: create with optional detail, open readable brief, edit/save, move to Done and Undo; a concurrent API edit rejects stale Undo. Another concurrent edit rejects stale Save while retaining the draft. Discard confirmation works.
- Found and fixed a reading-to-edit button reconciliation issue that could submit the form on the same click. Retested the explicit Edit → change summary → Save flow successfully.
- Verified mobile 390×844 board and reading panel, desktop 1440×900 board and expanded reading view without horizontal overflow. Keyboard Tab from the final action wraps to the first dialog control; opening Edit focuses Title. No browser console errors in the final check.
- All 22 existing regression tests passed. Final lint, typecheck and production build passed.
- Test writes used only the explicit memory mock. Public and local Atlas card data were not changed. Safari, Firefox, physical touch and a screen-reader audit remain untested.

## Compact board header — 13 October 2026

Removed the promotional heading/subheading and reduced workspace-row spacing. Local mock browser checks at 1440×900 and 390×844 showed the compact header and no horizontal overflow. Lint and type checking passed.

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
