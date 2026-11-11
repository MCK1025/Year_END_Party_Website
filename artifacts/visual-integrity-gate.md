# Fresh final visual QA — Pass A integrity gate

VERDICT: **PASS**
CONFIDENCE: **HIGH**
BLOCKING: **None in the design-system / functional-integrity scope.**

The current navy, ivory, Korean serif and restrained brass interface remains a real React product built from reusable primitives. The final `.event-cover > p { text-wrap: balance; }` correction is present in both source and the built CSS. The new complete capture set shows no integrity, responsive structure, compositor or feature-wiring regression. This is a fresh independent review, not reuse of the earlier approval.

## Current evidence and complete coverage

- Read `DESIGN.md` as the visual contract: “장난스럽지만 엄숙한,” quiet orbital identity, warm paper and editorial serif/sans hierarchy. There is no accepted pixel-exact reference. The rejected pink/game-show concept was not used as a target.
- Independently audited `artifacts/visual-qa.json`: **108 captures = 27 states × 320/375/768/1280px**, with exactly one file for every state/width pair, no missing pairs or duplicates, all 108 PNG signatures valid and all 108 header widths correct. Every recorded overflow is false; the issues array is empty; the XLSX result records a valid ZIP signature.
- The actual individual PNG modification times are **2026-11-11 10:20:52–10:21:17 KST**. Contact sheets were written at **10:21:19–10:21:20 KST**. These are later than the final rendered-source edit (`src/styles/layout.css`, **10:17:16**) and all current bundled assets (**10:18:12**). `index.html` and public files also predate this set. The built `index-BjJY2JeJ.css` explicitly includes the balance rule.
- Directly opened all four `artifacts/screens/contact-{320,375,768,1280}.png` sheets and individual originals for **all 27 states**. Guest/closed/admin-login originals were inspected at 320px; administrator tabs 1–8 at 375px and tab 0 at 320px; export confirmation at 320px. Also opened the 768px invitation. The contact sheets cover the remaining responsive combinations.
- Enumerated states: `01-login`, `02-survey`, `03-nominate`, `04-waiting`, `05-recap`, `06-game-ready`, `07-hint-1`, `07-hint-2`, `07-hint-3`, `08-paused`, `09-revealed`, `10-taste-question`, `11-taste-results`, `12-awards`, `13-ending`, `14-survey-closed`, `15-admin-login`, `16-admin-0` through `16-admin-8`, and `17-export-confirm`.

## Integrity findings

**No blocking findings.**

| Dimension | Verdict | Concrete evidence |
| --- | --- | --- |
| Real design system | PASS | `src/styles/tokens.css` defines shared palette, type, spacing, radii and layout utilities. `src/styles/components.css` implements reusable button variants, fields, panels, notices, dialog, status, hint and chart anatomy. `src/components/ui.tsx` supplies labeled semantic primitives reused throughout guest and organizer screens. |
| Live DOM, no screenshot substitute | PASS | `src/App.tsx`, guest pages and administrator panels render real routes, forms, controls and text. Source search finds only the legitimate content `<img>` in `src/components/PrivateImage.tsx`; no background-image, canvas or pasted page image implements the UI. PrivateImage obtains expiring signed media URLs. |
| Responsive structure | PASS | Single-column guest forms, the 768px invitation/admin grid transition, wrapped organizer navigation and stacked records remain coherent across the complete contact sheets. Narrow originals show complete controls and naturally extending content. The organizer preview is container-sized; its ending title and balanced body stay inside the nested panel. |
| Alpha / compositing | PASS | No black compositor gaps, missing regions or unexpected opaque fills were observed. Navy panels are intentional surfaces; the export dialog has the expected native translucent backdrop. PNG formats and widths are valid. No numerical alpha-channel diff was supplied, so this is direct image/source inspection. |
| Guest persistence and navigation | PASS | Login performs anonymous Auth, employee verification and bootstrap before routing. `Survey.tsx` and `Nominate.tsx` await their real `save_survey` / `nominate` APIs, refresh server data and then navigate. Closed form controls and submit actions are disabled. Pending/error/success states use shared components. |
| Publication / organizer controls | PASS | `Admin.tsx` routes nine real tabs from server dashboard data. `ProgressPanel.tsx` validates commands, attaches the current revision and uses native confirmation for public transitions. Content editors call typed APIs and refresh. `SettingsPanel.tsx` confirms exports; `exportData.ts` fetches server data and generates real CSV/XLSX downloads. |
| Live synchronization | PASS | `useParticipant.ts` subscribes to real Postgres changes, validates incoming state, rejects older revisions and refreshes on subscription, online/visibility recovery and a polling interval. `EventView.tsx` renders received published hints only; unrevealed hints are not hidden DOM placeholders. |
| Purposeful motion | PASS | The only source motion is stateful 180ms hint entrance and button press feedback, with reduced-motion support. No decorative loop or noninteractive hover animation was found. |

The API trace reaches `supabase.functions.invoke` in `src/lib/api.ts`, authenticated/validated Edge handlers, and the real `portal` SQL RPC in `supabase/functions/_shared/http.ts`. The subsequent migration `202611110008_history_barrier.sql` advances the public revision for protected content mutations, consistent with the existing revision-protected command flow; it introduces no UI mock path. Its dedicated security review is `artifacts/security-history-gate.md` and is not replaced by this visual review.

The 320px export-confirmation full-page PNG includes document areas outside its current viewport. The native backdrop correctly covers only that viewport; the offviewport fixed skip button is displaced by its hidden `top: -100px` rule. This is consistent with the earlier resolved capture interpretation, not evidence of an actionable skip button above the live modal. The dialog itself is complete and inside its viewport.

## Good — preserve

- The solemn paper/navy identity, small orbital mark, restrained brass and Korean serif hierarchy remain consistent through invitation, guest content and organizer tools.
- Permanent labels, native controls, visible focus styling, textual status/counts, 48px main controls and cancel-first native dialogs remain intact.
- Reveal closing copy is readable on navy. The complete survey and closed-survey captures contain all six questions, consent, submit, logout and footer. Administrator login is fully settled rather than a lazy-loading placeholder.
- The final balanced ending body is visible in the guest and nested organizer preview; it does not change state handling or component structure.

## Evidence limits

This read-only lane did not execute scripts, authenticate, mutate the database, edit source, or repeat test suites. `artifacts/operations-test.json` records ten passing checks; `artifacts/load-test.json` records 50/50 clients, p95 102ms, no unrevealed-hint leak, and restored state. These were read as existing execution evidence. The parent reports 20 integration and two E2E passes; `test-results/.last-run.json` confirms a passed run without enumerating its count. The E2E source traces the actual guest save/reload and organizer reveal flow.

The capture script records guest page errors; its empty issues array should not be generalized to an independently instrumented error check on every organizer tab. Screenshots use reduced motion and approve settled appearance; no fresh motion timeline was recorded here. Detailed CJK judgment is the independent companion gate. Physical devices, deployed origins and production configuration remain outside this local approval. Only this report was written.
