import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { okSchema, tasteCardsSchema } from "../../supabase/functions/_shared/contracts";
import { admin, boot, call, dashboard, employee, signAdmin, sql } from "./helpers";

describe.sequential("person card registration and employee position updates", () => {
  beforeAll(async () => {
    await signAdmin();
    await sql`update private.settings set started_at=null,enabled=true,survey_open=true,nomination_open=true,
      event_start_at=now()-interval '1 hour' where id`;
    await sql`update public.event_public_state set phase='WAITING',payload='{}',revision=revision+1 where id`;
  });
  afterAll(async () => {
    await sql`update public.event_public_state set phase='WAITING',payload='{}',revision=revision+1 where id`;
    await sql.end();
  });

  it("registers without consent and publishes only after administrator review", async () => {
    // Given: a verified employee completes all questions without a consent field.
    const guest = await employee(0);
    const me = await boot(guest);
    await sql`delete from private.card_reviews where employee_id=${me.self.id}`;
    await sql`delete from public.surveys where employee_id=${me.self.id}`;
    const answers = Object.fromEntries(me.questions.map((q) => [q.id, `관리자 검수 전 답변 ${q.id}`]));
    // When
    await call(guest, { action: "save_survey", payload: { answers, excluded: [] } }, okSchema);
    // Then: registration alone never creates a public review or a public card.
    expect((await boot(guest)).survey).toMatchObject({ answers, consent: false });
    const data = await dashboard();
    expect(data.surveys.find((s) => s.employee_id === me.self.id)?.consent).toBe(false);
    expect(data.card_reviews.some((r) => r.employee_id === me.self.id)).toBe(false);
    await sql`update public.event_public_state set phase='COMPLETED',revision=revision+1 where id`;
    const cards = () => call(guest, { action: "taste_cards", payload: {} }, tasteCardsSchema);
    expect((await cards()).cards.some((c) => c.id === me.self.id)).toBe(false);
    await call(
      admin,
      {
        action: "review_card",
        payload: {
          employee_id: me.self.id,
          question_keys: ["food"],
          revision: (await dashboard()).state.revision,
        },
      },
      okSchema,
    );
    expect((await cards()).cards.find((c) => c.id === me.self.id)?.answers).toHaveLength(1);
    expect((await boot(guest)).survey?.consent).toBe(false);
    await sql`update public.event_public_state set phase='WAITING',revision=revision+1 where id`;
    await guest.auth.signOut();
  });

  it("keeps Supabase department edits synchronized and serves two reviewed cards with positions", async () => {
    // Given: two employees have saved surveys and the administrator has reviewed them.
    const guests = await Promise.all([employee(0), employee(1)]);
    const ids: string[] = [];
    for (const guest of guests) {
      const me = await boot(guest);
      ids.push(me.self.id);
      await call(
        guest,
        {
          action: "save_survey",
          payload: {
            answers: Object.fromEntries(me.questions.map((q) => [q.id, `인물 카드 검증 ${q.id}`])),
            excluded: [],
          },
        },
        okSchema,
      );
      await call(
        admin,
        {
          action: "review_card",
          payload: {
            employee_id: me.self.id,
            question_keys: me.questions.map((q) => q.id),
            revision: (await dashboard()).state.revision,
          },
        },
        okSchema,
      );
    }
    const [first, second] = ids;
    const guest = guests[0];
    if (!first || !second || !guest) throw new Error("Missing local people");
    const original = await sql`select id,department from private.employees where id in (${first},${second})`;
    try {
      await sql`update private.employees set department='수정 전 직책' where id in (${first},${second})`;
      // When: Supabase edits either the public directory or the internal employee record.
      const revision = (await dashboard()).state.revision;
      await sql`update public.employee_directory set department='검증 과장' where id=${first}`;
      await sql`update private.employees set department='검증 대리' where id=${second}`;
      // Then: cards, admin roster and existing employee sessions agree.
      expect((await dashboard()).employees.find((e) => e.id === first)?.department).toBe("검증 과장");
      expect((await boot(guest)).directory.find((e) => e.id === second)?.department).toBe("검증 대리");
      expect((await dashboard()).state.revision).toBeGreaterThan(revision);
      expect(
        (await guest.from("employee_directory").update({ department: "위조 직책" }).eq("id", first)).error,
      ).toBeTruthy();
      await sql`update public.event_public_state set phase='COMPLETED',revision=revision+1 where id`;
      const cards = await call(guest, { action: "taste_cards", payload: {} }, tasteCardsSchema);
      expect(cards.cards.find((c) => c.id === first)?.department).toBe("검증 과장");
      expect(cards.cards.find((c) => c.id === second)?.department).toBe("검증 대리");
      expect(cards.cards.filter((c) => ids.includes(c.id))).toHaveLength(2);
    } finally {
      for (const row of original)
        await sql`update private.employees set department=${row.department} where id=${row.id}`;
      await Promise.all(guests.map((client) => client.auth.signOut()));
    }
  });
});
