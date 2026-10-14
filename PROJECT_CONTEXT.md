# Banyan Workflow — project context

**Snapshot: 13 October 2026, Melbourne (Australia/Melbourne).** This records agreed decisions and verified state at that date, not a promise that a preview process is still running.

## Human–agent demo workflow prepared — 14 October 2026

User authorized implementation of the five recommended demo capabilities: roles, handoffs, evidence/review, timeline and attention filters, plus an isolated guided simulation. Owner remains the accountable human. Worker is a declared Human/Agent label; Reviewer is a declared human. There are no authenticated roles, real agent execution or notifications.

Shared cards now support explicit versioned commands: start, request_input, resume, submit_review, request_changes and approve. State is separate from columns (idle, working, awaiting_input, in_review, approved). Start requires roles/objective/acceptance/Stop Condition. Human questions, decisions, feedback and rationale are required. Review submission checks evidence shape, safe HTTP(S) links and all current acceptance criteria. Started cards cannot bypass review through direct Move/drag or edited status. Any submitted/approved card edit reopens work and clears current evidence; historical snapshots are retained. Unstarted legacy cards keep manual status controls.

The API accepts commands separately from editable card fields, rejects injected state/history/actors, and uses the same board/id/version compare-and-set in MongoDB. Roles are normalized/defaulted; omitted legacy roles are preserved. Summaries project only workflow state, not evidence/history. Commands are bounded to 12 KB and history retains the latest 500 events. The existing Stop Condition backfill excludes role labels from task-context matching and skips started workflows; do not rerun it on the completed hosted samples.

`/demo` is a browser-memory-only seven-step walkthrough using the shared transition rules. It makes no board API requests or writes, requires no credentials, and resets on reload/explicit restart. All names, decisions, times, tests and links are fictional. It demonstrates a pause, human decision, first evidence submission, reviewer correction, resubmission and approval. `DEMO_GUIDE.md` is the presenter script. Current live cards remain untouched. Publication of this new workflow awaits approval.

Owner was approved and deployed from merge `cef6ab23b6994ff49bbd3f2ff19e6bcfc26bc3a7`, deployment `dpl_JB73Bum3vSF5Mk73ZTzB2dLSDWN4`; the canonical live API returned 200 with owner fields and all five existing sample revisions preserved. Historical Owner preparation notes below are superseded by that deployment.

## Card owner — 14 October 2026

Optional `owner` is a free-text responsibility label limited to 100 characters, with whitespace normalized on API saves. It appears in the basic create/edit form, board footer, reading view and activity history. Blank/missing owners display Unassigned. Samples remain unassigned; no people or business responsibilities were invented. Public-demo help requests fictional names. This does not add user accounts, permissions or notifications.

The API and Mongo adapter persist Owner using the existing version checks. Legacy reads default to blank without writes, and older edit clients omitting Owner preserve saved ownership. Explicit blank clears it. No migration, credential change or live data write is needed. Owner was subsequently deployed; see the publication record above.

## Publication status — 14 October 2026

Board polish was subsequently approved, merged as `4ed31d05ac2cc919b436e4f6815d7f114de3606c`, and verified READY in production (`dpl_EHMrfgCtR6k5XvjbFUuYRdWqjA79`). All five hosted sample Stop Conditions were filled through the normal card editor and independently verified after reload on 13 October at 23:24–23:27 UTC (14 October Melbourne). **That sample update is complete; do not rerun the backfill or request new database access.** The preparation notes below are historical.

## Board polish prepared — 14 October 2026

Cards have roomier summary/footer spacing, softer corners and refined title/summary hierarchy. Columns have subtle stage-specific surfaces and aligned desktop heights; counts use consistent badges. Toolbar, Add card and Move controls share restrained hover/focus treatments. Move targets are at least 44px high for coarse pointers, with SVG arrows independent of installed fonts. Done cards use a quieter surface and a decorative checkmark that updates with moves and Undo. The existing cursor glow and reduced-motion handling remain intact. This is a presentation-only change; no data or workflow semantics changed. This polish was subsequently published; see publication status above.

## Card Border Glow — 14 October 2026

