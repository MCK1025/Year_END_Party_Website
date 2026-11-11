import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { PortalRequest } from "../../supabase/functions/_shared/contracts";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key && !url.includes("YOUR_PROJECT"));
export const supabase = createClient(url || "http://127.0.0.1:54321", key || "configuration-missing", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}
async function invoke(name: string, body: object | FormData): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    if (error.context instanceof Response) {
      const parsed = z.object({ error: z.string() }).safeParse(await error.context.json());
      if (parsed.success) throw new ApiError(parsed.data.error, error.context.status);
    }
    throw new ApiError("연결을 확인하고 다시 시도해주세요.");
  }
  return data;
}
export async function api<T>(request: PortalRequest, schema: z.ZodType<T>): Promise<T> {
  return schema.parse(await invoke("portal", request));
}
export async function verify(body: object): Promise<void> {
  z.object({ ok: z.literal(true) }).parse(await invoke("verify-employee", body));
}
export async function upload(file: File): Promise<string> {
  const body = new FormData();
  body.set("file", file);
  return z.object({ path: z.string() }).parse(await invoke("upload-media", body)).path;
}
export function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof z.ZodError) return "입력 내용 또는 서버 응답 형식을 확인해주세요.";
  if (error instanceof Error) return error.message;
  return "처리 중 문제가 생겼습니다. 다시 시도해주세요.";
}
