import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { okSchema, stateSchema } from "../../supabase/functions/_shared/contracts";
import { admin, boot, call, dashboard, employee, signAdmin, sql } from "./helpers";

let guest: Awaited<ReturnType<typeof employee>>;
const send = async (command: string, extra: object = {}) =>
  admin.functions.invoke("portal", {
    body: { action: "command", payload: { command, revision: (await dashboard()).state.revision, ...extra } },
  });
const originals = () => sql`select jsonb_build_object(
  'surveys',(select jsonb_agg(s order by employee_id) from public.surveys s),
  'votes',(select jsonb_agg(n order by voter_id) from public.nominations n),
  'stories',(select jsonb_agg(f order by id) from public.forest_posts f),
  'reviews',(select jsonb_agg(r order by employee_id) from private.card_reviews r),
  'settings',(select to_jsonb(s) from private.settings s where id),
  'rehearsals',(select jsonb_agg(r order by admin_id) from private.rehearsals r)
) retained`;

describe.sequential("repeat an event after completed browsing", () => {
  beforeAll(async () => {
    await signAdmin();
    await sql`update private.settings set enabled=true,require_admin_mfa=false,started_at=null,
      survey_open=true,nomination_open=true,event_start_at=now()-interval '1 hour'`;
    await sql`update public.event_public_state set phase='WAITING',payload='{}',paused=false,
      tree_open=false,revision=revision+1`;
    guest = await employee(0);
    const data = await boot(guest);
    const colleague = data.directory.find((p) => p.id !== data.self.id);
    const question = data.questions[0];
    if (!colleague || !question) throw new Error("Missing repeat-event fixture");
    await call(
      guest,
      {
        action: "save_survey",
        payload: {
          answers: Object.fromEntries(data.questions.map((q) => [q.id, "재진행에도 보존할 가상 답변"])),
          consent: true,
          excluded: [],
        },
      },
      okSchema,
    );
    await call(
      guest,
      {
        action: "nominate",
        payload: { nominee_id: colleague.id, reason: "다시 진행해도 보존할 가상 추천 이유" },
      },
      okSchema,
    );
    await sql`insert into public.forest_posts(kind,body) values('thanks','다시 진행해도 보존할 가상 이야기')`;
    await call(
      admin,
      {
        action: "review_card",
        payload: {
          employee_id: data.self.id,
          question_keys: [question.id],
          revision: (await dashboard()).state.revision,
        },
      },
      okSchema,
    );
    expect((await send("start_event")).error).toBeNull();
    for (const phase of ["RECAP", "WHO_AM_I", "TASTES", "AWARDS", "END"])
      expect((await send("phase", { phase })).error).toBeNull();
    expect((await send("complete_event", { reviewed: true })).error).toBeNull();
  });
  afterAll(async () => {
    await sql`update private.settings set require_admin_mfa=false,event_start_at=now()-interval '1 hour'`;
    await sql`update public.event_public_state set phase='WAITING',payload='{}',paused=false,tree_open=false,
      revision=revision+1`;
    await guest?.auth.signOut();
    await sql.end();
  });
  it("restarts completed progress without erasing submissions, approvals or their editing lock", async () => {
    const before = await originals();
    const revision = (await dashboard()).state.revision;
    const response = await send("restart_event");
    expect(response.error, "Completed events need a dedicated replay action").toBeNull();
    expect(stateSchema.parse(response.data)).toMatchObject({
      phase: "WAITING",
      payload: {},
      paused: false,
      tree_open: false,
      editing_locked: true,
      revision: revision + 1,
    });
    expect(await originals()).toEqual(before);
    expect((await boot(guest)).state.phase).toBe("WAITING");
    expect(
      (await guest.functions.invoke("portal", { body: { action: "taste_cards", payload: {} } })).error
        ?.context?.status,
    ).toBe(403);
    expect((await send("undo")).error).toBeTruthy();
    expect((await dashboard()).state.phase).toBe("WAITING");
  });
  it("allows the full presentation to complete again and rejects concurrent stale resets", async () => {
    for (const phase of ["RECAP", "WHO_AM_I", "TASTES", "AWARDS", "END"])
      expect((await send("phase", { phase })).error).toBeNull();
    expect((await send("complete_event", { reviewed: true })).error).toBeNull();
    expect((await boot(guest)).state.phase).toBe("COMPLETED");
    const revision = (await dashboard()).state.revision;
    const responses = await Promise.all([
      send("restart_event", { revision }),
      send("restart_event", { revision }),
    ]);
    expect(responses.filter((r) => !r.error)).toHaveLength(1);
    expect(responses.filter((r) => r.error?.context?.status === 409)).toHaveLength(1);
  });
  it("checks admin, MFA and rehearsal isolation while respecting the scheduled content gate", async () => {
    const revision = (await dashboard()).state.revision;
    const denied = await guest.functions.invoke("portal", {
      body: { action: "command", payload: { command: "restart_event", revision } },
    });
    expect(denied.error?.context?.status).toBe(403);
    expect((await send("restart_event", { rehearsal: true })).error).toBeTruthy();
    await sql`update private.settings set require_admin_mfa=true`;
    const mfa = await admin.functions.invoke("portal", {
      body: { action: "command", payload: { command: "restart_event", revision } },
    });
    expect(mfa.error?.context?.status).toBe(403);
    await sql`update private.settings set require_admin_mfa=false,event_start_at=now()+interval '1 hour'`;
    expect((await send("restart_event")).error).toBeNull();
    expect((await send("phase", { phase: "RECAP" })).error).toBeTruthy();
    expect((await dashboard()).state.phase).toBe("WAITING");
  });
});
