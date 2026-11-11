import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { okSchema } from "../../supabase/functions/_shared/contracts";
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

describe.sequential("real Supabase employee and event service", () => {
  const people: Awaited<ReturnType<typeof employee>>[] = [];
  beforeAll(async () => {
    await signAdmin();
    await sql`delete from private.login_attempts`;
    await sql`delete from private.rehearsals`;
    await sql`delete from private.rounds`;
    await sql`delete from private.tastes`;
    await sql`delete from public.nominations`;
    await sql`delete from public.surveys`;
    await sql`update private.settings set enabled=true,survey_open=true,nomination_open=true`;
    await command("waiting");
    for (let i = 0; i < 5; i++) people.push(await employee(i));
  }, 60000);
  afterAll(async () => {
    for (const c of people) await c.auth.signOut();
    await sql.end();
  });

  it("persists only each employee's own survey when all five submit", async () => {
    // Given
    for (const [i, c] of people.entries()) {
      // When
      await call(
        c,
        {
          action: "save_survey",
          payload: {
            answers: {
              food: i % 2 ? "한식" : "고기",
              hobby: "운동",
              youtube: `가상채널 ${i}`,
              dream: `꿈 ${i}`,
              surprise: `반전 ${i}`,
              moment: `기억 ${i}`,
            },
            consent: true,
            excluded: [],
          },
        },
        okSchema,
      );
    }
    // Then
    expect((await dashboard()).surveys).toHaveLength(5);
    for (const c of people) expect((await c.from("surveys").select("*")).data).toHaveLength(1);
  });
  it("denies unverified users and direct privileged RPC requests", async () => {
    // Given
    const c = client();
    await c.auth.signInAnonymously();
    // When
    const [rows, privileged] = await Promise.all([
      c.from("employee_directory").select("*"),
      c.rpc("portal", { p_actor: (await admin.auth.getUser()).data.user?.id, p_action: "dashboard", p: {} }),
    ]);
    // Then
    expect(rows.data).toEqual([]);
    expect(privileged.error).toBeTruthy();
    await c.auth.signOut();
  });
  it("denies private schema and other employees' answers through direct API", async () => {
    // Given
    const c = people[0];
    const other = people[1];
    if (!c || !other) throw new Error("fixtures");
    const target = (await boot(other)).self.id;
    // When
    const [survey, privateData] = await Promise.all([
      c.from("surveys").select("*").eq("employee_id", target),
      c.schema("private").from("employees").select("*"),
    ]);
    // Then
    expect(survey.data).toEqual([]);
    expect(privateData.error).toBeTruthy();
  });
  it("enforces self exclusion and one final vote when a voter changes recommendation", async () => {
    // Given
    const c = people[0];
    const other = people[1];
    const third = people[2];
    if (!c || !other || !third) throw new Error("fixtures");
    const self = (await boot(c)).self.id;
    const invalid = await c.functions.invoke("portal", {
      body: { action: "nominate", payload: { nominee_id: self, reason: "" } },
    });
    await call(
      c,
      { action: "nominate", payload: { nominee_id: (await boot(other)).self.id, reason: "감사합니다" } },
      okSchema,
    );
    // When
    await call(
      c,
      { action: "nominate", payload: { nominee_id: (await boot(third)).self.id, reason: "늘 고마운 동료" } },
      okSchema,
    );
    // Then
    expect(invalid.error).toBeTruthy();
    expect((await dashboard()).nominations).toHaveLength(1);
  });
  it("rejects an early release when event date is in the future", async () => {
    // Given
    await eventDate(true);
    // When
    const result = await command("phase", { phase: "RECAP" });
    // Then
    expect(result.error).toBeTruthy();
    expect((await dashboard()).state.phase).toBe("WAITING");
  });
  it("releases only the current hint and restores it after a fresh login", async () => {
    // Given
    await eventDate(false);
    const d = await dashboard();
    const e = d.employees[0];
    if (!e) throw new Error("fixtures");
    await call(
      admin,
      {
        action: "round",
        payload: {
          employee_id: e.id,
          question_keys: ["dream", "surprise", "moment"],
          hints: ["HINT_VISIBLE_1", "HINT_FUTURE_2", "HINT_FUTURE_3"],
          approved: true,
          sort_order: 0,
        },
      },
      okSchema,
    );
    await command("phase", { phase: "RECAP" });
    await command("phase", { phase: "WHO_AM_I" });
    await command("start_person", { round_id: (await dashboard()).rounds[0]?.id });
    // When
    const result = await command("hint");
    if (result.error) throw result.error;
    const fresh = await employee(0);
    const state = (await boot(fresh)).state;
    await fresh.auth.signOut();
    // Then
    expect(state.payload.hints).toEqual(["HINT_VISIBLE_1"]);
    expect(JSON.stringify(state)).not.toContain("HINT_FUTURE_2");
    expect(state.payload.person).toBeNull();
  });
  it("keeps rehearsal state separate when a test person is revealed", async () => {
    // Given
    const d = await dashboard();
    const id = d.rounds[0]?.id;
    // When
    await call(
      admin,
      {
        action: "command",
        payload: {
          command: "start_person",
          rehearsal: true,
          revision: d.rehearsal?.revision ?? 0,
          round_id: id,
        },
      },
      z.unknown(),
    );
    const next = await dashboard();
    await call(
      admin,
      {
        action: "command",
        payload: { command: "hint", rehearsal: true, revision: next.rehearsal?.revision ?? 0 },
      },
      z.unknown(),
    );
    // Then
    expect((await dashboard()).state).toEqual(d.state);
  });
  it("rejects stale concurrent commands when revision has advanced", async () => {
    // Given
    const d = await dashboard();
    // When
    const outcomes = await Promise.all(
      [1, 2].map(() =>
        admin.functions.invoke("portal", {
          body: { action: "command", payload: { command: "hint", revision: d.state.revision } },
        }),
      ),
    );
    // Then
    expect(outcomes.filter((o) => !o.error)).toHaveLength(1);
  });
  it("blocks writes when the organizer closes the survey", async () => {
    // Given
    const d = await dashboard();
    const c = people[0];
    if (!c) throw new Error("fixtures");
    await call(admin, { action: "settings", payload: { ...d.settings, survey_open: false } }, okSchema);
    // When
    const result = await c.functions.invoke("portal", {
      body: {
        action: "save_survey",
        payload: { answers: (await boot(c)).survey?.answers, consent: true, excluded: [] },
      },
    });
    // Then
    expect(result.error).toBeTruthy();
  });
});
