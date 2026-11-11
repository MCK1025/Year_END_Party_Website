# Final independent QA delta — PASS

Reviewed 2026-11-11, 10:14–10:18 KST, using installed Playwright Chromium against `http://127.0.0.1:4173`. This is an independent, read-only delta review of the rebuilt preview. It resolves the keyboard blocker in `artifacts/review-qa.md`; it does not replace the separate authenticated visual/security reviews.

**Blocking findings: none in the assigned delta scope.** The previous P2 skip-navigation issue is fixed in the rendered build, on both login routes.

## Independently executed checks

23 browser checks pass after correcting two harness assumptions: HTML inputs without a `type` attribute have the effective DOM type `text`; a fresh admin page is required to test initial Tab order, rather than reusing focus retained after same-URL navigation. These were test-harness corrections, not source changes.

| Check | Result and observed evidence |
| --- | --- |
| Initial login keyboard focus | PASS. First Tab focuses `button.skip-link` labeled `본문으로 이동`. It is visible at x=16, y=16, width=149.625, height=51.1875 px, with clip=auto and a solid 2px outline. |
| Login skip activation | PASS. Enter focuses `#content` and retains `#/login`. |
| Initial admin keyboard focus | PASS on a new unauthenticated page. First Tab reaches the same visible skip button. |
| Admin skip activation | PASS. Enter focuses `#content` and retains `#/admin`. |
| Login landmarks | PASS. One main and one h1. |
| Login labels and masking | PASS. Exact accessible names `이름`, `생년월일`, and `개인 행사코드` each resolve one required input; effective types are text/date/password. |
| Code description | PASS. aria-describedby resolves the permanent individual-code helper text. |
| Empty submission | PASS. Three required invalid inputs; no mutation request. |
| Missing DOB | PASS. Native required validation blocks submission. |
| Short code | PASS. Five-character code has validity.tooShort and produces no mutation request. |
| Input limits | PASS. Name/code fills are constrained to 60/80 characters. |
| Login responsive geometry | PASS at 320/375/768/1280 px. Document scrollWidth equals viewport width in each case. All three inputs are 51.59375 px high; submit is 48 px high. Control widths are 238/261/253.234375/415.15625 px respectively. |
| Admin entry | PASS. Organizer link opens the unauthenticated admin form at `#/admin`. |
| Admin required/email validation | PASS. Empty submission is blocked; malformed email has validity.typeMismatch. Neither attempts an Auth mutation. |
| Admin password | PASS. type=password. |
| Admin 320 px geometry | PASS. scrollWidth=320 at viewport=320. |
| Runtime/network safeguards | PASS. Zero pageerror events and zero attempted non-GET/HEAD/OPTIONS requests across both browser passes. |

The source correction is at `src/App.tsx:15–27` (button action calls focus without changing the URL), `src/App.tsx:31` (`#content` has tabIndex=-1), and `src/styles/layout.css:287–298` (focus reveal). No source was changed during this review.

## Refreshed artifact audit

- `artifacts/visual-qa.json` enumerates 108 captures: 27 states at 320/375/768/1280 px, zero recorded overflow, and an empty issues list. Independently checked all 108 files: every PNG exists, has a PNG signature, and has the declared width.
- Captures now date from 2026-11-11T01:11:15.078Z through 01:11:41.348Z. The QA JSON is dated 01:11:44.380Z. These postdate the relevant source edits: App 01:01:34.379Z, layout/components/EventView 00:59:50Z, and built assets 01:05:31Z. The stale-evidence objection in the earlier report is resolved for these changes.
- Directly opened the fresh 320 px login and admin-login PNGs. They contain rendered Korean DOM forms with readable labels, full controls, and no clipping/blank compositor regions. Full authenticated visual fidelity remains the parallel visual reviewer's remit; this delta does not claim all 108 images were visually inspected by this reviewer.
- `test-results/.last-run.json` is dated 01:07:59.779Z and records `status: passed`, `failedTests: []`. This marker does not encode the count. The source contains two E2E cases, matching the parent's reported two-case passing run. No state-changing suite was rerun here.

## Persistence and closed-form source trace

Real persistence is implemented, rather than a local success-only mock: `src/pages/Survey.tsx:34` invokes `save_survey`, awaits refresh, then navigates; `src/pages/Nominate.tsx:36` invokes `nominate`, awaits refresh, then navigates. `src/lib/api.ts:20` dispatches through the Supabase Edge Function. `supabase/migrations/202611110002_participants.sql:55` and `:71` reject writes after closing and use PostgreSQL insert/on-conflict updates for survey and final nomination.

Existing tests were inspected, not executed: `tests/e2e/party.spec.ts` fills and saves the survey and nomination through the browser, reloads, and expects the saved completion status; it also exercises real organizer publishing and participant updates through ending. `tests/e2e/confirmation.spec.ts:6` exercises an outdated confirmation against an advanced server revision and expects rejection. `tests/integration/service.test.ts:36` checks five persisted surveys and employee row isolation; `:205` closes the survey and expects a subsequent server write to fail. Closed survey controls and submit are disabled in `src/pages/Survey.tsx:55`, `:71`, `:81`, `:89`, `:103`, and `:108`; closed nomination selection/reason/submit are disabled in `src/pages/Nominate.tsx:52`, `:66`, and `:73`. The visual script also captures `14-survey-closed`. This is a source/evidence trace, not a newly witnessed authenticated closed-form interaction.

## Scope and limits

No environment credentials were read, no successful login was performed, and no database mutation, integration/E2E/load suite, visual capture script, or production action was run. Browser routing proactively blocked mutation methods; none was attempted. Only this report was written. The requested Visual QA skill was applied to evidence freshness, capture integrity, responsive checks, and direct image inspection; the parent coordinates the independent full-surface visual passes.

The prior report's production, physical-mobile, sustained-load, Lighthouse, and workbook semantic-validation limits remain. They do not block this specific rebuilt-preview delta approval, and this PASS is not a production-readiness certification.
