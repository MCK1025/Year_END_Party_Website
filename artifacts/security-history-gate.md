# Security history barrier re-review

Verdict: **PASS — no remaining blocker found in the history-barrier correction.**

Reviewed 2026-11-11 in the local working tree. This is a fresh, read-only security lane focused on the cross-phase undo finding in `artifacts/final-security.md`. Only this report was written. No database mutation, test execution, production connection, raw environment-file read, or source edit was performed by this reviewer. The previous FAIL remains historical evidence for the pre-008 source.

## Why the previous blocker is resolved

`supabase/migrations/202611110008_history_barrier.sql:4-10` defines a security-definer trigger with an empty search path and revoked execution for public/anon/authenticated. Its UPDATE advances the singleton public revision without a phase, payload ID, or approval predicate. Lines 11-24 attach it after INSERT, UPDATE, and DELETE, for each statement, to surveys, questions, nominations, employees, rounds, tastes, and reason reviews.

`supabase/migrations/202611110003_progress.sql:74-87` locks the live row, checks the submitted revision, and permits undo only when an audited command's after-state revision equals the current live revision. Normal commands and undo advance revision; the barrier also advances it but creates no matching command snapshot. Therefore every covered source mutation breaks eligibility for all pre-mutation undo snapshots, including TASTES → AWARDS, AWARDS → END, and transitions to WAITING. A later successful command starts from the post-mutation state; its undo cannot reach across the barrier.

The barrier and the existing current-payload invalidation/rebuild triggers execute in the same source transaction. Failure rolls back both. Multiple increments from an upsert or nested invalidation are harmless: the guard requires equality, not consecutive revision numbers. The function neither modifies audit snapshots nor grants employees a new write route.

## Neighboring publication paths checked

| Protected source | History and current publication behavior |
| --- | --- |
| Taste review/results | 008 fences old snapshots in every phase; 007 clears a matching current taste after update/delete. |
| Reason reviews/nominations | 008 fences old snapshots in every phase; 007 rebuilds current AWARDS through `private.awards()`, which requires approved public reason text and active participants. |
| Survey consent/answers/exclusions | 008 fences snapshots even after leaving WHO_AM_I/TASTES; the existing survey-update trigger withdraws round/taste approval and clears affected current publication (`005_gateway.sql:89-100`). |
| Questions | 008 fences snapshots on every source statement; the hardened update invalidation withdraws dependent approvals and clears affected current publication (`006_hardening.sql:12-20`). |
| Employees | 008 fences snapshots for every change, including identity and active-state edits; existing active-state invalidation clears affected current game/taste/award publication (`006_hardening.sql:21-35`). |
| Rounds | 008 fences old hints/identity snapshots after changes or deletion. The admin content route refuses edits/deletion of the round currently referenced by the public payload (`004_admin.sql:38-49`). |

Recaps are deliberately read from current published rows, rather than copied into the command payload (`002_participants.sql:79-82`); media authorization also checks the current recap row and published flag (`005_gateway.sql:75-85`). Undo of a phase therefore cannot resurrect an unpublished recap row or its media authorization. Release-date/disable settings already reset the public row and advance revision (`004_admin.sql:25-33`), and undo independently checks the current release gate. These paths do not expose another consent/approval snapshot bypass adjacent to this correction.

## Regression evidence and limits

`tests/integration/revocation.test.ts:20-63` now covers current-phase and advanced-phase taste withdrawal. It proves the marker was published before withdrawal, checks a fresh employee bootstrap and direct authenticated SELECT, requires increased revision, and requires undo rejection. Lines 64-114 provide both equivalent award-reason cases, including a fresh employee reader. These are real local Supabase/Edge/Postgres tests; the helper restricts the service hostname to localhost/127.0.0.1 and SQL to local port 54322.

The parent reports the two advanced-phase regressions failed before 008 and all four passed afterward within 20 passing integration tests; it also reports a cold reset applied all eight migrations successfully. Those executions were not independently repeated by this read-only reviewer. `artifacts/operations-test.json`, timestamp `2026-11-11T01:19:38.807Z`, independently supplies a recorded ten-check PASS with all six retained employee/survey/nomination/binding/anonymous-user/file counts zero after purge; this is inspected execution evidence, not a new run by this lane.

Nonblocking test-hardening note: setup `command()` calls return invocation results, so explicitly asserting the advanced phase and each setup command's success would make future test failures easier to interpret. The reported pre-fix failures of the two advanced variants provide meaningful evidence that these paths actually exercised the missing barrier. The broader seven-table coverage is source-verified here; these four cases do not constitute runtime coverage of every table/operation combination.

Reviewed source fingerprints (SHA-256):

- `202611110008_history_barrier.sql`: `9F52DD403488A525E7FFE0BD928B078C1C6C7097FEDE7DB1A0C0275DAEDB3C01`
- `tests/integration/revocation.test.ts`: `3ABC8DF3246DF0489C85EFE2D02EEB0904E489618A4ABD6E2BF338D4546A2608`

**Blocking findings: none.** This PASS applies to the reviewed local correction and does not certify production configuration, deployment, or already-downloaded copies of previously published content.
