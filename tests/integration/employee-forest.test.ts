import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { admin, boot, call, client, dashboard, employee, signAdmin, sql } from "./helpers";

const fresh = {
  employee_no: "TEST-LIFECYCLE",
  name: "가상 신규",
  department: "가상팀",
  date_of_birth: "2001-02-03",
};
describe.sequential("employee lifecycle and anonymous forest", () => {
  beforeAll(async () => {
    await signAdmin();
    await sql`delete from private.employees where employee_no like 'TEST-LIFECYCLE%'`;
    await sql`delete from private.login_attempts`;
    await sql`update private.settings set started_at=null,enabled=true where id`;
  });
  afterAll(async () => {
    await sql`delete from private.employees where employee_no like 'TEST-LIFECYCLE%'`;
    await sql.end();
  });
  it("creates an individual employee and logs in with only six birthday digits", async () => {
    // Given / When
    await call(admin, { action: "create_employee", payload: fresh }, okSchema);
    const c = client();
    await c.auth.signInAnonymously();
    const result = await c.functions.invoke("verify-employee", { body: { password: "010203" } });
    // Then
    expect(result.error).toBeNull();
    expect((await boot(c)).self.name).toBe(fresh.name);
    await c.auth.signOut();
  });
  it("rejects a duplicate birthday instead of logging in as the wrong employee", async () => {
    // Given / When
    const result = await admin.functions.invoke("portal", {
      body: { action: "create_employee", payload: { ...fresh, employee_no: "TEST-LIFECYCLE-DUP" } },
    });
    // Then
    expect(result.error).toBeTruthy();
    expect(
      (await dashboard()).employees.filter((e) => e.employee_no.startsWith("TEST-LIFECYCLE")),
    ).toHaveLength(1);
  });
  it("denies unverified forest access and employee administrative actions", async () => {
    // Given
    const c = client();
    await c.auth.signInAnonymously();
    // When
    const denied = await c.functions.invoke("portal", { body: { action: "forest_list", payload: {} } });
    const directRead = await c.from("forest_posts").select("*");
    const verified = await employee(0);
    const directWrite = await verified.from("forest_posts").insert({ kind: "wish", body: "가상 우회 시도" });
    const mutation = await verified.functions.invoke("portal", {
      body: { action: "create_employee", payload: { ...fresh, employee_no: "TEST-LIFECYCLE-FORGED" } },
    });
    // Then
    expect(denied.error?.context?.status).toBe(403);
    expect(directRead.data).toEqual([]);
    expect(directWrite.error).toBeTruthy();
    expect(mutation.error?.context?.status).toBe(403);
    await c.auth.signOut();
    await verified.auth.signOut();
  });
  it("persists readable messages with no author columns or author response fields", async () => {
    // Given
    const c = await employee(0);
    const other = await employee(1);
    const body = `가상 익명 글 ${crypto.randomUUID()}`;
    // When
    await call(c, { action: "forest_post", payload: { kind: "thanks", body } }, okSchema);
    const posts = await call(
      other,
      { action: "forest_list", payload: {} },
      z.array(z.record(z.string(), z.unknown())),
    );
    const columns =
      await sql`select column_name from information_schema.columns where table_schema='public' and table_name='forest_posts' order by column_name`;
    // Then
    expect(posts.find((p) => p.body === body)).toMatchObject({ kind: "thanks", body });
    expect(Object.keys(posts.find((p) => p.body === body) ?? {}).sort()).toEqual([
      "body",
      "day",
      "id",
      "kind",
    ]);
    expect(columns.map((c) => c.column_name)).toEqual(["body", "day", "id", "kind"]);
    await sql`delete from public.forest_posts where body=${body}`;
    await c.auth.signOut();
    await other.auth.signOut();
  });
  it("limits submissions and lets only administrators remove anonymous posts", async () => {
    // Given
    const c = await employee(0);
    const id = (await boot(c)).self.id;
    await sql`insert into private.forest_limits(employee_id,day,total) values(${id},(now() at time zone 'Asia/Seoul')::date,10) on conflict(employee_id,day) do update set total=10`;
    // When
    const result = await c.functions.invoke("portal", {
      body: { action: "forest_post", payload: { kind: "wish", body: "가상 한도 초과" } },
    });
    const post = (
      await sql`insert into public.forest_posts(kind,body) values('regret','가상 검수 글') returning id`
    )[0];
    const denied = await c.functions.invoke("portal", {
      body: { action: "forest_delete", payload: { id: Number(post?.id) } },
    });
    await call(admin, { action: "forest_delete", payload: { id: Number(post?.id) } }, okSchema);
    // Then
    expect(result.error).toBeTruthy();
    expect(denied.error?.context?.status).toBe(403);
    expect(await sql`select id from public.forest_posts where id=${post?.id}`).toHaveLength(0);
    await sql`delete from private.forest_limits where employee_id=${id}`;
    await c.auth.signOut();
  });
  it("deletes an employee, revokes access and clears published snapshots", async () => {
    // Given
    const c = client();
    await c.auth.signInAnonymously();
    await c.functions.invoke("verify-employee", { body: { password: "010203" } });
    const id = (await boot(c)).self.id;
    // When
    await call(admin, { action: "delete_employee", payload: { id } }, okSchema);
    const revoked = await c.functions.invoke("portal", { body: { action: "bootstrap", payload: {} } });
    // Then
    expect((await dashboard()).employees.some((e) => e.id === id)).toBe(false);
    expect(await sql`select id from public.employee_directory where id=${id}`).toHaveLength(0);
    expect(revoked.error?.context?.status).toBe(403);
    expect((await dashboard()).state.payload).toEqual({});
    await c.auth.signOut();
  });
});
