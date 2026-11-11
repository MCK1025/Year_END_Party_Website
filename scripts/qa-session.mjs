import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
export const env = parseEnv(await readFile(".env.test.local", "utf8"));
if (!env.SUPABASE_URL || !/^(127\.0\.0\.1|localhost)$/.test(new URL(env.SUPABASE_URL).hostname))
  throw new Error("Local QA only");
export const makeClient = () =>
  createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
export const admin = makeClient();
const signedIn = await admin.auth.signInWithPassword({
  email: env.ADMIN_EMAIL,
  password: env.ADMIN_PASSWORD,
});
if (signedIn.error) throw signedIn.error;
export async function call(action, payload = {}, client = admin) {
  const { data, error } = await client.functions.invoke("portal", { body: { action, payload } });
  if (error) {
    const detail = error.context instanceof Response ? await error.context.text() : error.message;
    throw new Error(`${action}: ${detail}`);
  }
  return data;
}
export async function command(command, extra = {}) {
  const data = await call("dashboard");
  return call("command", { command, revision: data.state.revision, ...extra });
}
