import { afterAll, beforeAll, expect, it } from "vitest";
import { okSchema, stateSchema } from "../../supabase/functions/_shared/contracts";
import { admin, boot, call, command, dashboard, employee, signAdmin, sql } from "./helpers";

beforeAll(async () => {
  await signAdmin();
  await sql`update private.settings set started_at=null,enabled=true,survey_open=true,nomination_open=false,
    event_start_at=now()-interval '1 hour' where id`;
  await sql`update public.event_public_state set phase='WAITING',payload='{}',revision=revision+1 where id`;
});
afterAll(async () => {
  await sql.end();
});

it("reveals all six question-answer pairs one at a time without sending future answers or the person", async () => {
  // Given: an employee registers six answers without a consent field, then admin reviews them.
  const guest = await employee(0);
  const me = await boot(guest);
  const questions = me.questions.slice(0, 6);
  expect(questions).toHaveLength(6);
  const hints = questions.map((q, i) => `PRIVATE_HINT_${i + 1}_${q.id}`);
  await call(
    guest,
    {
      action: "save_survey",
      payload: {
        answers: Object.fromEntries(questions.map((q, i) => [q.id, hints[i] ?? ""])),
        excluded: [],
      },
    },
    okSchema,
  );
  await call(
    admin,
    {
      action: "round",
      payload: {
        employee_id: me.self.id,
        question_keys: questions.map((q) => q.id),
        hints,
        approved: true,
        sort_order: 100,
      },
    },
    okSchema,
  );
  const round = (await dashboard()).rounds.find(
    (r) => r.employee_id === me.self.id && r.hints[0] === hints[0],
  );
  if (!round) throw new Error("Missing six-question round");
  try {
    await command("phase", { phase: "RECAP" });
    await command("phase", { phase: "WHO_AM_I" });
    expect((await command("start_person", { round_id: round.id })).error).toBeNull();
    expect((await boot(guest)).state.payload.hints).toEqual([]);
    // When / Then: only the revealed prefix reaches an employee.
    for (let count = 1; count <= 6; count++) {
      expect((await command("hint")).error).toBeNull();
      const state = (await boot(guest)).state;
      expect(state.payload.hints).toEqual(hints.slice(0, count));
      expect(state.payload.hint_questions).toEqual(questions.slice(0, count).map((q) => q.prompt));
      expect(state.payload.person).toBeNull();
      const direct = await guest.from("event_public_state").select("*").single();
      expect(stateSchema.parse(direct.data).payload.hints).toHaveLength(count);
      for (const future of hints.slice(count)) expect(JSON.stringify(direct.data)).not.toContain(future);
    }
    expect((await command("hint")).error).toBeTruthy();
    expect((await command("reveal")).error).toBeNull();
    expect((await boot(guest)).state.payload.person?.name).toBe(me.self.name);
  } finally {
    await command("waiting");
    await call(admin, { action: "delete_round", payload: { id: round.id } }, okSchema);
    await guest.auth.signOut();
  }
});
