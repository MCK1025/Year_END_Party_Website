import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { admin, boot, call, command, dashboard, employee, eventDate, signAdmin, sql } from "./helpers";

describe.sequential("own-only forest and reviewed Christmas publication", () => {
  beforeAll(async () => {
    await signAdmin();
    await sql`update private.settings set started_at=null,enabled=true,survey_open=true,nomination_open=true`;
    await sql`delete from public.forest_posts`;
    await sql`delete from private.forest_limits`;
    await command("waiting");
    await eventDate(false);
  });
  afterAll(async () => {
    await sql.end();
  });
  it("rejects a recommendation reason shorter than ten characters at Edge and SQL boundaries", async () => {
    const c = await employee(0);
    const me = await boot(c);
    const nominee = me.directory.find((p) => p.id !== me.self.id);
    if (!nominee) throw new Error("Missing fixture");
    const invalid = await c.functions.invoke("portal", {
      body: { action: "nominate", payload: { nominee_id: nominee.id, reason: "짧은 이유" } },
    });
    expect(invalid.error?.context?.status).toBe(400);
    const actor = (await c.auth.getUser()).data.user;
    if (!actor) throw new Error("Missing authenticated fixture");
    await expect(
      sql`select public.portal(${actor.id},'nominate',${sql.json({ nominee_id: nominee.id, reason: "         짧음          " })})`,
    ).rejects.toThrow();
    await call(
      c,
      { action: "nominate", payload: { nominee_id: nominee.id, reason: "함께 도와주셔서 정말 고맙습니다." } },
      okSchema,
    );
    await c.auth.signOut();
  });
  it("restricts API and direct reads to own posts, and permits only owners to delete before start", async () => {
    const c = await employee(0);
    const other = await employee(1);
    await call(
      c,
      { action: "forest_post", payload: { kind: "thanks", body: "가상 내 글 소유권" } },
      okSchema,
    );
    const own = await c.functions.invoke("portal", { body: { action: "forest_mine", payload: {} } });
    const id = own.data[0].id;
    expect((await other.from("forest_posts").select("*").eq("id", id)).data).toEqual([]);
    expect(
      (await other.functions.invoke("portal", { body: { action: "forest_list", payload: {} } })).error
        ?.context?.status,
    ).toBe(403);
    expect(
      (await other.functions.invoke("portal", { body: { action: "forest_delete", payload: { id } } })).error
        ?.context?.status,
    ).toBe(403);
    expect(
      (await c.functions.invoke("portal", { body: { action: "forest_delete", payload: { id } } })).error,
    ).toBeNull();
    expect(
      (await c.functions.invoke("portal", { body: { action: "forest_mine", payload: {} } })).data,
    ).toHaveLength(0);
    await Promise.all([c.auth.signOut(), other.auth.signOut()]);
  });
  it("gates publication, paginates all anonymous notes, restores on reconnect and revokes on close", async () => {
    const c = await employee(0);
    await sql`insert into public.forest_posts(kind,body) select 'wish','가상 트리 쪽지 '||n from generate_series(1,15) n`;
    const invoke = async (action: string, payload = {}) =>
      c.functions.invoke("portal", { body: { action, payload } });
    expect((await invoke("forest_tree")).error?.context?.status).toBe(403);
    const send = async (command: string) =>
      admin.functions.invoke("portal", {
        body: {
          action: "command",
          payload: { command, reviewed: true, revision: (await dashboard()).state.revision },
        },
      });
    expect((await send("tree_open")).error).toBeTruthy();
    await send("start_event");
    await eventDate(true);
    expect((await send("tree_open")).error).toBeTruthy();
    await eventDate(false);
    expect((await send("tree_open")).error).toBeNull();
    expect((await boot(c)).state.tree_open).toBe(true);
    const first = await invoke("forest_tree");
    expect(first.data.notes).toHaveLength(12);
    expect(first.data.total).toBe(15);
    expect(Object.keys(first.data.notes[0]).sort()).toEqual(["body", "day", "id", "kind"]);
    expect((await invoke("forest_tree", { before: first.data.notes.at(-1).id })).data.notes).toHaveLength(3);
    const fresh = await employee(1);
    expect((await boot(fresh)).state.tree_open).toBe(true);
    const own = await invoke("forest_post", { kind: "wish", body: "가상 마감 거절" });
    expect(own.error?.context?.status).toBe(403);
    expect((await send("tree_close")).error).toBeNull();
    expect((await invoke("forest_tree")).error?.context?.status).toBe(403);
    expect((await c.from("forest_tree_notes").select("*")).data).toEqual([]);
    expect((await boot(c)).state.tree_open).toBe(false);
    await Promise.all([c.auth.signOut(), fresh.auth.signOut()]);
  });
});
