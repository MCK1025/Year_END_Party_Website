import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { forestListSchema } from "../../supabase/functions/_shared/forest";
import { admin, boot, call, dashboard, employee, eventDate, signAdmin, sql } from "./helpers";

describe.sequential("private post ownership and durable event submission lock", () => {
  beforeAll(async () => {
    await signAdmin();
    await sql`update private.settings set started_at=null,enabled=true,survey_open=true,nomination_open=true`;
    await sql`delete from private.forest_limits`;
  });
  afterAll(async () => {
    await sql`delete from public.forest_posts where body like '소유권 검증%'`;
    await sql.end();
  });
  it("restores own posts on another device and denies another employee's edit", async () => {
    // Given: two separate authenticated sessions represent the same employee.
    const first = await employee(0);
    const second = await employee(0);
    const other = await employee(1);
    await call(
      first,
      { action: "forest_post", payload: { kind: "thanks", body: "소유권 검증 원본" } },
      okSchema,
    );
    // When / Then: the owner can retrieve/edit across devices; others cannot.
    const mine = await second.functions.invoke("portal", { body: { action: "forest_mine", payload: {} } });
    expect(mine.error).toBeNull();
    const post = forestListSchema.parse(mine.data).find((p) => p.body === "소유권 검증 원본");
    expect(post).toBeDefined();
    if (!post) throw new Error("Expected owned post");
    const denied = await other.functions.invoke("portal", {
      body: { action: "forest_edit", payload: { id: post.id, kind: "wish", body: "소유권 검증 도용" } },
    });
    expect(denied.error?.context?.status).toBe(403);
    const edited = await second.functions.invoke("portal", {
      body: { action: "forest_edit", payload: { id: post.id, kind: "wish", body: "소유권 검증 수정" } },
    });
    expect(edited.error).toBeNull();
    const publicPosts = await admin.functions.invoke("portal", {
      body: { action: "forest_list", payload: {} },
    });
    expect(Object.keys(publicPosts.data.find((p: { id: number }) => p.id === post.id)).sort()).toEqual([
      "body",
      "day",
      "id",
      "kind",
    ]);
    expect(
      (await other.functions.invoke("portal", { body: { action: "forest_mine", payload: {} } })).data,
    ).not.toContainEqual(expect.objectContaining({ id: post.id }));
    await Promise.all([first.auth.signOut(), second.auth.signOut(), other.auth.signOut()]);
  });
  it("locks every submission at start, preserves reading and cannot reopen after undo/waiting", async () => {
    // Given: the event is waiting and an employee has already submitted.
    const c = await employee(0);
    const rehearsal = (await dashboard()).rehearsal;
    const practice = await admin.functions.invoke("portal", {
      body: {
        action: "command",
        payload: { command: "waiting", rehearsal: true, revision: rehearsal?.revision ?? 0 },
      },
    });
    expect(practice.error).toBeNull();
    expect((await boot(c)).settings.started_at).toBeNull();
    await eventDate(true);
    const current = await boot(c);
    await call(c, { action: "forest_post", payload: { kind: "thanks", body: "소유권 검증 잠금" } }, okSchema);
    const posts = await c.functions.invoke("portal", { body: { action: "forest_mine", payload: {} } });
    const [post] = forestListSchema.parse(posts.data);
    expect(post).toBeDefined();
    if (!post) throw new Error("Expected owned post");
    const started = await admin.functions.invoke("portal", {
      body: {
        action: "command",
        payload: { command: "start_event", revision: (await dashboard()).state.revision },
      },
    });
    expect(started.error).toBeNull();
    expect(started.data.editing_locked).toBe(true);
    expect(started.data.phase).toBe(current.state.phase);
    const early = await admin.functions.invoke("portal", {
      body: {
        action: "command",
        payload: { command: "phase", phase: "RECAP", revision: (await dashboard()).state.revision },
      },
    });
    expect(early.error).toBeTruthy();
    // When: pause, undo, and return to waiting do not reverse the submission deadline.
    for (const command of ["pause", "undo", "waiting"]) {
      const result = await admin.functions.invoke("portal", {
        body: { action: "command", payload: { command, revision: (await dashboard()).state.revision } },
      });
      expect(result.error).toBeNull();
      expect(result.data.editing_locked).toBe(true);
    }
    // Then: stale forms and direct API calls are denied, while own content stays readable.
    for (const request of [
      { action: "forest_post", payload: { kind: "wish", body: "소유권 검증 마감 후" } },
      { action: "forest_edit", payload: { id: post.id, kind: "wish", body: "소유권 검증 마감 수정" } },
      {
        action: "nominate",
        payload: { nominee_id: current.directory.find((p) => p.id !== current.self.id)?.id, reason: "마감" },
      },
      {
        action: "save_survey",
        payload: { answers: current.survey?.answers ?? {}, consent: true, excluded: [] },
      },
    ]) {
      expect((await c.functions.invoke("portal", { body: request })).error?.context?.status).toBe(403);
    }
    expect((await boot(c)).settings.started_at).toBeTruthy();
    const settings = (await dashboard()).settings;
    const reopen = await admin.functions.invoke("portal", {
      body: { action: "settings", payload: { ...settings, survey_open: true } },
    });
    expect(reopen.error?.context?.status).toBe(403);
    expect(
      forestListSchema
        .parse((await c.functions.invoke("portal", { body: { action: "forest_mine", payload: {} } })).data)
        .some((p) => p.id === post.id),
    ).toBe(true);
    await c.auth.signOut();
  });
});
