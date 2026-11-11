# Final visual QA pass A — PASS

VERDICT: PASS (design-system and functional-integrity charter)
CONFIDENCE: HIGH

The current implementation is a real, reusable React interface. Navy, warm ivory, restrained brass, Korean serif headings and the quiet orbital mark consistently express DESIGN.md and the user's “장난스럽지만 엄숙한” direction. No blocking design-system, responsive-structure, alpha/compositing or feature-wiring defect was found in this pass. The separate visual/CJK pass remains a separate gate.

## Evidence and coverage

- Reviewed `artifacts/visual-qa.json`: **108 captures, 27 states, four widths (320/375/768/1280), zero reported horizontal overflows, no page errors**, and a valid ZIP signature for the downloaded XLSX. Independently read all 108 PNG headers: every signature and requested width matched.
- Opened all four complete contact sheets under `artifacts/screens/`, covering every enumerated state at all four widths. Opened individual originals for all 27 states: login, survey, nomination, waiting, recap, game ready, hint 1/2/3, paused, revealed, taste question/results, awards, ending, closed survey, admin login, all nine admin tabs, and export confirmation. Guest states were examined at 320px and admin tabs at 375px. Also opened 768px login, 1280px reveal and export confirmation at 375/768/1280 for detail beyond the contact sheets.
- These are the fresh capture set from **2026-11-11 10:11:15–10:11:44 KST**. At review, the latest rendered-source modification was `src/admin/ProgressPanel.tsx` at 10:05:16 KST; the old stale captures are not the basis of this verdict. No source was edited and the mutation-bearing visual-capture script was not rerun.
- Read DESIGN.md; all three stylesheet files; App; shared UI primitives; EventView; guest login/survey/nomination/event/participant; admin navigation/login/progress/game controls/settings/people/data/recap/round/taste screens; private-media and recap components; API, participant recovery and task hooks; Edge Function entry points; relevant RPC migration paths; and existing E2E interaction scenarios.
- Ran only **read-only browser checks** on preview port 4173, without logging in or writing the database: Tab/Enter on the skip control on guest login and admin login. Both preserved their route and focused `#content`; the focused control was visible at top 16px. Guest login moved the viewport to the content as expected. No credentials or environment files were read.

## Findings

**Blocking: none in this pass.**

The former integrity report's defects are resolved in the reviewed current evidence:

1. Skip navigation uses a real button and focusable content target (`src/App.tsx`), with a visible focused state (`src/styles/layout.css`). The prior HashRouter redirect was not reproduced.
2. `.dark-panel .small` now receives `--on-dark` (`src/styles/components.css`). Both 320px and 1280px reveal originals show readable light closing copy on navy.
3. Admin-login captures show the actual email/password form at every width, rather than the lazy loading message.
4. The complete 320px survey includes all six questions, consent, submit, logout and footer; the following nomination has its natural page height.

The export-confirmation full-page images include document areas above and below the current viewport, while the fixed native backdrop covers the viewport. Their offviewport skip control appears at document `scrollY - 100px`, consistent with the hidden fixed top offset; this does not demonstrate a live visible skip control above the modal. The dialog itself is complete, readable and within its viewport at each width. No black compositor gaps or substituted page images were observed.

## Good — preserve these aspects

- **Real design system:** shared color, type, spacing, radius and layout tokens; common Button/Field/TextArea/Select/Check/Panel/Note/Confirm components; shared event renderer used by guest pages and organizer preview. Screens are semantic, live DOM forms and controls, not a screenshot or background-image stand-in. The only content raster renderer is the actual private photo/logo component.
- **Responsive structure:** bounded guest columns, two-column invitation/admin layouts from 768px, wrapped admin navigation and stacked records below the breakpoint. Narrow originals show usable fields and controls without horizontal clipping. The organizer preview uses a container-aware ending heading, avoiding the earlier narrow preview problem.
- **Feature wiring:** guest verification, survey save, nomination, admin edits/publication and exports call validated Supabase APIs. Edge Functions route these to real SQL RPC/storage paths. Participant display subscribes to public state and has polling/online/visibility recovery with revision protection. Future hints are not hidden elements in the renderer; only the received published hints are rendered. This is a source trace, supplemented by the supplied real capture run and existing E2E scenarios, not an independent rerun of mutation tests.
- **Accessible states:** permanent labels, semantic alert/status notices, native disclosure controls and dialogs, ordinary-control focus rules, textual counts beside bars, visible closed/paused/waiting states and pending labels. Buttons and fields have 48px minimum geometry; ordinary nav controls retain native keyboard behavior. First dialog action is cancellation.
- **Purposeful motion:** hint entrance is a short state-related opacity/translation; button press indicates interaction. There is no decorative looping animation and reduced-motion is supported. Captures use reduced motion, so this pass approves settled appearance and the source motion contract, not an independently recorded animation timeline.

## Scope boundaries

No accepted pixel-perfect reference exists. The rejected pink/game-show direction was not used as a target. Detailed CJK line-breaking judgment belongs to the companion pass; in particular the 320px waiting heading and 768px invitation heading should receive its explicit typography judgment. Physical-device rendering, production-origin behavior and production Supabase setup are not established by this local pass. Full end-to-end mutation and security verification are supplied by their separate reviewers; they were deliberately not rerun here.
