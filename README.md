# Banyan Workflow

For new coding sessions, start with [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for the dated decisions, architecture, verification and open ideas.

A Next.js / React / TypeScript workflow board with a server-side API and the official MongoDB Node driver. The exact fixed columns remain **To Do**, **In Progress**, **Ready for Review**, **Done**. Cards support creation, editing, desktop drag/drop, a keyboard/touch Move control, a reading-first expandable detail panel, an explicit Edit action, and activity history. New cards start with title, summary and status, with optional grouped details. Save and move notifications are visible; moves offer version-checked Undo so newer changes cannot be overwritten.

## Shared public demo

Live demo: https://banyan-workflow.vercel.app. Browser create/edit/move and shared persistence were verified on 13 October 2026; details are recorded in `QA.md`.

This is a shared, saved board for **synthetic data only**. Anyone can view and edit it without signing in. Do not enter personal, customer or confidential work information. The board checks for updates every 5 minutes while visible and when you return to the tab. **Refresh board** remains available. Open drafts stay untouched; a newer revision shows a notice with an explicit **Load latest card** action. Stale saves cannot overwrite newer work.

The hosted mode requires `BANYAN_ACCESS=public-demo`, `BANYAN_STORAGE=mongodb`, an exact HTTPS `BANYAN_PUBLIC_ORIGIN`, and a server-only `MONGODB_URI`. It uses the separate `cards_public_demo` collection in `banyan_workflow`; the original local board remains in `cards`. Public activity is labelled `public-demo-visitor`, not an authenticated identity.

A shared MongoDB limiter permits 30 write attempts per minute and 500 per UTC day across all visitors. A best-effort capacity check refuses creation once 200 cards exist (simultaneous creates can slightly exceed this). Edits remain available within the write limits. These controls bound demo writes; they are not authentication or comprehensive denial-of-service protection. Demo data is disposable and has no guaranteed retention period.

Vercel production secrets are configured separately from the ignored local `.env.local`. The user authorized reuse of the app's existing database credential; collection separation is enforced by application code, while the credential has database-wide access. Preview deployments do not receive the production credential. `.vercelignore` excludes local secrets, generated files and QA screenshots from uploads.

Vercel is connected to `oli-deacon/banyan-workflow` on GitHub. Pushes to `main` trigger production builds and automatically update https://banyan-workflow.vercel.app after a successful deployment. Fork protection is enabled. Other branches use preview deployments, which do not receive the production database credential or enable the shared demo API. The Vercel CLI remains available for explicitly requested manual deployments.

## Local Atlas connection

The original local environment uses an existing Atlas cluster, database `banyan_workflow`, collection `cards` and a dedicated application user with `readWrite` on that database and one-cluster scope. The local connection is stored in ignored `.env.local` with `0600` permissions. The public source contains no credentials or live database records.

Local mode still requires loopback access and `BANYAN_LOCAL_API=1`. A production API without explicit public-demo configuration remains disabled. Authenticated team use with private data is not implemented.

## Clone and run locally

```sh
git clone https://github.com/oli-deacon/banyan-workflow.git
cd banyan-workflow
npm ci
npm run dev:mock -- --port 3101
```

Requires Node.js 22+ and npm. This starts the explicit memory-only mock without database credentials. For Atlas access, configure your own approved `.env.local` using `.env.example`; credentials are not included in this repository.

## Run with Atlas

```sh
npm run dev -- --port 3101
```

Open http://127.0.0.1:3101. Keep the development terminal running; if the Mac or preview process stops, restart it with the command above. The credentials already configured locally must not be pasted into chat, source control or browser-exposed variables.

## Run the explicit local mock mode

Requires Node.js 22+ and npm:

```sh
npm ci
npm run dev:mock -- --port 3101
```

Open http://127.0.0.1:3101. The UI explicitly displays **MOCK MODE · memory only, resets on restart**. Mock state lives in the server process, survives browser reloads and is shared between local browser tabs. It resets on server restart. It never claims to have saved to Atlas. The server binds to loopback; do not expose it through a public tunnel or proxy.

The original browser localStorage value is neither read nor written by the new UI. It is not imported automatically. Drafts stay in the open editor after a failed write or version conflict; they are not persisted across a page reload. Copy a conflicted draft before loading the latest card or closing and refreshing the board. Activity uses plain-language actions, relative timestamps and honest anonymous visitor labels; exact times and revision numbers remain available under Details.

## Connection configuration and seeding

The approved `.env.local` contains `BANYAN_LOCAL_API=1`, `BANYAN_STORAGE=mongodb` and a private `MONGODB_URI`. `.env.example` documents the variable names without credentials. Any future credential, scope or network changes need separate approval.

To rerun the insert-only synthetic seed:

```sh
npm run seed
```

Seeding is explicit, not a side effect of loading the page in MongoDB mode. Existing cards are never overwritten. A connection error remains visible; the app never silently falls back to browser or mock storage. No network access changes are automated.

## Storage model and write protocol

- Fixed isolated database: `banyan_workflow`.
- Collection: `cards`; active board ID: `modernization`.
- Unique compound index: `{ boardId: 1, id: 1 }`.
- Each document contains one card with stable ID, board ID, version, timestamps and embedded activity. There is no single board-wide card-array document.
- Creation starts at version 1. Updates and moves require `expectedVersion`; the MongoDB update predicate includes board ID, card ID and that version. Exactly one concurrent write can win. A stale write returns HTTP 409 and cannot overwrite the newer card.
- Activity changes atomically with the card in the same document. It records server time, version, action, changed field names, status transitions, and the local-development actor. The most recent **500 events per card** are retained; this is operational history, not an immutable audit archive.
- Synthetic seed IDs are stable. Seeding uses `$setOnInsert` with upsert and never resets edited or existing cards. Running the seed repeatedly is safe.
- Moving a card changes workflow status plus its version/timestamp/history. No agent execution or harness state is inferred or launched.

API routes: `GET/POST /api/boards/modernization/cards` and `GET/PATCH /api/boards/modernization/cards/:id`. The list returns compact summaries; the per-card GET returns full details and activity. Unchanged PATCH requests preserve the version, timestamp and history while still enforcing the expected version. PATCH accepts a complete `card` or a `status`, with `expectedVersion`. The server validates field types, title and size limits, status, HTTP(S) links, unknown fields and body size. IDs and board boundaries are checked; server metadata cannot be supplied through card payloads. The client retains a new card's ID on uncertain write retries and reports duplicate creation rather than silently creating another item.

## Access boundaries and future authentication

Local mode requires explicit `BANYAN_LOCAL_API=1`, a non-production process and a loopback host. Hosted demo mode permits only the configured HTTPS origin and always selects the separate demo collection. Writes require same-origin JSON requests; cross-site requests are rejected. Hosted mode validates the configured origin directly without trusting proxy headers; local mode also rejects unexpected forwarded hosts. These checks are not user authentication: the demo is intentionally public.

Before using private team data, add server-validated login sessions and board membership/roles on every read and write, derive activity actors from authenticated identity, and test those boundaries. Account/provider selection, OAuth grants, new credentials and network changes remain separate decisions.

## Checks and files

```sh
npm test
npm run lint
npm run typecheck
npm run build
npx playwright install chromium  # one-time browser setup
npm run test:browser
```

- `lib/server/model.ts`: strict request model, versions and activity.
- `lib/server/store.ts`: MongoDB adapter, explicit in-memory mock and insert-only seed.
- `lib/server/api.ts`: local access gate, bounded JSON parsing and API errors.
- `app/api/boards/[boardId]/cards/`: route handlers.
- `app/page.tsx`: board presentation and panel navigation.
- `app/components/card-editor.tsx`: reading/editing, retained drafts and activity.
- `lib/client/use-board.ts`: refresh, shared updates and write coordination.
- `lib/client/api.ts`, `lib/card-types.ts`: typed requests and summary/detail responses.
- `scripts/seed.ts`: explicit synthetic Atlas seed command.
- `tests/server.test.ts`: server/API and mocked Mongo adapter regressions.
- `tests/board.test.ts`: shared validation and fixed-status regressions.
- `tests/browser/board.spec.ts`: Chromium checks for draft protection, refresh recovery, delayed reads, stale Undo, no-change saves and API persistence. The suite starts its own isolated memory mock on port 3107; it does not write to Atlas.
- `QA.md`: observed checks and live-Atlas limitations.

Public source repository: https://github.com/oli-deacon/banyan-workflow. Publishing the source does not deploy the application or include local credentials or live database records. The public demo is authorized for synthetic testing. No real personal data or agent harness is included.
