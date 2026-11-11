# Code-quality review

Verdict: **FAIL — three actionable correctness blockers in the reviewed snapshot.**

Scope: React data flow, Realtime/reconnect, admin commands, SQL transactions, request/response contracts, and CSV/XLSX exports. Read-only review; only this report was written. No database-changing commands or integration/E2E/load suites were run by this reviewer. Production deployment remains unverified.

## Findings

### [P1] A permitted survey answer can make the entire admin dashboard unreadable

Location: `supabase/functions/_shared/contracts.ts:32` (supporting code: `supabase/migrations/202611110004_admin.sql:55`).

`save_survey` accepts answers up to 500 characters, and automatic taste aggregation uses the complete answer as its result label. The reviewed `resultSchema` instead requires the shared `short` string, capped at 100 characters. A normal 101-character free-text answer can therefore be persisted into an automatically generated taste, after which every `dashboardSchema` parse fails. Because the dashboard always returns all tastes, a fresh admin login also fails; there is no taste deletion UI through which to recover.

Evidence: importing the actual contracts in Node and checking a synthetic 101-character Korean answer produced `surveyAccepted:true`, `aggregateAcceptedByDashboard:false`, with `too_big`, maximum `100`, at `[0,"label"]`. SQL aggregation persists that full label without shortening it. This probe made no API or database calls.

Required change: align result labels with the supported 500-character survey answer contract, or define an explicit safe normalization before persistence. Add a regression covering an automatically aggregated long free-text answer.

### [P1] A delayed bootstrap response restores an older, withdrawn public hint

Location: `src/lib/useParticipant.ts:12` (contrast with the guarded Realtime update at line 27).

`refresh()` unconditionally replaces the complete participant state. A bootstrap request can read revision 1 and remain in flight while Realtime delivers revision 2, including the empty payload produced by consent withdrawal. When the earlier HTTP response completes, it restores revision 1 and its withdrawn hints. The next periodic refresh may repair the display up to 20 seconds later, but the confidentiality invalidation and live event order have already regressed. Refreshes are triggered independently by polling, visibility, online events, and subscription recovery, so overlapping completions are realistic.

Evidence: executed the actual transpiled hook with in-memory React state, a deferred API adapter, and its captured Realtime callback. Immediately after revision 2 was delivered, observed `{"phase":"WHO_AM_I","revision":2,"paused":false,"payload":{}}`. Resolving the pending revision-1 bootstrap then produced `{"phase":"WHO_AM_I","revision":1,"paused":false,"payload":{"hints":["withdrawn hint"]}}`. No database or network calls were made.

Required change: retain the newest public-state revision when applying bootstrap responses, and prevent superseded responses from restoring data after a newer authorization failure. Cover the ordering with a deferred-response regression test.

### [P2] A confirmation dialog silently adopts another operator's newer revision

Location: `src/admin/ProgressPanel.tsx:34` and `src/admin/ProgressPanel.tsx:142`; pending model at `src/admin/GameControls.tsx:10`.

Pending commands store only a label and partial command. When the dashboard's 20-second poll changes the current state while a confirmation dialog remains open, `send()` reads the new render's `state.revision`. An operator who opened the answer-reveal dialog for round A can therefore confirm after another operator started and hinted round B; the submitted command now carries B's current revision and the SQL optimistic-concurrency check succeeds, revealing B. The same issue affects taste reveal, restart, waiting/reset, and undo confirmations.

Evidence: executed the actual transpiled `ProgressPanel` with in-memory state/context/JSX adapters. Opened a confirmation at round A revision 1, rerendered with round B revision 2, then called the preserved dialog action. Observed `{"confirmedLabel":"Reveal person A?","sent":{"action":"command","payload":{"command":"reveal","revision":2,"rehearsal":false}}}`. SQL `private.command` validates only the supplied revision and `reveal` acts on the current round. No API or database calls were made.

Required change: capture the state revision when opening the confirmation and submit that exact revision. A changed state should produce the existing conflict response or require a fresh confirmation.

## Checks and limits

- Installed TypeScript binary, `node node_modules/typescript/bin/tsc --noEmit`: PASS.
- Installed Biome binary, `node_modules/.bin/biome.cmd check src tests scripts supabase/functions vite.config.ts`: PASS, 51 files, no fixes applied.
- `pnpm typecheck` and `pnpm lint` wrappers aborted before running their checks because pnpm attempted dependency reconciliation without a TTY. The installed binaries above were used without changing dependencies.
- SQL review found the settings-row locking, serialized event updates, revision conflict check, and audit insertion in the same transaction coherent. The confirmation bug occurs before that SQL check by supplying the wrong revision.
- Export review found a privileged audited RPC, omission of birth dates and access-code hashes, and spreadsheet-formula escaping in both CSV and XLSX paths. Browser multiple-download blocking is disclosed by the UI. No additional export blocker found.
- Parent-provided integration, E2E, and 50-connection results were considered context only; they were not rerun or independently claimed by this reviewer.

These findings describe the source at initial review. Root was notified while reviewing and is implementing fixes separately; a final PASS requires re-review of those changes and their regression evidence.
