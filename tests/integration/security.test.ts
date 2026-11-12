import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { okSchema, winnerSchema } from "../../supabase/functions/_shared/contracts";
import {
  admin,
  boot,
  call,
  client,
  command,
  dashboard,
  employee,
  eventDate,
  signAdmin,
  sql,
} from "./helpers";

describe.sequential("authorization, consent and release boundaries", () => {
  beforeAll(async () => {
    await signAdmin();
    await sql`update private.settings set enabled=true,survey_open=true,nomination_open=true`;
    await sql`delete from private.login_attempts`;
    await command("waiting");
    await eventDate(false);
  });
  afterAll(async () => {
    await sql`delete from private.login_attempts`;
    await sql.end();
  });

  it("uses the server release predicate at 17:59 and 18:00 KST", async () => {
    // Given / When
    const rows =
      await sql`select private.release_open('2026-12-01 18:00:00+09','2026-12-01 17:59:59+09') early,
      private.release_open('2026-12-01 18:00:00+09','2026-12-01 18:00:00+09') ready`;
    // Then
    expect(rows[0]).toEqual({ early: false, ready: true });
  });
  it("rejects times other than 18:00 KST when organizer saves the date", async () => {
    // Given
    const d = await dashboard();
    // When
    const result = await admin.functions.invoke("portal", {
      body: { action: "settings", payload: { ...d.settings, event_start_at: "2026-12-01T17:59:00+09:00" } },
    });
    // Then
    expect(result.error).toBeTruthy();
  });
  it("denies privileged actions when a verified employee calls them directly", async () => {
    // Given
    const c = await employee(0);
    // When
    const results = await Promise.all(
      ["dashboard", "export"].map((action) =>
        c.functions.invoke("portal", { body: { action, payload: {} } }),
      ),
    );
    // Then
    expect(results.every((r) => Boolean(r.error))).toBe(true);
    await c.auth.signOut();
  });
  it("denies direct data writes when bypassing the Edge gateway", async () => {
    // Given
    const c = await employee(0);
    const me = await boot(c);
    // When
    const result = await c.from("surveys").update({ consent: false }).eq("employee_id", me.self.id);
    // Then
    expect(result.error).toBeTruthy();
    await c.auth.signOut();
  });
  it("returns no award when no valid votes exist and ties when the lead is shared", async () => {
    // Given
    const tx = await sql.reserve();
    await tx`begin`;
    try {
      const employees = await tx`select id from private.employees where active order by employee_no limit 2`;
      await tx`delete from public.nominations`;
      const empty = await tx`select private.awards() result`;
      expect(empty[0]?.result).toEqual([]);
      // When
      await tx`insert into public.nominations(voter_id,nominee_id) values(${employees[0]?.id},${employees[1]?.id}),(${employees[1]?.id},${employees[0]?.id})`;
      const tied = await tx`select private.awards() result`;
      // Then
      expect(
        z
          .array(winnerSchema)
          .parse(tied[0]?.result)
          .map((w) => w.votes),
      ).toEqual([1, 1]);
    } finally {
      await tx`rollback`;
      tx.release();
    }
  });
  it("invalidates a reviewed round when the employee withdraws consent", async () => {
    // Given
    const c = await employee(0);
    await call(
      c,
      {
        action: "save_survey",
        payload: {
          answers: {
            food: "고기",
            hobby: "운동",
            youtube: "가상채널",
            dream: "우주인",
            surprise: "제빵",
            moment: "첫 프로젝트",
          },
          consent: true,
          excluded: [],
        },
      },
      okSchema,
    );
    const me = await boot(c);
    const survey = me.survey;
    if (!survey) throw new Error("Consent fixture save failed");
    const hint = `동의 철회 시험 ${crypto.randomUUID()}`;
    await call(
      admin,
      {
        action: "round",
        payload: {
          employee_id: me.self.id,
          question_keys: ["dream"],
          hints: [hint],
          approved: true,
          sort_order: 5,
        },
      },
      okSchema,
    );
    await command("phase", { phase: "RECAP" });
    await command("phase", { phase: "WHO_AM_I" });
    const round = (await dashboard()).rounds.find((r) => r.hints[0] === hint);
    await command("start_person", { round_id: round?.id });
    await command("hint");
    expect((await boot(c)).state.payload.hints).toEqual([hint]);
    // When
    await call(
      c,
      { action: "save_survey", payload: { answers: survey.answers, consent: false, excluded: [] } },
      okSchema,
    );
    // Then
    const d = await dashboard();
    expect(d.state.payload).toEqual({});
    expect(d.rounds.find((r) => r.id === round?.id)?.approved).toBe(false);
    await call(
      c,
      { action: "save_survey", payload: { answers: survey.answers, consent: true, excluded: [] } },
      okSchema,
    );
    await c.auth.signOut();
  });
  it("rate limits the identity across newly created anonymous sessions", async () => {
    // Given
    await sql`delete from private.login_attempts`;
    for (let i = 0; i < 5; i++) {
      const c = client();
      await c.auth.signInAnonymously();
      await c.functions.invoke("verify-employee", { body: { password: "000000" } });
      await c.auth.signOut();
    }
    const sixth = client();
    await sixth.auth.signInAnonymously();
    // When
    const result = await sixth.functions.invoke("verify-employee", { body: { password: "000000" } });
    // Then
    expect(result.error?.context instanceof Response ? result.error.context.status : 0).toBe(429);
    await sixth.auth.signOut();
  });
});
