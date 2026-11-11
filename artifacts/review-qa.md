# Independent read-only QA

Verdict: FAIL for the tested preview build. One P2 keyboard-navigation defect has two causes and three failing checks. The parent reports the source is now fixed; a fresh build and delta review are required before approval. This report does not certify the untested correction.

Reviewed 2026-11-11, approximately 09:54–10:00 KST. Repository: `C:/Users/minch/source/GitRepos/Year_END_Party_Website`. Preview: `http://127.0.0.1:4173/#/login`. Browser: installed Playwright Chromium, fresh isolated context, reduced motion, no stored login.

## Scope and safeguards

Independent checks were limited to existing pure unit tests, TypeScript, lint, unauthenticated form validation, keyboard navigation, responsive login geometry, and artifact inspection. No successful login, raw .env read, integration/E2E/load/visual-qa script execution, event-state change, or production access occurred. Browser request monitoring recorded zero non-GET requests and zero pageerror events throughout the UI scenarios. Only this Markdown artifact was written.

## Independent command evidence

| Check | Outcome | Evidence |
| --- | --- | --- |
| TypeScript | PASS | `node node_modules/typescript/bin/tsc --noEmit` exited 0. |
| Lint | PASS | `node node_modules/@biomejs/biome/bin/biome check src tests scripts supabase/functions vite.config.ts` exited 0: 51 files, no fixes. |
| Pure unit suite | PASS | `node node_modules/vitest/vitest.mjs run tests/unit` exited 0: 1 file, 9 tests, 453 ms. These cover CSV BOM/quoted Korean text, duplicate employee rejection, invalid calendar dates, and six spreadsheet formula prefixes. |

Plain `pnpm typecheck`, `pnpm lint`, and `pnpm test` first aborted with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` because the host wrapper attempted an automatic dependency-status install. No force/CI override was used. Existing binaries then completed the checks without installation. The parent identifies `npx --yes pnpm@10.32.1 <script>` as the pinned, previously passing tool context. This is a host-wrapper caveat, not a product test failure.

## Independently executed browser scenarios

25 scenarios: 22 PASS, 3 FAIL, all three failures belong to the same skip-link defect. Screenshot buffers were viewed directly in-session at 1280px and 320px without adding files. Both show the native Korean DOM interface with readable content; the 320px cover and form stack vertically.

| Scenario | Result | Concrete observation |
| --- | --- | --- |
| login-load | PASS | {"title":"한 걸음 더 가까이 · 2026","main":1,"h1":1} |
| field-labels | PASS | 3 permanent labels resolve exact accessible names |
| private-metadata | PASS | lang=ko; noindex,nofollow |
| password-masking | PASS | individual code is password input |
| code-helper | PASS | {"id":"_r_2_-hint","text":"개별 안내받은 코드를 입력해주세요."} |
| empty-submit | PASS | {"invalid":4,"nonGetRequests":0} |
| missing-dob | PASS | native required DOB blocks submission without request |
| short-code | PASS | 5-character code rejected; no auth/network mutation attempted |
| whitespace-name | PASS | {"alert":"입력 내용 또는 서버 응답 형식을 확인해주세요.","nonGetRequests":0,"buttonEnabled":true} |
| name-limit | PASS | 65-character fill constrained to 60 characters |
| code-limit | PASS | 85-character fill constrained to 80 characters |
| skip-visible-on-focus | FAIL | {"text":"본문으로 이동","href":"#content","width":1,"height":1,"clip":"rect(0px, 0px, 0px, 0px)","outline":"solid"} |
| skip-target | FAIL | {"url":"http://127.0.0.1:4173/#/login","expected":"skip activation keeps route and focuses content"} |
| tab-name-to-dob | PASS | {"focusedType":"date"} |
| submit-focus | PASS | {"tag":"BUTTON","text":"우리의 자리로 ","outline":"solid","outlineWidth":"2px"} |
| admin-keyboard-link | PASS | Tab from submit reaches organizer link |
| admin-link | PASS | Enter opens admin login without successful auth |
| admin-empty-submit | PASS | required email blocks submission |
| admin-email-validation | PASS | malformed email rejected before Auth call |
| admin-password-mask | PASS | password type=password |
| skip-admin-route-preservation | FAIL | {"url":"http://127.0.0.1:4173/#/login","focused":"BODY"} |
| responsive-320 | PASS | {"viewport":320,"scrollWidth":320,"controls":[{"tag":"INPUT","height":51.59375,"width":238},{"tag":"INPUT","height":51.59375,"width":238},{"tag":"INPUT","height":51.59375,"width":238},{"tag":"BUTTON","height":48,"width":238}],"columns":"288px"} |
| responsive-375 | PASS | {"viewport":375,"scrollWidth":375,"controls":[{"tag":"INPUT","height":51.59375,"width":261},{"tag":"INPUT","height":51.59375,"width":261},{"tag":"INPUT","height":51.59375,"width":261},{"tag":"BUTTON","height":48,"width":261}],"columns":"327px"} |
| responsive-768 | PASS | {"viewport":768,"scrollWidth":768,"controls":[{"tag":"INPUT","height":51.59375,"width":253.234375},{"tag":"INPUT","height":51.59375,"width":253.234375},{"tag":"INPUT","height":51.59375,"width":253.234375},{"tag":"BUTTON","height":48,"width":253.234375}],"columns":"368.766px 351.234px"} |
| responsive-1280 | PASS | {"viewport":1280,"scrollWidth":1280,"controls":[{"tag":"INPUT","height":51.59375,"width":415.15625},{"tag":"INPUT","height":51.59375,"width":415.15625},{"tag":"INPUT","height":51.59375,"width":415.15625},{"tag":"BUTTON","height":48,"width":415.15625}],"columns":"538.828px 513.156px"} |

Responsive checks compare `document.documentElement.scrollWidth` to viewport width and require every login input/button to have nonzero width and height >=48px. Measured scroll widths equal 320, 375, 768, and 1280 respectively. The grid is one column at 320/375 and two columns at 768/1280. No pageerrors were emitted.

## Blocking finding from tested build

**P2: keyboard skip navigation is invisible and changes routes.** In the tested `src/App.tsx`, the first link was `<a className="sr-only" href="#content">`. In `src/styles/tokens.css`, `.sr-only` clips it to 1×1px and has no focus reveal. Fresh login → Tab focused this link while it stayed 1×1px with `clip: rect(0px, 0px, 0px, 0px)`. Enter changed the hash to the unrecognized HashRouter route; the wildcard redirected to `#/login`, with focus on BODY. Reproduction from the admin login likewise navigated to `#/login` instead of retaining `#/admin` and moving focus to content. This defeats the promised keyboard bypass and can discard the current route/form state.

