import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const email = z.email().parse(process.argv[2]);
const project = z
  .string()
  .regex(/^[a-z]{20}$/)
  .parse(process.argv[3]);
const url = `https://${project}.supabase.co`;
const keys = z
  .array(
    z.object({
      name: z.string(),
      type: z.string(),
      api_key: z.string(),
    }),
  )
  .parse(JSON.parse(await readFile("artifacts/local-production-keys.json", "utf8")));
const serviceKey = keys.find((k) => k.name === "service_role" && k.api_key.startsWith("eyJ"))?.api_key;
const publicKey = keys.find((k) => k.type === "publishable")?.api_key;
if (!serviceKey || !publicKey?.startsWith("sb_publishable_")) throw new Error("Usable project keys missing");
const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const listed = await client.auth.admin.listUsers();
if (listed.error) throw listed.error;
const existing = listed.data.users.find((u) => u.email === email);
let id = existing?.id;
if (!id) {
  if (existsSync(".env.admin.production.local"))
    throw new Error(
      "A private credential file already exists; preserve it before provisioning a different account",
    );
  const password = randomBytes(24).toString("base64url");
  const created = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { party_admin_provisioning: true },
  });
  if (created.error) throw created.error;
  id = created.data.user.id;
  await writeFile(
    ".env.admin.production.local",
    `SUPABASE_URL=${url}\nSUPABASE_PUBLISHABLE_KEY=${publicKey}\nADMIN_EMAIL=${email}\nADMIN_PASSWORD=${password}\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log("Administrator created; credentials saved only to ignored .env.admin.production.local");
} else {
  console.log("Existing administrator preserved; password was not changed");
}
const userId = z.uuid().parse(id);
await writeFile(
  "supabase/.temp/production-admin.sql",
  `insert into private.admins(user_id) values ('${userId}'::uuid) on conflict do nothing;\n`,
  { mode: 0o600 },
);
await writeFile(
  ".env.hosted.local",
  `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${publicKey}\nVITE_DISABLE_REACT_DEVTOOLS=1\n`,
  { mode: 0o600 },
);
console.log("Hosted frontend environment and administrator grant SQL prepared");