Board cards now use a cursor-directed mesh-gradient border and soft edge glow adapted from React Bits Border Glow. The original light card layout remains. Pointer work is batched to animation frames without React renders; leaving, dragging and unmounting clear pending glow work. Touch and reduced-motion users do not get cursor tracking, and keyboard focus receives a static colored border with existing focus outlines intact. All decorative layers ignore pointer input. No dependency or data changes. Attribution and the upstream license are in `THIRD_PARTY_NOTICES.md`.

Stop Condition PR #1 was subsequently approved by the user, merged as `fdcb335155a7284ae4cde02e70842b6d8e8b8a6e`, and deployed READY to production. The five live sample Stop Conditions were subsequently filled and verified as recorded above. Historical preparation notes below describe the earlier state.

## Stop Condition change prepared — 13 October 2026

Optional `stopCondition` is included in shared fields, blank cards, create/edit Context, reading view, activity labels, API validation and MongoDB records. It describes when to pause for human input; it does not implement agent execution. Legacy missing fields normalize to blank without a read-time write; older PATCH clients omitting the field preserve saved values. Explicit empty strings clear it. The detail limit remains 20,000 characters.

The five source samples now contain task-specific conditions. `scripts/backfill-stop-conditions.ts` is a dry-run-first maintenance command with an explicit collection target and no upsert. It only fills missing/empty values on known sample IDs with matching source task context, and atomically checks version/context/missing field before writing the field and revision history. Changed tasks require review. See README for commands and outcomes.

No live records were read or updated during this change: the demo API is inaccessible from this environment (HTTP 403), and no approved MongoDB configuration is present. Publication and live sample application remain separate pending steps; do not merge to main or apply the backfill without publication approval. Current safeguards and collection separation are unchanged. `vercel.json` disables automatic deployments only for `feat/card-stop-condition`, so publishing this draft branch does not request a preview deployment. Main remains enabled; this branch-specific rule can be removed after publication approval.

## Public demo update — 13 October 2026

The user authorized a Vercel-hosted, shared saved board with no login, exclusively for synthetic data. The live demo is https://banyan-workflow.vercel.app, verified READY with browser create/edit/move, fresh-tab persistence, live conflict checks and unchanged local-board checksum. All 22 tests, lint, type checking and production build passed; see QA.md for details. The Vercel project is `banyan-workflow`. GitHub integration is connected to `oli-deacon/banyan-workflow`, with `main` as the production branch and automatic domain assignment enabled. Pushes to `main` now trigger production deployment. Fork protection is enabled; preview environments have no production database credential.

`BANYAN_ACCESS=public-demo` explicitly enables hosted access, with `BANYAN_STORAGE=mongodb` and exact HTTPS `BANYAN_PUBLIC_ORIGIN`. The public API uses only `cards_public_demo`; the original local API uses only `cards`. `public_demo_limits` holds expiring shared counters (30 writes/minute, 500/UTC day). A best-effort creation limit applies at 200 cards. Existing payload bounds, atomic versions and activity retention remain. Hosted activity identifies an anonymous `public-demo-visitor`. A compact text notice above the board states that anyone can view/edit and that all content must be synthetic, with no personal, customer or confidential information. The board checks for shared updates every 5 minutes while visible and on focus, visibility return and reconnection. Reads that overlap newer writes are ignored. Failed checks show a paused-update notice and retry automatically; explicit Refresh remains available.

The user explicitly approved storing the existing app credential as a Vercel server-only production secret. It retains database-wide permission; collection isolation is in code. Do not broaden its permissions or Atlas network rules without authorization. Public-demo choices supersede the historical local-only snapshot below; private team authentication remains unbuilt.

## Start here in a new coding session

1. Read `AGENTS.md`, this file, `README.md`, `QA.md` and `package.json`. Before code changes, follow the repository instruction to read the relevant current Next.js guide in `node_modules/next/dist/docs/`.
2. Inspect the current files and any changes since this snapshot; preserve unrelated work. Confirm the requested scope before treating ideas below as implementation tasks.
3. Check whether the preview port is occupied before starting anything. Verify the API/UI storage mode and connection health without printing secrets. Do not reset data, rerun setup or reuse another app's credentials merely to reproduce the previous session.
4. Use focused tests and browser checks for changes. Update this context and QA evidence when decisions or verified behavior change.

