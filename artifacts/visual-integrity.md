# Visual QA pass A — REVISE

Confidence: HIGH. Reviewed the current native React implementation against DESIGN.md and the user's “장난스럽지만 엄숙한” direction. The navy, warm paper, restrained brass and Korean serif treatment form a coherent reusable system. The supplied evidence contains two product defects and capture defects that prevent approval.

## Evidence and coverage

- Directly opened both contact sheets (`contact-375.png`, `contact-1280.png`) and individual original screenshots covering all 27 enumerated states. Individually inspected login, survey, nomination, waiting, recap and game-ready at 320px; all three hint levels, pause, reveal, taste question/results, awards, ending and admin-loading capture at 375px; closed survey, all nine admin tabs and export confirmation at 768px. Also opened the complete 375px survey.
- `visual-qa.json` enumerates 108 screenshots: 27 states × 320/375/768/1280. It reports no horizontal overflows and no page-error issues. Independently checked the PNG signature and requested width of all 108 files: no signature/width failures.
- Source inspected: tokens/components/layout styles, App, all guest screens, UI primitives, event renderer, admin navigation/progress/controls/people/data/settings, participant recovery and task hooks, private media/recap rendering, capture script and browser E2E scenario. No `.env` was read; no tests or data mutations were run by this reviewer.
- Ran a read-only browser reproduction against the local preview for the skip link, as described below. Test-suite success and actual Supabase persistence are supplied parent evidence; I did not independently rerun those suites.
- The initial captures are timestamped 00:52:33–00:52:58 UTC. A final freshness audit found concurrent source changes after those captures (`layout.css` and `EventView.tsx` at 00:56:45; `lib/snapshot.ts` at 00:57:19). Therefore the supplied captures cannot approve the newer build. This report records findings against the supplied captured build and the source inspected during the pass; regenerate the complete affected evidence before final approval.

## Blocking findings

1. **[product] [keyboard/navigation] P2 — Skip link invisibly redirects to login.** `src/App.tsx:15` uses `href="#content"` inside HashRouter. On `/#/admin`, focusing the link yields a 1×1 rectangle at (-1,-1), because `src/styles/tokens.css:148` has no focused visible variant. Pressing Enter changes the URL to `/#/login`, renders `main.invitation`, and leaves focus on BODY. A keyboard user cannot bypass the header and can lose their current route. Fix with a focus-visible skip control that prevents hash routing, focuses a `tabIndex={-1}` content target, and scrolls that target into view. Verify it preserves an admin/guest route and visibly focuses content.

2. **[product] [contrast] P2 — Closing text in the dark reveal card is unreadable.** In `09-revealed-375.png`, the closing two-line paragraph is very dark on navy. `src/components/EventView.tsx:56` renders `<p className="small">`; `src/styles/components.css:102` styles `.dark-panel small` but omits `.dark-panel .small`. Consequently this 13px text inherits `--muted` (#62665f) over `--navy` (#161c29), a computed contrast ratio of **2.91:1**. Add the class variant to the dark text override, using `--on-dark` (#d1cbbf; 10.55:1 on navy), then recapture the reveal state.

3. **[evidence] [coverage] P1 — Admin login form was never captured.** `15-admin-login-375.png` contains only the Suspense message “화면을 준비하고 있습니다.” The contact sheets show the same loading-only state, rather than the actual email/password form. `scripts/visual-qa.mjs:133` captures immediately after navigation. Wait for the actual login heading and fields, then capture all four widths. Loading can remain as a separate named state if desired.

4. **[evidence] [capture completeness] P1 — 320px survey capture is truncated.** `02-survey-320.png` is 320×1251 and ends inside QUESTION 03. Its six-question form, consent panel, submit button and footer are absent. The 375px equivalent is 375×3170 and shows all of those regions. `scripts/visual-qa.mjs:57` captures immediately following a route click and does not await settled content height. Wait for the survey's final action and stable layout, then regenerate the 320px screenshot and contact sheets.

5. **[evidence] [capture compositing] P2 — 320px nomination includes stale page-height canvas.** `03-nominate-320.png` is 320×3249 with the nomination and footer near the top followed by approximately two screenfuls of empty paper. The 375px version is 375×1327. This pairs with the preceding truncated survey and indicates a route/layout capture race, rather than evidence that the product intentionally has a 3249px nomination. Settle route content/layout before full-page capture, then regenerate the affected screenshot.

## Good — preserve these aspects

- Real form inputs, semantic headings, native dialog, details/summary, buttons, links, and live state-driven React renderers. No pasted screenshot or raster substitute stands in for the interface.
- Shared color/spacing/radius/type tokens and reused Button, Field, TextArea, Check, Select, Panel and Note primitives drive guest and admin surfaces. Small explicit geometry exceptions do not undermine the system.
- 48px button/field targets, permanent labels, native control keyboard behavior, visible focus rules for ordinary controls, error/status roles, explicit publication confirmations and textual chart counts are present.
- Admin navigation wraps, cards reflow at 768px, guest content stays bounded, and the reviewed screenshots show no horizontal overflow. Pending/reveal/paused/closed states are visibly distinct. Future hints are rendered only from the published state payload.
- Motion is limited to hint entrance/button press and has a reduced-motion override. Supplied captures deliberately use reduced motion; they establish settled-state appearance, not a recorded motion timing judgment.

## Scope limits

There is no accepted pixel reference; the rejected colorful gameshow image was not used as a target. Production-origin deployment, physical mobile behavior and the user's pending production Supabase configuration remain unverified and are not inferred from local screenshots. Re-review is required on fresh complete captures after the above fixes; this report does not approve a later source revision automatically.
