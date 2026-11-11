import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { admin, boot, call, command, dashboard, employee, eventDate, signAdmin, sql } from "./helpers";

describe.sequential("published content approval withdrawal", () => {
  beforeAll(async () => {
    await signAdmin();
    await sql`update private.settings set enabled=true,survey_open=true,nomination_open=true`;
    await sql`delete from private.login_attempts`;
    await command("waiting");
    await eventDate(false);
  });
  afterAll(async () => {
    await sql.end();
  });
  beforeEach(async () => {
    await command("waiting");
    await sql`update private.settings set nomination_open=true where id`;
  });
  it.each([false, true])("blocks withdrawn taste restoration after advancing: %s", async (advance) => {
    // Given
    const prompt = `공개 철회 시험 ${crypto.randomUUID()}`;
    await call(
      admin,
      {
        action: "taste",
        payload: {
          question_id: "food",
          prompt,
          results: [{ label: "WITHDRAWN_TASTE", count: 1 }],
          approved: true,
        },
      },
      okSchema,
    );
    await command("phase", { phase: "RECAP" });
    await command("phase", { phase: "WHO_AM_I" });
    await command("phase", { phase: "TASTES" });
    const taste = (await dashboard()).tastes.find((t) => t.prompt === prompt);
    if (!taste) throw new Error("Taste fixture missing");
    await command("taste_question", { taste_id: taste.id });
    await command("taste_reveal");
    expect(JSON.stringify((await dashboard()).state)).toContain("WITHDRAWN_TASTE");
    if (advance) {
      const d = await dashboard();
      await call(admin, { action: "settings", payload: { ...d.settings, nomination_open: false } }, okSchema);
      await command("phase", { phase: "AWARDS" });
      expect((await dashboard()).state.phase).toBe("AWARDS");
    }
    const revision = (await dashboard()).state.revision;
    // When
    await call(admin, { action: "taste", payload: { ...taste, approved: false } }, okSchema);
    // Then
    const c = await employee(0);
    const state = (await boot(c)).state;
    const direct = await c.from("event_public_state").select("*").single();
    expect(direct.error).toBeNull();
    expect(JSON.stringify(direct.data)).not.toContain("WITHDRAWN_TASTE");
    expect(JSON.stringify(state)).not.toContain("WITHDRAWN_TASTE");
    if (!advance) expect(state.payload).toEqual({});
    expect(state.revision).toBeGreaterThan(revision);
    expect((await command("undo")).error).toBeTruthy();
    await c.auth.signOut();
  });
  it.each([false, true])("blocks withdrawn award reason restoration after advancing: %s", async (advance) => {
    // Given
    await command("phase", { phase: "RECAP" });
    await command("phase", { phase: "WHO_AM_I" });
    await command("phase", { phase: "TASTES" });
    const c = await employee(0);
    const me = await boot(c);
    const target = me.directory.find((e) => e.id !== me.self.id);
    if (!target) throw new Error("Employee fixture missing");
    await sql`delete from public.nominations`;
    await call(
      c,
      { action: "nominate", payload: { nominee_id: target.id, reason: "PRIVATE_ORIGINAL" } },
      okSchema,
    );
    await call(
      admin,
      {
        action: "review_reason",
        payload: { voter_id: me.self.id, public_text: "WITHDRAWN_REASON", approved: true },
      },
      okSchema,
    );
    const d = await dashboard();
    await call(admin, { action: "settings", payload: { ...d.settings, nomination_open: false } }, okSchema);
    await command("phase", { phase: "AWARDS" });
    const previous = (await boot(c)).state;
    expect(JSON.stringify(previous)).toContain("WITHDRAWN_REASON");
    if (advance) {
      await command("phase", { phase: "END" });
      expect((await dashboard()).state.phase).toBe("END");
    }
    // When
    await call(
      admin,
      {
        action: "review_reason",
        payload: { voter_id: me.self.id, public_text: "WITHDRAWN_REASON", approved: false },
      },
      okSchema,
    );
    // Then
    const state = (await boot(c)).state;
    const fresh = await employee(1);
    expect(JSON.stringify((await boot(fresh)).state)).not.toContain("WITHDRAWN_REASON");
    const direct = await fresh.from("event_public_state").select("*").single();
    expect(direct.error).toBeNull();
    expect(JSON.stringify(direct.data)).not.toContain("WITHDRAWN_REASON");
    await fresh.auth.signOut();
    expect(JSON.stringify(state)).not.toContain("WITHDRAWN_REASON");
    expect(state.revision).toBeGreaterThan(previous.revision);
    expect((await command("undo")).error).toBeTruthy();
    await c.auth.signOut();
  });
});
