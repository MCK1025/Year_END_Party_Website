import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const local = parseEnv(await readFile(".env.supabase.local", "utf8"));
const url = local.API_URL;
if (!url || !new URL(url).hostname.match(/^(127\.0\.0\.1|localhost)$/))
  throw new Error("Local Supabase only");
const serviceKey = local.SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error("Run supabase status -o env > .env.supabase.local first");
const client = createClient(url, serviceKey, { auth: { persistSession: false } });
const password = randomBytes(24).toString("base64url");
const email = "organizer@party.test";
const { data: users, error: listError } = await client.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
let admin = users.users.find((u) => u.email === email);
if (admin) {
  const { error } = await client.auth.admin.updateUserById(admin.id, { password });
  if (error) throw error;
} else {
  const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  admin = data.user;
}
const sql = postgres(local.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
await sql`insert into private.admins(user_id) values(${admin.id}) on conflict do nothing`;
await sql.end();
await writeFile(
  ".env.local",
  `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${local.ANON_KEY}\nVITE_DISABLE_REACT_DEVTOOLS=1\n`,
);
await writeFile(
  ".env.test.local",
  `DB_URL=${local.DB_URL}\nSUPABASE_URL=${url}\nSUPABASE_ANON_KEY=${local.ANON_KEY}\nSUPABASE_SERVICE_ROLE_KEY=${serviceKey}\nADMIN_EMAIL=${email}\nADMIN_PASSWORD=${password}\n`,
);
await writeFile(
  "supabase/functions/.env.local",
  `LOGIN_HASH_SECRET=${randomBytes(32).toString("hex")}\nALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173\n`,
);
console.log(
  "Local configuration and test administrator ready. Credentials remain in ignored .env.test.local.",
);
