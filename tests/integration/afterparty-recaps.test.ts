import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { sql } from "./helpers";

test("completed employees read only published album pages and photos until the event is reset", async () => {
  const actor = randomUUID();
  const shown = randomUUID();
  const draft = randomUUID();
  const rollback = new Error("rollback local album fixture");
  try {
    await sql.begin(async (tx) => {
      await tx`insert into auth.users(id,is_anonymous) values(${actor},true)`;
      await tx`insert into private.sessions(auth_user_id,employee_id)
        select ${actor},id from private.employees where active limit 1`;
      await tx`select set_config('request.jwt.claim.sub',${actor},true)`;
      await tx`update private.settings set enabled=true, event_start_at=now()-interval '1 hour' where id`;
      await tx`update public.event_public_state set phase='COMPLETED' where id`;
      const revision = async () =>
        Number((await tx`select revision from public.event_public_state where id`)[0]?.revision);
      const before = await revision();
      for (const id of [shown, draft]) {
        await tx`insert into private.recaps(id,caption,sort_order,published,asset_path,album)
          values (${id},'테스트 회고',1,${id === shown},${`${id}/legacy`},
            ${tx.json({ cover_path: `${id}/cover`, slides: [{ asset_path: `${id}/detail` }] })})`;
        await tx`insert into storage.objects(bucket_id,name) values('event-media',${`${id}/cover`})`;
      }
      expect(await revision()).toBeGreaterThan(before);
      const canRead = async (path: string) =>
        (await tx`select coalesce(public.can_read_media(${path}),false) as ok`)[0]?.ok;
      const list = (user = actor) =>
        tx`select item->>'id' as id from jsonb_array_elements(public.portal(${user},'recaps','{}')) item`;
      for (const phase of ["RECAP", "COMPLETED"]) {
        await tx`update public.event_public_state set phase=${phase} where id`;
        const ids = (await list()).map((r) => r.id);
        expect(ids).toContain(shown);
        expect(ids).not.toContain(draft);
        for (const asset of ["legacy", "cover", "detail"]) {
          expect(await canRead(`${shown}/${asset}`)).toBe(true);
          expect(await canRead(`${draft}/${asset}`)).toBe(false);
        }
      }
      await tx`set local role authenticated`;
      const photos = await tx`select name from storage.objects where bucket_id='event-media' and
        name in (${`${shown}/cover`},${`${draft}/cover`})`;
      expect(photos.map((photo) => photo.name)).toEqual([`${shown}/cover`]);
      await tx`reset role`;
      await tx`update private.recaps set published=false where id=${shown}`;
      expect((await list()).map((r) => r.id)).not.toContain(shown);
      expect(await canRead(`${shown}/detail`)).toBe(false);
      await tx`update private.recaps set published=true where id=${shown}`;
      await tx`update private.settings set event_start_at=now()+interval '1 hour' where id`;
      await expect(tx.savepoint(() => list())).rejects.toThrow(/공개 전/);
      expect(await canRead(`${shown}/cover`)).toBe(false);
      await tx`update private.settings set event_start_at=now()-interval '1 hour' where id`;
      await tx`delete from private.sessions where auth_user_id=${actor}`;
      await expect(tx.savepoint(() => list())).rejects.toThrow(/직원 인증/);
      expect(await canRead(`${shown}/cover`)).toBe(false);
      await tx`insert into private.sessions(auth_user_id,employee_id)
        select ${actor},id from private.employees where active limit 1`;
      await tx`update public.event_public_state set phase='WAITING' where id`;
      await expect(tx.savepoint(() => list())).rejects.toThrow(/공개 전/);
      expect(await canRead(`${shown}/detail`)).toBe(false);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
});