The source repository is https://github.com/oli-deacon/banyan-workflow. A clone requires its own local configuration; `localhost` always refers to the machine running the browser. A hosted synthetic demo is now authorized; see the public-demo update above. Codex sidebar registration is user-managed; folder existence does not prove registration was completed.

## Approved and built

The board uses a compact Modernization title/card-count row with Refresh board and New card side by side with warm paper, serif workspace/detail titles and quiet columns. The promotional heading and subheading were removed on 13 October 2026 to bring the board higher on the page.

Banyan is a clean work proof of concept inspired by the compact presentation of the Strava Insights Plan board. It captures configurable work context in editable cards, rather than training data. All supplied examples are synthetic modernization tasks; no personal Strava data or credentials were copied. Current field definitions and columns are fixed in code, not a configurable schema editor.

The exact agreed columns, in order, are **To Do**, **In Progress**, **Ready for Review**, **Done**. Preserve these labels unless the user explicitly changes the decision.

- Compact cards show a title and short summary. Create from the toolbar or a column; click a card to read its brief, then choose Edit card.
- Detail fields: objective, input context, reference links, constraints, acceptance criteria, progress/blockers and outputs. The modal side panel expands to fullscreen, emphasizes objective and acceptance criteria, hides empty reading sections and keeps activity in a disclosure. New cards start with title, summary and status; optional fields are grouped under Purpose, Context and Progress.
- Desktop native drag/drop and a keyboard/touch Move control change workflow status. **Moving a card does not start an agent.** There is no execution state, agent harness or integration.
- Visible success notifications confirm Create/Save and moves. Move notifications offer Undo using the exact version returned by the move; a newer edit rejects Undo. Drag/drop targets and successful moves have restrained feedback with reduced-motion support.
- Explicit Create/Save sends an API write. Request locks prevent repeated in-flight submissions. Close/Cancel/Escape protect changed drafts; modal focus is contained and restored.
- Open cards retain their original snapshot and draft while background board updates continue. A newer revision shows a notice and disables stale Save; Load latest card is explicit and asks inline before replacing dirty edits.
- Activity uses readable action/field names, anonymous Demo visitor attribution, relative time and optional exact timestamp/revision details. An original canopy motif appears in empty columns; panel/toast motion honors reduced-motion settings.
- A failed write or stale edit keeps the draft open with an error. Drafts do not survive page reload. There is no automatic merge: retain/copy needed edits, then use Load latest card (explicit draft-discard confirmation) or close and refresh before editing the latest version. Uncertain write outcomes must be checked before retrying.

## Architecture and file map

Next.js App Router, React, TypeScript, custom CSS and the official MongoDB Node driver. No deprecated Atlas Data API/App Services dependency.

| File | Responsibility |
| --- | --- |
| `app/page.tsx` | Board presentation, drag/drop and panel opening/closing |
| `app/components/card-editor.tsx` | Reading/editing panel, draft protection, fullscreen and activity |
| `lib/client/use-board.ts`, `lib/client/api.ts` | Shared updates, request/version coordination, typed API calls and errors |
| `lib/card-types.ts` | Compact summary, editor and API response types |
| `app/globals.css`, `app/layout.tsx` | Responsive styling and root layout |
| `lib/board.ts` | Shared card fields/statuses, validation and synthetic samples |
| `lib/server/model.ts` | Strict payload validation, board/database constants, versions, timestamps and activity records |
| `lib/server/store.ts` | MongoDB adapter, explicit in-memory mock, atomic conditional updates and insert-only seed |
| `lib/server/api.ts` | Local-access checks, bounded JSON parsing and sanitized API errors |
| `app/api/boards/[boardId]/cards/route.ts` | GET board cards and POST card |
| `app/api/boards/[boardId]/cards/[id]/route.ts` | GET full card details; PATCH content or status with expected version |
| `scripts/seed.ts` | Explicit, idempotent synthetic seeding |
| `tests/board.test.ts`, `tests/server.test.ts` | Shared validation and API/store regressions; browser interactions in `tests/browser/board.spec.ts` |

