import { HttpError, rpc, type service } from "./http.ts";

export async function purge(client: ReturnType<typeof service>, actor: string, aal: string) {
  await rpc(client, actor, "purge_begin", {}, aal);
  while (true) {
    const { data: files, error } = await client.storage.from("event-media").list("", { limit: 1000 });
    if (error) throw new HttpError(500, "사진 목록 조회에 실패했습니다. 다시 삭제를 실행해주세요.");
    if (!files?.length) break;
    const removed = await client.storage.from("event-media").remove(files.map((f) => f.name));
    if (removed.error) throw new HttpError(500, "사진 삭제에 실패했습니다. 다시 삭제를 실행해주세요.");
  }
  let page = 1;
  const users: string[] = [];
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new HttpError(500, "인증 목록 조회에 실패했습니다.");
    users.push(...data.users.filter((u) => u.is_anonymous).map((u) => u.id));
    if (data.users.length < 1000) break;
    page++;
  }
  for (let offset = 0; offset < users.length; offset += 10) {
    const results = await Promise.all(
      users.slice(offset, offset + 10).map((id) => client.auth.admin.deleteUser(id)),
    );
    if (results.some((result) => result.error))
      throw new HttpError(500, "인증 세션 삭제에 실패했습니다. 다시 실행해주세요.");
  }
  return rpc(client, actor, "purge_finish", {}, aal);
}
