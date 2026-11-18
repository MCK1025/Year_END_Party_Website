import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { admin, boot, call, dashboard, employee, signAdmin, sql } from "./helpers";

describe.sequential("response reopening before a rescheduled event", () => {
  beforeAll(signAdmin);
  beforeEach(async () => {
    await sql`update private.settings set started_at=now()-interval '1 day', enabled=true,
      survey_open=false,nomination_open=false,event_start_at=now()-interval '1 hour' where id`;
    await sql`update public.event_public_state set phase='COMPLETED',payload='{}',tree_open=false,
      revision=revision+1 where id`;
  });
  afterAll(async () => {
    await sql.end();
  });

  it.each([
    [true, false],
    [false, true],
    [true, true],
  ])("allows only explicitly reopened responses: survey=%s nomination=%s", async (survey, nomination) => {
    // Given: an event has already ended and both response forms are closed.
    const guest = await employee(0);
    const original = await dashboard();
    const me = await boot(guest);
    const target = me.directory.find((person) => person.id !== me.self.id);
    if (!target) throw new Error("Missing colleague fixture");
    const answers = Object.fromEntries(me.questions.map((q) => [q.id, `일정 변경 검증 ${q.id}`]));
    // When: an administrator selects a future start and explicitly reopens a form.
    await call(
      admin,
      {
        action: "settings",
        payload: {
          ...original.settings,
          event_start_at: new Date(Date.now() + 3600000).toISOString(),
          survey_open: survey,
          nomination_open: nomination,
        },
      },
      okSchema,
    );
    // Then: both fresh sessions and already connected sessions can use the chosen permissions.
    const saved = await dashboard();
    expect(saved.state.phase).toBe("WAITING");
    expect(saved.state.payload).toEqual({});
    expect(saved.settings.started_at).toBe(original.settings.started_at);
    expect(saved.state.settings_revision).toBeGreaterThan(original.state.settings_revision ?? 0);
    expect((await boot(guest)).settings).toMatchObject({ survey_open: survey, nomination_open: nomination });
    const surveyResult = await guest.functions.invoke("portal", {
      body: { action: "save_survey", payload: { answers, consent: true, excluded: [] } },
    });
    const nominationResult = await guest.functions.invoke("portal", {
      body: {
        action: "nominate",
        payload: { nominee_id: target.id, reason: "다시 작성한 고마운 동료 추천 이유입니다." },
      },
    });
    expect(!surveyResult.error).toBe(survey);
    expect(!nominationResult.error).toBe(nomination);
    if (survey) expect((await boot(guest)).survey?.answers).toEqual(answers);
    if (nomination) expect((await boot(guest)).nomination?.nominee_id).toBe(target.id);
    expect(
      (
        await guest.functions.invoke("portal", {
          body: { action: "forest_post", payload: { kind: "thanks", body: "이야기 작성은 계속 마감" } },
        })
      ).error?.context?.status,
    ).toBe(403);
    await guest.auth.signOut();
  });

  it.each([null, "2000-01-01T00:00:00+09:00"])(
    "rejects reopening without a future start: %s",
    async (start) => {
      // Given / When: the admin requests reopened responses with an absent or past start.
      const original = await dashboard();
      const result = await admin.functions.invoke("portal", {
        body: {
          action: "settings",
          payload: { ...original.settings, event_start_at: start, survey_open: true },
        },
      });
      // Then: server permissions reject the entire operation.
      expect(result.error?.context?.status).toBe(403);
      expect((await dashboard()).settings).toEqual(original.settings);
    },
  );

  it("closes stale forms at the exact server deadline and preserves saved data", async () => {
    // Given: reopened flags remain stored after the new time has arrived.
    await sql`update private.settings set survey_open=true,nomination_open=true,event_start_at=now() where id`;
    const guest = await employee(0);
    const me = await boot(guest);
    // When / Then: direct writes cannot bypass time checks or reset existing data.
    for (const body of [
      { action: "save_survey", payload: { answers: me.survey?.answers ?? {}, consent: true, excluded: [] } },
      {
        action: "nominate",
        payload: {
          nominee_id: me.directory.find((p) => p.id !== me.self.id)?.id,
          reason: "마감 이후 변경을 시도한 추천입니다.",
        },
      },
    ])
      expect((await guest.functions.invoke("portal", { body })).error?.context?.status).toBe(403);
    expect((await boot(guest)).survey).toEqual(me.survey);
    expect((await boot(guest)).nomination).toEqual(me.nomination);
    const boundary =
      await sql`select private.response_window('2026-01-01', '2027-01-01', '2027-01-01') at_deadline,
      private.response_window('2026-01-01', '2027-01-01', '2026-12-31 23:59:59+00') before_deadline`;
    expect(boundary[0]).toEqual({ at_deadline: false, before_deadline: true });
    await guest.auth.signOut();
  });

  it("does not let an employee reopen forms through the administrator endpoint", async () => {
    // Given / When
    const guest = await employee(0);
    const original = await dashboard();
    const result = await guest.functions.invoke("portal", {
      body: {
        action: "settings",
        payload: {
          ...original.settings,
          event_start_at: new Date(Date.now() + 3600000).toISOString(),
          survey_open: true,
          nomination_open: true,
        },
      },
    });
    // Then
    expect(result.error?.context?.status).toBe(403);
    expect((await dashboard()).settings).toEqual(original.settings);
    await guest.auth.signOut();
  });

  it("closes reopened flags when the rescheduled show proceeds and retains the first start", async () => {
    // Given: a reopened window has reached its deadline.
    const firstStart = (await dashboard()).settings.started_at;
    await sql`update private.settings set survey_open=true,nomination_open=true,event_start_at=now() where id`;
    await sql`update public.event_public_state set phase='WAITING',revision=revision+1 where id`;
    // When: the organizer progresses to the first content phase.
    const result = await admin.functions.invoke("portal", {
      body: {
        action: "command",
        payload: {
          command: "phase",
          phase: "RECAP",
          revision: (await dashboard()).state.revision,
        },
      },
    });
    // Then: later settings saves and the award stage are not blocked by expired open flags.
    expect(result.error).toBeNull();
    expect((await dashboard()).settings).toMatchObject({
      survey_open: false,
      nomination_open: false,
      started_at: firstStart,
    });
  });
});
