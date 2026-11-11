import { createClient } from "@supabase/supabase-js";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(503, "서버 설정을 확인해주세요.");
  return value;
}
export const service = () =>
  createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
export async function identity(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) throw new HttpError(401, "다시 로그인해주세요.");
  const client = service();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "다시 로그인해주세요.");
  // This client validates claims cryptographically against the project's Auth server.
  const { data: claims, error: claimError } = await client.auth.getClaims(token);
  if (claimError || !claims) throw new HttpError(401, "다시 로그인해주세요.");
  return { client, user: data.user, aal: claims.claims["aal"] === "aal2" ? "aal2" : "aal1" };
}
export async function rpc(
  client: ReturnType<typeof service>,
  actor: string,
  action: string,
  payload: object,
  aal: string,
) {
  const { data, error } = await client.rpc("portal", {
    p_actor: actor,
    p_action: action,
    p: { ...payload, _aal: aal },
  });
  if (error)
    throw new HttpError(error.code === "42501" ? 403 : error.code === "40001" ? 409 : 400, error.message);
  return data;
}
export function serve(handler: (request: Request) => Promise<unknown>) {
  Deno.serve(async (request) => {
    const origin = request.headers.get("origin");
    const allowed = (
      Deno.env.get("ALLOWED_ORIGINS") ??
      "http://localhost:5173,http://localhost:4173,http://127.0.0.1:4173,http://127.0.0.1:5173"
    ).split(",");
    const headers = {
      "Access-Control-Allow-Origin": origin && allowed.includes(origin) ? origin : "null",
      Vary: "Origin",
      "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Cache-Control": "no-store",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers, status: 204 });
    if (origin && !allowed.includes(origin))
      return Response.json({ error: "허용되지 않은 접속 주소입니다." }, { status: 403, headers });
    if (request.method !== "POST")
      return Response.json({ error: "POST 요청만 허용합니다." }, { status: 405, headers });
    try {
      return Response.json(await handler(request), { headers });
    } catch (error) {
      if (error instanceof HttpError)
        return Response.json({ error: error.message }, { status: error.status, headers });
      return Response.json(
        { error: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요." },
        { status: 500, headers },
      );
    }
  });
}
export async function jsonBody(request: Request): Promise<unknown> {
  const body = await request.text();
  if (body.length > 150000) throw new HttpError(413, "입력 용량을 줄여주세요.");
  try {
    return JSON.parse(body);
  } catch (error) {
    if (error instanceof SyntaxError) throw new HttpError(400, "요청 형식 오류");
    throw error;
  }
}