The only active board is `modernization`. Each card is an individual document with a stable ID and board ID; the unique index is `{ boardId: 1, id: 1 }`. The board list returns compact summaries; opening a card fetches full details and history. Creates start at version 1. Unchanged edits/moves preserve version, timestamp and activity; stale attempts still conflict. Updates match board ID, card ID and `expectedVersion` atomically; stale writes return **409 VERSION_CONFLICT** without overwriting newer work. Activity is embedded and updated atomically with the card; the latest **500 events per card** are retained. Actors represent either local development or anonymous public-demo visitors, not authenticated people. This is not an immutable audit archive.

## Live persistence and access boundary

Verified Atlas target: an existing cluster, isolated database **`banyan_workflow`**, collection **`cards`**. A dedicated application user was verified with exactly **readWrite on banyan_workflow** and one-cluster resource scope. Five sample cards remained after verification; later user edits/counts must be checked rather than assumed.

The approved live configuration uses `BANYAN_LOCAL_API`, `BANYAN_STORAGE` (set to `mongodb`) and `MONGODB_URI`. The private `.env.local` is ignored and was verified with owner-only `0600` permissions. `.env.example` documents names only. Never print, copy into context, commit or expose secret values to client code. Credential, permission or network changes are separate approval decisions.

**Atlas is the current live persistence mode.** The original browser localStorage data is neither read, written nor imported by the current UI. The optional in-memory mock is explicit, labelled and resets on server restart; it is not a fallback for failed Atlas writes. Seeding uses stable synthetic IDs and `$setOnInsert`, preserving existing cards.

The original local API mode uses: explicit opt-in, loopback host and same-origin write checks; production API requests are denied unless explicit public-demo configuration is valid. Scripts bind to `127.0.0.1`. These restrictions are not authentication: local callers share the same development identity. There is no team login or board-membership authorization. Public source publication and a synthetic Vercel demo were separately authorized on 13 October 2026. No public tunnel was created.

## Run and test

Commands below are verified against `package.json`. Use Node.js 22+ and npm. Install dependencies with `npm ci` only when needed.

```sh
npm run dev -- --port 3101
```

Local preview: **http://127.0.0.1:3101**. Keep the development process running; restart it if stopped, without terminating unrelated port owners. Confirm the UI says **MongoDB · local development access** and the API reports `mongodb`.

```sh
npm test
npm run lint
npm run typecheck
npm run build
npx playwright install chromium  # one-time browser setup
npm run test:browser
```

`npm run seed` explicitly inserts missing synthetic examples; it is not needed on every startup. `npm run dev:mock -- --port 3101` selects the separate, memory-only mock for deliberate local testing. `npm start -- --port 3101` runs a production build, but its API remains denied unless public-demo mode and the exact public origin are configured.

## Latest evidence and limitations

See `QA.md` for details. On 13 October, all **15 regression tests**, lint, type checking and production build passed. Live Atlas verification covered insert-only repeated seeding, create/edit, simultaneous same-version moves (one 200, one 409), coherent activity and identical record persistence across a full app restart. The exact temporary fixture was checked for intervening edits and removed. Brave reload showed five sample cards in live MongoDB mode; page/API returned HTTP 200.

Earlier Chromium/Playwright QA covered retained drafts on 409/503, load-error recovery, long content, Move/drag, modal focus/Escape, repeated expansion and widths 390/768/1440. Those broader UI scenarios used mock mode; the live checks supplement them. Safari, Firefox, physical touch and screen-reader audits are untested. Browser persistence tests on older artifacts do not describe the current live storage path. No Atlas setup blocker remained at this snapshot; current server availability still needs checking.

## Discussed ideas — not yet authorized or built

These are options for a future decision, not requirements, estimates or commitments:

- A clearly labelled **simulated** agent execution flow with an explicit **Start run**, progress/evidence and review handoff. Keep execution separate from board status.
- Shared team authentication and authorization. A minimal approach would validate server sessions and enforce board membership/roles on every read/write, deriving activity actors from authenticated identity.
- A protected hosted environment for private data, after authenticated access controls are agreed and implemented.
- Eventual real harness integration, requiring its own scope and approval.

**Langfuse / agent-retro-kit was a separate exploration. Neither is implemented or authorized as a Banyan integration.** Do not add integrations, OAuth grants, accounts, paid infrastructure, deployment or broaden database/network access based on these notes.
