# Independent visual QA pass B

VERDICT: REVISE
CONFIDENCE: HIGH

The navy, warm ivory, Korean serif, muted brass, fine rules and restrained orbit match the requested playful but solemn invitation. The supplied evidence nevertheless has three product blockers and two capture blockers. No rejected gameshow mockup was used as a target.

## Evidence and coverage

- Read `DESIGN.md`, all fields of `artifacts/visual-qa.json`, the typography/layout/component CSS, `EventView.tsx`, relevant preview source and capture script.
- Directly opened both contact sheets covering all 27 named states at 375 and 1280. Opened every state individually at 320. Additionally opened 375 survey, nomination, reveal, admin login, live admin and export dialog; 768 invitation, survey, admin login, live admin, questions, rounds, rehearsal and export dialog. Long-image tool downscaling was accounted for by reopening detailed captures with original detail.
- JSON contains 108 captures, 27 states, widths 320/375/768/1280, all `overflow:false`, `issues:[]`, and `xlsxDownload:"valid ZIP signature"`. These establish geometry/runtime observations, not a visual pass. There is no exact pixel reference, so diffRatio, similarityScore and hotspots are inapplicable. Relevant source files predate the supplied evidence.
- All 27 states inspected: login; survey; nominate; waiting; recap; game-ready; hint-1; hint-2; hint-3; paused; revealed; taste-question; taste-results; awards; ending; survey-closed; admin-login; admin-0 through admin-8; export-confirm.

## Blocking findings

1. **[product] [P2] Closing copy on the revealed-person card fails contrast.** `artifacts/screens/09-revealed-375.png`, approximately x49–293/y1068–1100, visibly dark gray closing paragraph on navy; also visible at 320. `src/components/EventView.tsx:56` renders `<p className="small">`. `src/styles/components.css:100` overrides `.overline`, `.muted` and the `small` element but omits `.small`, so the 13px copy remains `--muted` (#62665f) against `--navy` (#161c29): calculated sRGB contrast **2.91:1**, below 4.5:1 for this text. Add `.dark-panel .small` to the on-dark override; `--on-dark` gives 10.55:1. Re-capture the revealed state at all widths.

2. **[product] [P2] Nested ending-preview heading breaks a Korean semantic unit.** `artifacts/screens/16-admin-0-768.png`, preview heading approximately x500–656/y786–951, reads `다음 한 / 걸음도, / 함께.`; `16-admin-0-320.png` shows the same break. This separates the counter phrase `한 걸음` inside a short heading. `src/styles/layout.css:153` sizes `.event-cover h1` by viewport (`6vw`) while `src/styles/layout.css:231` adds padding to the narrow `.progress-preview` container used at `src/admin/ProgressPanel.tsx:124`. Use container-aware or preview-specific typography/spacing so `다음 한 걸음도,` remains a line, or at minimum keep `한 걸음도,` together. Verify both 320 and the 768 two-column boundary.

3. **[product] [P2] Confirmation dialog loses its left gutter and centered placement.** `artifacts/screens/17-export-confirm-375.png`, dialog rectangle x0–337/y505–861; `17-export-confirm-768.png`, x0–480/y269–599. The dialog touches the left edge and leaves all spare horizontal space at right. `src/styles/components.css:142` specifies a reduced width but no margin after the imported Tailwind reset. Restore explicit dialog centering (`margin:auto`, with appropriate inset behavior) and preserve at least the intended 16px side gutters. The full-page backdrop's finite vertical extent follows viewport capture and is not itself a reported product defect.

4. **[evidence] [P2] Admin-login state is not captured.** All four `15-admin-login-*.png` images show only `화면을 준비하고 있습니다.` rather than the heading, email/password fields or submit button; e.g. 375 image x24–351/y137–185. `scripts/visual-qa.mjs:133` captures immediately after navigation, before waiting for the administrator email field. Wait for the actual login form and settled layout before capture. This is a coverage blocker, not proof the login product is broken.

5. **[evidence] [P2] The 320 survey capture is incomplete and the next route retains a misleading canvas height.** `artifacts/screens/02-survey-320.png` is only **320×1251** and ends inside question 3 at its bottom edge: questions 4–6, consent, save and logout are absent. The same survey at 375 is **375×3170** and contains all content; the closed 320 survey likewise shows the complete form. `03-nominate-320.png` is **320×3249** with a large blank tail after its footer, while 375 nomination is **375×1327**. These are consistent with capture racing route/layout settlement. `scripts/visual-qa.mjs:25` immediately resizes then screenshots. Wait for page-specific content, fonts/layout readiness and stable document dimensions before each full-page screenshot; re-shoot the defective captures. Do not certify complete 320 survey coverage from `overflow:false`.

## Good aspects to preserve

- Guest headings, hint dividers, survey cards, result bars, awards and closing screen maintain a quiet ceremony rather than a gameshow costume.
- The rendered Korean glyphs are legible; no tofu, clipped glyph baselines or horizontal clipping were found in the inspected settled guest states. Guest and admin navigation wrap into usable rows. Buttons and form controls use the shared 48px minimum rules.
- Survey and nomination copy, labeled controls, explicit consent, numbered hints, text alongside status color and numeric chart counts retain clear hierarchy. The captured export dialog has readable title/body and distinct cancel/confirm controls despite its placement defect.

BLOCKING: findings 1–5. No source, database or test-suite mutation performed; this report is the only file written.
