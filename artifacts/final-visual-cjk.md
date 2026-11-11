# Fresh independent visual QA — Pass B

VERDICT: REVISE

CONFIDENCE: HIGH

The navy, warm ivory, serif headings, fine brass rules and restrained orbital mark satisfy the requested “장난스럽지만 엄숙한” direction. The previous contrast, dialog placement, heading and capture-timing findings are resolved. One remaining Korean semantic wrap in the ending preview blocks a pass.

## Evidence and complete state coverage

- Read `DESIGN.md`, every field of `artifacts/visual-qa.json`, the previous `artifacts/visual-cjk.md`, `src/styles/{tokens,components,layout}.css`, relevant `EventView.tsx` / `App.tsx` / confirmation source and the capture readiness logic.
- Directly opened all four contact sheets: `contact-320.png`, `contact-375.png`, `contact-768.png`, `contact-1280.png`. Their downscaled overview was supplemented by opening **every one of the 27 states individually at 320px**, with original-detail images.
- Additionally opened individual 768px invitation, survey, nomination, waiting, revealed, ending, admin login, live admin, question management, rehearsal and export confirmation; 375px revealed, admin login, live admin and export confirmation; 1280px invitation, live admin and export confirmation.
- All 27 states were inspected: `01-login`; `02-survey`; `03-nominate`; `04-waiting`; `05-recap`; `06-game-ready`; `07-hint-1`, `07-hint-2`, `07-hint-3`; `08-paused`; `09-revealed`; `10-taste-question`; `11-taste-results`; `12-awards`; `13-ending`; `14-survey-closed`; `15-admin-login`; `16-admin-0` through `16-admin-8`; `17-export-confirm`.
- JSON: **108 captures / 27 states / widths 320, 375, 768, 1280**; all `overflow:false`; `issues:[]`; `xlsxDownload:"valid ZIP signature"`. These fields support geometry/runtime/download observations, not visual approval. No exact reference image is applicable: the rejected colorful concept is not a target, and diffRatio, similarityScore and hotspots are consequently inapplicable.
- Evidence is fresh relative to the source inspected: latest source write was `ProgressPanel.tsx` at 10:05:16; the contact sheet and JSON were written at 10:11:42 and 10:11:44 on 2026-11-11.

## Blocking finding

1. **[product] [P2] The ending-preview body still splits the counter phrase `한 걸음도`.** In `artifacts/screens/16-admin-0-768.png`, approximately x457–685 / y865–934, the final sentence wraps `우리의 다음 한 / 걸음도 함께해요.`. The same split is visible in `16-admin-0-1280.png`, approximately x762–1132 / y842–881. The fixed heading above it correctly keeps `다음 한 걸음도,` together, but `src/components/EventView.tsx:143` renders `p.message` as an ordinary paragraph, so that protection does not cover the message. Preserve the semantic phrase in the ending message, or adjust its wrapping/layout so `한 걸음도` remains together; verify the rendered nested preview at all four widths. The 375px capture already demonstrates a natural alternative: `우리의 다음 / 한 걸음도 함께해요.`.

## Resolved findings and evidence trace

- **Revealed-card contrast:** the closing paragraph is now visibly light on navy at 320/375/768. `.dark-panel .small` uses `--on-dark`; the earlier dark-gray-on-navy defect is gone.
- **Ending heading:** `다음 한 걸음도,` stays intact in the nested preview at 320/375/768/1280. Container-scoped typography and `.keep-phrase` fixed the original heading issue. Preserve this while fixing the separate body issue above.
- **Confirmation placement:** all four individual dialog captures show balanced horizontal gutters and centered placement; `margin:auto` is explicit. Title, body and both actions fit without clipping.
- **Survey and nomination captures:** the 320px survey now contains questions 1–6, consent, save, logout and footer. Nomination ends after its footer without the old misleading blank tail.
- **Admin-login coverage:** the actual heading, email/password fields and submit button appear in all four contact-sheet states and the individually inspected 320/375/768 captures. No loading placeholder substitutes for this state.
- **Modal full-page capture behavior:** the backdrop covers the captured viewport band rather than the full long document. The offscreen fixed skip control also appears above that band in these full-page images; its position corresponds to viewport-top minus the CSS `top:-100px`. These pixels are consistent with off-viewport full-page capture composition, not evidence that the live dialog exposes an interactive skip control. They do not obscure the modal or prevent its visual review.

## Good aspects to preserve

- Every state retains the same quiet ceremonial palette, Korean serif/sans hierarchy, generous spacing and modest panel/rule treatment. The invitation year and orbit provide the playful note without turning the event into a gameshow.
- No missing Korean glyphs, clipped baselines, layout overlap or horizontal clipping was found in the inspected states. Guest navigation and admin controls wrap into rows; cards stack at narrow widths and form two columns at 768px.
- Labels, survey consent, numbered hint progression, status text, chart counts, disabled states and distinct confirmation actions remain legible. Native single-line input/select value clipping follows their expected scrolling/truncating control behavior and was not misclassified as clipped page copy.

BLOCKING: finding 1. No source changes, database writes, script reruns or child agents; this report is the only file written.
