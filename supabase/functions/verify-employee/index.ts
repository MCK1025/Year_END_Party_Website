import { loginSchema } from "../_shared/contracts.ts";
import { HttpError, identity, jsonBody, required, serve } from "../_shared/http.ts";

async function digest(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(required("LOGIN_HASH_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const result = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(result), (b) => b.toString(16).padStart(2, "0")).join("");
}
serve(async (request) => {
  const { client, user } = await identity(request);
  const input = loginSchema.safeParse(await jsonBody(request));
  if (!input.success || !user.is_anonymous)
    throw new HttpError(400, "생년월일 6자리 비밀번호를 확인해주세요.");
  const value = input.data;
  const network =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const { data, error } = await client.rpc("verify_employee", {
    p_actor: user.id,
    p_password: value.password,
    p_identity: await digest(value.password),
    p_network: await digest(network),
  });
  if (error || !data?.ok)
    throw new HttpError(
      data?.retry_after ? 429 : 401,
      data?.retry_after
        ? "인증 시도가 많습니다. 15분 뒤 다시 시도해주세요."
        : "생년월일 6자리 비밀번호를 확인해주세요.",
    );
  return { ok: true };
});