Expected correction: reveal the skip link on focus and use a route-preserving focus/scroll action targeting a programmatically focusable content container. The parent reports this is fixed in source after the capture. The corrected preview was not reviewed in this pass.

## Existing artifact audit (inspection only, not independent execution)

- `artifacts/visual-qa.json` enumerates 108 PNGs: 27 UI states × 320/375/768/1280 px. All 108 exist, match PNG signatures, and have the declared widths. It records zero overflow and zero issues. Captures are dated 00:52:33.024Z through00:52:58.140Z. State coverage includes login, survey, nomination, waiting, recap, game ready, three hint stages, pause, reveal, taste question/results, awards, ending, closed survey, admin login, nine admin panels, and export confirmation.
- Those captures verify the earlier build only. Source edits at 00:56:44–45Z (`App.tsx`, `EventView.tsx`, layout/components CSS) postdate them, and the earlier dist assets are dated 00:47:44Z. They cannot support final approval of the latest edits. Regenerate the production build and affected captures, then review the delta.
- `artifacts/load-test.json` reports local Docker Supabase real Auth/Edge/Postgres Changes, 50 distinct Auth clients/sockets, 50 deliveries, p50/p95 = 181 ms, max 182 ms, concurrent snapshot batch 195 ms, restored hint count 1, and no unrevealed hint 2 leakage. Reading `scripts/load-test.mjs` confirms its local-host guard and independent client/socket creation. This is a synthetic localhost burst, not sustained production, physical-mobile, WAN, or separate-employee scale validation: all 50 clients bind the same synthetic employee.
- `test-results/.last-run.json` reports `status: passed`, no failed tests. This is a summary marker, not a per-step execution trace. The parent reports one complete real browser workflow and 16 integration cases. The source contains 16 integration cases (9 service + 7 security), but this reviewer did not rerun or independently witness those state-changing tests.
- The visual JSON reports `xlsxDownload: valid ZIP signature`. The capture script checks bytes 0x50/0x4B; that establishes ZIP-container output, not a full workbook semantic/reopen validation. No generated workbook was opened in this pass.

## Limits and handoff

Production Supabase configuration, deployed-origin behavior, real TLS/DNS/CDN, physical mobile, sustained load, packet loss/reconnect timing, and a Lighthouse performance/accessibility score are unverified by this review. No statement here treats local synthetic results as production readiness. Parent-led visual and security reviewers cover authenticated surfaces separately. Final disposition requires refreshed evidence and verification of the skip-link fix.
