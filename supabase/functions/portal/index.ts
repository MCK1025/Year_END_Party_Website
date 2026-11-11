import { HttpError, identity, jsonBody, rpc, serve } from "../_shared/http.ts";
import { purge } from "../_shared/purge.ts";
import { requestSchema } from "../_shared/requests.ts";

const code = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(12)),
    (n) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[n % 32],
  ).join("");
serve(async (request) => {
  const { client, user, aal } = await identity(request);
  const input = requestSchema.safeParse(await jsonBody(request));
  if (!input.success) throw new HttpError(400, "입력 내용을 확인해주세요.");
  const { action, payload } = input.data;
  switch (action) {
    case "import": {
      const ids = new Set(payload.employees.map((e) => e.employee_no));
      if (ids.size !== payload.employees.length) throw new HttpError(400, "사원 번호가 중복되었습니다.");
      return rpc(
        client,
        user.id,
        action,
        { employees: payload.employees.map((e) => ({ ...e, access_code: code() })) },
        aal,
      );
    }
    case "reset_code":
      return rpc(client, user.id, action, { ...payload, access_code: code() }, aal);
    case "purge":
      return purge(client, user.id, aal);
    default:
      return rpc(client, user.id, action, payload, aal);
  }
});
