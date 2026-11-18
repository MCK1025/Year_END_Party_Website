import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { okSchema, stateSchema, tasteCardsSchema } from "../../supabase/functions/_shared/contracts";
import { admin, boot, call, client, dashboard, employee, signAdmin, sql } from "./helpers";

const people: Awaited<ReturnType<typeof employee>>[] = [];
const ids: string[] = [];
const raw = (c: ReturnType<typeof client>, action: string, payload: object = {}) =>
  c.functions.invoke("portal", { body: { action, payload } });
const command = async (command: string, extra: object = {}) =>
  raw(admin, "command", { command, revision: (await dashboard()).state.revision, ...extra });
const approve = async (person: number, question_keys: string[]) =>
  call(
    admin,
    {
      action: "review_card",
      payload: {
        employee_id: ids[person] ?? "",
        question_keys,
        revision: (await dashboard()).state.revision,
      },
    },
    okSchema,
  );
const cards = () => call(people[0] ?? admin, { action: "taste_cards", payload: {} }, tasteCardsSchema);

describe.sequential("completed browsing access and publication", () => {
  beforeAll(async () => {
    await signAdmin();
    await sql`update private.settings set started_at=null,enabled=true,survey_open=true,nomination_open=true,
      event_start_at=now()-interval '1 hour'`;
    await sql`update public.event_public_state set phase='WAITING',payload='{}',paused=false,tree_open=false,revision=revision+1`;
    for (let n = 0; n < 5; n++) {
      const c = await employee(n);
      people.push(c);
      const me = await boot(c);
      ids.push(me.self.id);
      await call(
        c,
        {
          action: "save_survey",
          payload: {
            answers: {
              food: "원문 그대로\n  줄 바꿈",
              hobby: "독서",
              youtube: "가상 채널",
              dream: "비공개 꿈",
              surprise: "가상 반전",
              moment: "함께 만든 올해",
            },
            consent: n !== 1,
            excluded: n === 2 ? ["dream"] : [],
          },
        },
        okSchema,
      );
    }
    await sql`delete from public.surveys where employee_id=${ids[4] ?? ""}`;
  });
  afterAll(async () => {
    await sql`update public.event_public_state set phase='WAITING',payload='{}',paused=false,tree_open=false,revision=revision+1`;
    await sql`delete from private.card_reviews where employee_id=any(${ids})`;
    await Promise.all(people.map((c) => c.auth.signOut()));
    await sql.end();
  });
  it("requires both participation and completion, and keeps original survey RLS", async () => {
    const c = people[0];
    if (!c) throw Error("Missing test employee");
    expect((await raw(c, "taste_cards")).error?.context?.status).toBe(403);
    const unverified = client();
    await unverified.auth.signInAnonymously();
    expect((await raw(unverified, "taste_cards")).error?.context?.status).toBe(403);
    expect(
      (
        await raw(c, "review_card", {
          employee_id: ids[0],
          question_keys: ["food"],
          revision: (await dashboard()).state.revision,
        })
      ).error?.context?.status,
    ).toBe(403);
    expect(
      (
        await raw(c, "command", {
          command: "complete_event",
          reviewed: true,
          revision: (await dashboard()).state.revision,
        })
      ).error?.context?.status,
    ).toBe(403);
    const actor = (await c.auth.getUser()).data.user;
    expect(
      (await c.rpc("portal", { p_actor: actor?.id, p_action: "taste_cards", p: {} })).error,
    ).toBeTruthy();
    const original = await c.from("surveys").select("employee_id");
    expect(original.data).toEqual([{ employee_id: ids[0] }]);
    await unverified.auth.signOut();
  });
  it("validates admin review, consent, excluded and empty answers and detects stale forms", async () => {
    await approve(0, ["food", "hobby"]);
    await expect(approve(1, ["food"])).rejects.toThrow();
    await expect(approve(2, ["dream"])).rejects.toThrow();
    await expect(approve(4, ["food"])).rejects.toThrow();
    await approve(2, ["hobby"]);
    await approve(3, ["moment"]);
    const rev = (await dashboard()).state.revision;
    await sql`update public.surveys set answers=jsonb_set(answers,'{food}','"   "') where employee_id=${ids[3] ?? ""}`;
    expect(
      (await raw(admin, "review_card", { employee_id: ids[3], question_keys: ["moment"], revision: rev }))
        .error?.context?.status,
    ).toBe(409);
    await expect(approve(3, ["food"])).rejects.toThrow();
    await approve(3, ["moment"]);
    expect((await command("complete_event", { reviewed: true })).error).toBeTruthy();
    expect((await command("complete_event", { reviewed: true, rehearsal: true })).error).toBeTruthy();
  });
  it("atomically completes only at the end and carries the reviewed tree to the same realtime state", async () => {
    expect((await command("start_event")).error).toBeNull();
    for (const phase of ["RECAP", "WHO_AM_I", "TASTES", "AWARDS", "END"]) {
      expect((await command("phase", { phase })).error, phase).toBeNull();
    }
    expect((await command("complete_event")).error).toBeTruthy();
    await sql`update private.settings set event_start_at=now()+interval '1 hour'`;
    expect((await command("complete_event", { reviewed: true })).error).toBeTruthy();
    await sql`update private.settings set event_start_at=now()-interval '1 hour'`;
    const c = people[0];
    if (!c) throw Error("Missing employee");
    const observed: string[] = [];
    const channel = c
      .channel("test-completed")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "event_public_state" }, (e) =>
        observed.push(stateSchema.parse(e.new).phase),
      );
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Realtime timeout")), 10000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    try {
      const revision = (await dashboard()).state.revision;
      const results = await Promise.all(
        [0, 1].map(() => raw(admin, "command", { command: "complete_event", reviewed: true, revision })),
      );
      expect(results.filter((r) => !r.error)).toHaveLength(1);
      expect(results.filter((r) => r.error?.context?.status === 409)).toHaveLength(1);
      await expect.poll(() => observed.includes("COMPLETED"), { timeout: 10000 }).toBe(true);
      expect((await boot(c)).state).toMatchObject({
        phase: "COMPLETED",
        tree_open: true,
        editing_locked: true,
      });
      const tree = await raw(c, "forest_tree");
      expect(tree.error).toBeNull();
      for (const cmd of ["waiting", "undo", "hint", "pause"])
        expect((await command(cmd)).error?.context?.status).toBe(409);
      expect((await command("phase", { phase: "WHO_AM_I" })).error?.context?.status).toBe(409);
    } finally {
      await c.removeChannel(channel);
    }
  });
  it("returns only reviewed original answers and serves 50 simultaneous readers", async () => {
    const result = await cards();
    expect(result.cards.map((c) => c.id).sort()).toEqual([ids[0], ids[2], ids[3]].sort());
    const own = result.cards.find((c) => c.id === ids[0]);
    expect(own?.answers.map((a) => a.id)).toEqual(["food", "hobby"]);
    expect(own?.answers[0]?.answer).toBe("원문 그대로\n  줄 바꿈");
    for (const c of result.cards) {
      expect(Object.keys(c).sort()).toEqual(["answers", "department", "id", "name"]);
      for (const a of c.answers) expect(Object.keys(a).sort()).toEqual(["answer", "id", "question"]);
    }
    const readers = await Promise.all(
      Array.from({ length: 50 }, (_, n) =>
        call(people[n % 5] ?? admin, { action: "taste_cards", payload: {} }, tasteCardsSchema),
      ),
    );
    expect(readers.every((r) => JSON.stringify(r) === JSON.stringify(result))).toBe(true);
    const reconnect = await employee(4);
    expect((await boot(reconnect)).state.phase).toBe("COMPLETED");
    await reconnect.auth.signOut();
  });
  it("keeps completion terminal across temporary access closure and staff deletion", async () => {
    const settings = (await dashboard()).settings;
    await call(admin, { action: "settings", payload: { ...settings, enabled: false } }, okSchema);
    expect((await dashboard()).state.phase).toBe("COMPLETED");
    await expect(cards()).rejects.toThrow();
    await call(admin, { action: "settings", payload: { ...settings, enabled: true } }, okSchema);
    expect((await dashboard()).state.phase).toBe("COMPLETED");
    expect((await command("waiting")).error?.context?.status).toBe(409);
    expect((await cards()).cards.length).toBeGreaterThan(0);
    await raw(admin, "create_employee", {
      employee_no: "completed-delete-check",
      name: "삭제 검증 가상 직원",
      department: "시험",
      date_of_birth: "1987-06-19",
    });
    const temporary = (await dashboard()).employees.find((e) => e.employee_no === "completed-delete-check");
    if (!temporary) throw Error("Missing deletion test employee");
    await call(admin, { action: "delete_employee", payload: { id: temporary.id } }, okSchema);
    expect((await dashboard()).state.phase).toBe("COMPLETED");
    expect((await command("waiting")).error?.context?.status).toBe(409);
  });
  it("revokes on survey changes and keeps old game commands from restoring approvals", async () => {
    await sql`update public.surveys set answers=jsonb_set(answers,'{food}','"수정 후 아직 미검수"') where employee_id=${ids[0] ?? ""}`;
    expect((await cards()).cards.some((c) => c.id === ids[0])).toBe(false);
    await approve(0, ["food"]);
    await sql`update public.surveys set consent=false where employee_id=${ids[0] ?? ""}`;
    expect((await cards()).cards.some((c) => c.id === ids[0])).toBe(false);
    await approve(2, []);
    expect((await cards()).cards.some((c) => c.id === ids[2])).toBe(false);
    expect((await command("undo")).error?.context?.status).toBe(409);
    const c = people[0];
    if (!c) throw Error("Missing employee");
    expect((await raw(c, "save_survey", { answers: {}, consent: true, excluded: [] })).error).toBeTruthy();
    expect(
      (await raw(c, "nominate", { nominee_id: ids[2], reason: "수정할 수 없는 추천 내용입니다." })).error
        ?.context?.status,
    ).toBe(403);
  });
});
