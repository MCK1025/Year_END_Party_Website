import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { z } from "zod";
import {
  bootstrapSchema,
  dashboardSchema,
  type PortalRequest,
} from "../../supabase/functions/_shared/contracts";

export const env = z
  .object({
    SUPABASE_URL: z.url(),
    DB_URL: z.string().optional(),
    SUPABASE_ANON_KEY: z.string(),
    SUPABASE_SERVICE_ROLE_KEY: z.string(),
    ADMIN_EMAIL: z.string(),
    ADMIN_PASSWORD: z.string(),
  })
  .parse(parseEnv(readFileSync(".env.test.local", "utf8")));
if (!new URL(env.SUPABASE_URL).hostname.match(/^(127\.0\.0\.1|localhost)$/))
  throw new Error("Integration tests only run on local Supabase");
export const client = () =>
  createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
export const sql = postgres(env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
export const fixtures = [
  { name: "가상직원 하나", date_of_birth: "1990-01-01" },
  { name: "가상직원 둘", date_of_birth: "1991-02-02" },
  { name: "가상직원 셋", date_of_birth: "1992-03-03" },
  { name: "가상직원 넷", date_of_birth: "1993-04-04" },
  { name: "가상직원 다섯", date_of_birth: "1994-05-05" },
] as const;
export const admin = client();
export async function signAdmin() {
  const { error } = await admin.auth.signInWithPassword({
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  });
  if (error) throw error;
}
export async function employee(index: number) {
  const value = fixtures[index];
  if (!value) throw new Error("Unknown fixture");
  const c = client();
  const auth = await c.auth.signInAnonymously();
  if (auth.error) throw auth.error;
  const { error } = await c.functions.invoke("verify-employee", {
    body: { password: value.date_of_birth.slice(2).replaceAll("-", "") },
  });
  if (error) {
    if (error.context instanceof Response) throw new Error(await error.context.text());
    throw error;
  }
  return c;
}
export async function call<T>(c: ReturnType<typeof client>, request: PortalRequest, schema: z.ZodType<T>) {
  const { data, error } = await c.functions.invoke("portal", { body: request });
  if (error) {
    if (error.context instanceof Response) throw new Error(await error.context.text());
    throw error;
  }
  return schema.parse(data);
}
export const boot = (c: ReturnType<typeof client>) =>
  call(c, { action: "bootstrap", payload: {} }, bootstrapSchema);
export const dashboard = () => call(admin, { action: "dashboard", payload: {} }, dashboardSchema);
export async function command(
  command:
    | "phase"
    | "start_person"
    | "hint"
    | "reveal"
    | "taste_question"
    | "taste_reveal"
    | "waiting"
    | "pause"
    | "resume"
    | "undo",
  extra: object = {},
) {
  const data = await dashboard();
  return admin.functions.invoke("portal", {
    body: { action: "command", payload: { command, revision: data.state.revision, ...extra } },
  });
}
export async function eventDate(future: boolean) {
  const d = await dashboard();
  const date = new Date(Date.now() + (future ? 86400000 : -86400000)).toISOString().slice(0, 10);
  return call(
    admin,
    { action: "settings", payload: { ...d.settings, event_start_at: `${date}T18:00:00+09:00` } },
    z.object({ ok: z.boolean() }),
  );
}
