# Security review — Year End Party

Verdict: FAIL — one blocking P2 finding in publication approval withdrawal.

Scope: local implementation at `C:/Users/minch/source/GitRepos/Year_END_Party_Website`, reviewed 2026-11-11. This is a source/evidence review. No database mutations or integration/E2E reruns were performed, and no raw environment credentials were read or printed. Production Supabase, hosted Edge configuration, Auth settings, live RLS, and GitHub Pages deployment remain unverified.

## Blocking finding

### [P2] Withdrawn taste/reason approval remains in the employee-visible snapshot

Evidence: `supabase/migrations/202611110004_admin.sql:62-63` upserts taste results and `approved` without invalidating the public snapshot. Lines 75-76 similarly update a nomination reason's `public_text`/`approved` without invalidation. `supabase/migrations/202611110003_progress.sql:18` copies the approved award reasons into the AWARDS payload; lines 52-56 copy approved taste results into the TASTES payload. `supabase/migrations/202611110002_participants.sql:51` later returns that stored payload without rechecking those approvals. No trigger on private.tastes/private.reason_reviews repairs this in the six reviewed migrations.

Reproduction path from source: after the organizer publishes a taste result containing a sensitive free-text label, save the same taste with approval unchecked (or change/remove that label while saving it unapproved). A newly logged-in employee still receives the old label from bootstrap or SELECT event_public_state. Likewise, publish awards with an approved reason, then unapprove/redact the reason: fresh employees still receive the old reason. This is continued server disclosure after review withdrawal, beyond the unavoidable retention of already downloaded information. The taste editor exposes approval withdrawal as an ordinary operation (`src/admin/TastesPanel.tsx:145`), so this is reachable through the application.

Required fix: atomically clear the affected live TASTES payload or AWARDS reasons (and increment revision/update time) whenever their review/content changes. Re-publication should require current approval. Add meaningful integration regressions for both cases: publish → withdraw/redact review → fresh employee bootstrap and direct public-state SELECT omit withdrawn content; also confirm stale undo cannot restore it. This finding is confirmed by the source data flow, not a fresh mutating runtime reproduction.

## Boundaries that passed source review

- Employee identity is derived from Auth getUser/getClaims; caller-supplied p_actor/_aal is not trusted by Edge handlers (`supabase/functions/_shared/http.ts:20-41`, `supabase/functions/portal/index.ts:12-33`). Privileged portal/verification SQL functions are service_role-only (`supabase/migrations/202611110005_gateway.sql:73-74`, `supabase/migrations/202611110002_participants.sql:29-30`).
- Public employee rows are select-only; surveys and nominations use current_employee row predicates; private schema access/functions are revoked (`supabase/migrations/202611110001_schema.sql:3,125-136`, `supabase/migrations/202611110005_gateway.sql:110`). Private tables also enable RLS in hardening.
- Session-to-employee mapping and one-row primary keys enforce own survey/one current nomination; self votes fail the DB constraint. Codes are cryptographically generated and bcrypt hashed; code reset invalidates linked sessions.
- Official release uses server time plus configured event_start_at and rejects a non-18:00 Asia/Seoul setting. The server writes only the currently revealed hints and omits the person until reveal. Future hints reside in a private table. Rehearsals use separate per-admin state.
- Survey consent/answer exclusions and active employees are checked before round publication. Survey updates and question/employee changes revoke related approvals and clear affected live payloads. The finding above concerns the missing equivalent for direct taste/reason review edits.
- event-media is a private bucket; authorized SELECT policy admits the logo or published recap photos only at the allowed phase/time. Upload is admin-authorized with size/type checks and generated object names. UI requests 60-second signed URLs; already copied media cannot be recalled.
- Import/export/purge enter the admin gate. Export omits DOB/code hashes and formula-like CSV/XLSX cells are neutralized. Purge disables employee service first and performs storage/Auth/data cleanup with retryable failures. The documented dedicated-project requirement is material because purge deletes every anonymous Auth user in that project. Concurrent admin uploads/new anonymous Auth signups can occur during the multi-step purge; the documented final zero-count verification is still necessary before recording deletion complete.
- Optional MFA checks validated aal in both the gateway and direct admin RLS. MFA is not enabled by default and must be explicitly configured for production as documented.

## Existing evidence and limits

Read the 16 source integration scenarios: 9 service cases and 7 authorization/consent/release cases. They cover direct RPC denial, private/other-person read denial, own survey, one vote, future release, hidden hints, isolated rehearsal, stale revisions, closed surveys, consent withdrawal, and identity rate limiting. They do not cover taste/reason approval withdrawal after publication, signed-media authorization, or complete purge lifecycle. The parent reports the existing local real-Supabase integration run passed; this review did not independently rerun it.

`test-results/.last-run.json` records status passed with no failedTests, but contains no scenario details. `artifacts/load-test.json` records 50 real local Auth/Edge/Postgres Changes clients receiving one public hint, p95 181 ms, and unrevealedHintLeaked=false. `artifacts/local-dependency-audit.json` records no dependency advisories for its audited production dependency set. These local artifacts do not establish production deployment readiness.
