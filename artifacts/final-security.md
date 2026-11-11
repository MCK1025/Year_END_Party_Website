# Final security review

Verdict: **FAIL — one remaining P2 blocker: undo can republish withdrawn content after leaving its phase.**

Reviewed 2026-11-11, local repository only. Read-only source/evidence review; no database mutations, test reruns, or raw environment values read. Only this report was written. This verdict makes no production deployment claim.

## Blocking finding

### [P2] Revocation outside the affected live phase leaves an unsafe undo snapshot eligible

`supabase/migrations/202611110007_public_revocation.sql:3-4` updates revision only when the live row is TASTES with that taste ID. Lines 10-11 similarly update revision only while the live phase is AWARDS. A review change made after moving to another phase matches no row, so neither trigger advances the public revision.

`supabase/migrations/202611110003_progress.sql:82-87` selects a command audit snapshot by matching its after-state revision to the current revision, then restores its entire before-state without revalidating approval. Lines 93-95 write this restored payload back to the public row and audit it. Consequently these ordinary admin paths remain reachable:

1. Publish an approved taste result, close nominations, advance TASTES to AWARDS, then withdraw that taste approval while AWARDS is current. The taste trigger changes no public row. Undo the AWARDS transition: its before-state contains the withdrawn TASTES result, and fresh employee bootstrap/direct public-state reads can receive it again.
2. Publish AWARDS containing an approved reason, advance to END, then withdraw/redact that reason while END is current. The reason trigger changes no public row. Undo END: its before-state restores the old AWARDS payload with the withdrawn reason.

These are source-confirmed paths, not a fresh runtime reproduction. The revision equality check does not reject them because the content mutation never increments the current revision. The same issue can occur after moving to WAITING, or when editing a taste that differs from the current taste but exists in the eligible undo before-state.

Required fix: invalidate undo eligibility for every relevant taste/reason/nomination mutation even when the affected content is absent from the current phase. For example, advance the singleton public revision unconditionally on these mutations while conditionally sanitizing/rebuilding only the current affected payload; alternatively revalidate or invalidate all restorable snapshots safely. Preserve transaction atomicity and employee-visible content filtering. Add real-DB regressions for both cross-phase sequences above, asserting a sensitive marker was actually published before withdrawal, then ensuring undo cannot restore it through fresh bootstrap and direct authenticated SELECT.

## What the current fix does establish

- The new triggers execute in the same database transaction as source mutations. For a matching current TASTES payload, an update/delete clears the payload and increments revision/update time. For current AWARDS, reason-review or nomination changes rebuild winners through `private.awards()`, whose reason selection requires `r.approved` (`202611110002_participants.sql:96-109`).
- Immediate undo after those current-phase updates has no command audit after-state matching the newly incremented revision, so the existing undo lookup fails. New normal commands start from the sanitized state.
- The trigger functions use an empty search path and revoke execution from public/anon/authenticated (`202611110007_public_revocation.sql:1,8,16`). The fix adds no new employee write permission.

## Regression test validity and limits

`tests/integration/revocation.test.ts` uses the real Supabase client/Edge portal and real local Postgres helper, rather than mocked adapters. `tests/integration/helpers.ts:12-27` restricts the configured Supabase hostname to localhost/127.0.0.1 and connects SQL to local port 54322. The parent reports both real-DB regressions passed; this reviewer did not rerun them.

The taste test withdraws while TASTES is current (lines 31-46); the reason test withdraws while AWARDS is current (lines 71-87). They meaningfully check bootstrap omission, increased revision and immediate undo denial. The reason test explicitly proves the marker was previously public (lines 72-73). Neither test exercises withdrawal after transitioning away, which is the remaining blocker. Neither performs a direct employee SELECT of `event_public_state`; the reason test also reuses the existing employee session rather than creating a fresh session after withdrawal. The taste test should explicitly assert its pre-withdrawal public marker and check setup command errors, because `command()` returns an invocation result instead of throwing on command failure.

## Local operations evidence

`artifacts/operations-test.json` records ten passing checks at 2026-11-11T01:01:01.820Z: code issuance/authentication/rotation, spoofed MIME rejection, private media blocked during WAITING, media available after release, purge cleanup, and retained administrator access. Its remaining employee/survey/nomination/binding/anonymous-user/media-object counts are all zero. `scripts/operations-test.mjs` implements real service calls, a storage read and independent SQL cleanup counts; the JSON is a recorded result, not this reviewer's independent execution. This improves prior local media/purge coverage but does not address the undo blocker or establish hosted production configuration.
