import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { forestListSchema } from "../../supabase/functions/_shared/forest";
import { admin, boot, call, dashboard, employee, signAdmin, sql } from "./helpers";

describe.sequential("own story editing before a rescheduled start", () => {
  beforeAll(signAdmin);
  beforeEach(async () => {
    await sql`update private.settings set started_at=null,enabled=true,survey_open=false,
      nomination_open=false,event_start_at=now()-interval '1 hour' where id`;
    await sql`update public.event_public_state set phase='WAITING',tree_open=false,payload='{}',revision=revision+1 where id`;
    await sql`delete from private.forest_limits`;
  });
  afterAll(async () => {
    await sql.end();
  });

  async function ownPost() {
    const guest = await employee(0);
    const body = `이야기 재개 검증 ${crypto.randomUUID()}`;
    await call(guest, { action: "forest_post", payload: { kind: "thanks", body } }, okSchema);
    const posts = await call(guest, { action: "forest_mine", payload: {} }, forestListSchema);
    const post = posts.find((item) => item.body === body);
    if (!post) throw new Error("Missing owned story fixture");
    await sql`update private.settings set started_at=now() where id`;
    return { guest, post };
  }

  it("reopens only the owner's existing stories across devices and closes public browsing", async () => {
    // Given: an already-published story belongs to one employee.
    const { guest, post } = await ownPost();
    const other = await employee(1);
    const sameOwner = await employee(0);
    const settings = (await dashboard()).settings;
    await sql`insert into public.forest_tree_notes select id,kind,body,day from public.forest_posts where id=${post.id}`;
    await sql`update public.event_public_state set phase='COMPLETED',tree_open=true,revision=revision+1 where id`;
    // When: only the date/time changes; survey and nomination stay closed.
    await call(
      admin,
      {
        action: "settings",
        payload: { ...settings, event_start_at: new Date(Date.now() + 3600000).toISOString() },
      },
      okSchema,
    );
    // Then: response pages are reachable and published snapshots are withdrawn.
    expect((await boot(guest)).state).toMatchObject({ phase: "WAITING", tree_open: false });
    expect((await dashboard()).settings).toMatchObject({
      started_at: settings.started_at,
      survey_open: false,
      nomination_open: false,
    });
    expect((await other.from("forest_tree_notes").select("id")).data).toEqual([]);
    expect((await other.from("forest_posts").select("id").eq("id", post.id)).data).toEqual([]);
    for (const action of ["forest_edit", "forest_delete"]) {
      expect(
        (
          await other.functions.invoke("portal", {
            body: {
              action,
              payload: { id: post.id, kind: "wish", body: "다른 직원의 변경 시도" },
            },
          })
        ).error?.context?.status,
      ).toBe(403);
    }
    await call(
      sameOwner,
      {
        action: "forest_edit",
        payload: {
          id: post.id,
          kind: "wish",
          body: "일정 변경 후 수정한 내 이야기",
        },
      },
      okSchema,
    );
    expect(await call(guest, { action: "forest_mine", payload: {} }, forestListSchema)).toContainEqual({
      ...post,
      kind: "wish",
      body: "일정 변경 후 수정한 내 이야기",
    });
    expect(
      (
        await guest.functions.invoke("portal", {
          body: {
            action: "forest_post",
            payload: { kind: "thanks", body: "새 글 작성은 마감 유지" },
          },
        })
      ).error?.context?.status,
    ).toBe(403);
    await call(sameOwner, { action: "forest_delete", payload: { id: post.id } }, okSchema);
    expect(await call(guest, { action: "forest_mine", payload: {} }, forestListSchema)).not.toContainEqual(
      expect.objectContaining({ id: post.id }),
    );
    await Promise.all([guest.auth.signOut(), other.auth.signOut(), sameOwner.auth.signOut()]);
  });

  it.each([null, "2000-01-01T00:00:00+09:00"])(
    "keeps own edit/delete locked without a future start: %s",
    async (start) => {
      // Given
      const { guest, post } = await ownPost();
      await call(
        admin,
        { action: "settings", payload: { ...(await dashboard()).settings, event_start_at: start } },
        okSchema,
      );
      // When / Then
      for (const action of ["forest_edit", "forest_delete"]) {
        expect(
          (
            await guest.functions.invoke("portal", {
              body: {
                action,
                payload: { id: post.id, kind: "wish", body: "마감 후 변경 시도" },
              },
            })
          ).error?.context?.status,
        ).toBe(403);
      }
      expect(await call(guest, { action: "forest_mine", payload: {} }, forestListSchema)).toContainEqual(
        post,
      );
      await guest.auth.signOut();
    },
  );

  it("rejects a stale edit/delete at the new server deadline", async () => {
    // Given: a client was connected while edits were allowed.
    const { guest, post } = await ownPost();
    await call(
      admin,
      {
        action: "settings",
        payload: {
          ...(await dashboard()).settings,
          event_start_at: new Date(Date.now() + 3600000).toISOString(),
        },
      },
      okSchema,
    );
    // When: the deadline arrives without closing the client session.
    await sql`update private.settings set event_start_at=now() where id`;
    // Then
    for (const action of ["forest_edit", "forest_delete"]) {
      expect(
        (
          await guest.functions.invoke("portal", {
            body: {
              action,
              payload: { id: post.id, kind: "wish", body: "새 마감 시각 이후 변경" },
            },
          })
        ).error?.context?.status,
      ).toBe(403);
    }
    expect(await call(guest, { action: "forest_mine", payload: {} }, forestListSchema)).toContainEqual(post);
    await guest.auth.signOut();
  });

  it("still closes existing stories when the organizer initially starts before the scheduled time", async () => {
    // Given: a future start was configured before the organizer actually began.
    await sql`update private.settings set event_start_at=now()+interval '1 hour' where id`;
    const { guest, post } = await ownPost();
    // When / Then: only a subsequent administrator schedule save may reopen stories.
    expect(
      (
        await guest.functions.invoke("portal", {
          body: {
            action: "forest_edit",
            payload: { id: post.id, kind: "wish", body: "시작 직후 변경 시도" },
          },
        })
      ).error?.context?.status,
    ).toBe(403);
    await guest.auth.signOut();
  });
});
