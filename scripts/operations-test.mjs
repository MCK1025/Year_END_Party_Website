import { readFile, writeFile } from "node:fs/promises";

import postgres from "postgres";
import { admin, call, command, makeClient } from "./qa-session.mjs";

const sql = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres");
const outcomes = [];
const ensure = (value, name) => {
  if (!value) throw new Error(name);
  outcomes.push({ name, passed: true });
};
async function login(code) {
  const c = makeClient();
  const auth = await c.auth.signInAnonymously();
  if (auth.error) throw auth.error;
  const result = await c.functions.invoke("verify-employee", {
    body: { name: "가상 운영시험", date_of_birth: "1995-06-06", access_code: code },
  });
  return { c, result };
}
try {
  await sql`update private.settings set enabled=true,survey_open=true,nomination_open=true`;
  await sql`delete from private.login_attempts`;
  await command("waiting");
  const issued = await call("import", {
    employees: [
      {
        employee_no: "TEST-OPERATIONS",
        name: "가상 운영시험",
        department: "가상 검증팀",
        date_of_birth: "1995-06-06",
      },
    ],
  });
  const oldCode = issued.issued[0].access_code;
  ensure(oldCode.length >= 12, "CSV import generates strong code once");
  const before = await login(oldCode);
  ensure(!before.result.error, "Imported employee authenticates");
  let dashboard = await call("dashboard");
  const person = dashboard.employees.find((e) => e.employee_no === "TEST-OPERATIONS");
  const reset = await call("reset_code", { id: person.id });
  const revoked = await before.c.functions.invoke("portal", { body: { action: "bootstrap", payload: {} } });
  ensure(Boolean(revoked.error), "Code rotation revokes existing employee binding");
  const old = await login(oldCode);
  ensure(Boolean(old.result.error), "Old code is rejected after rotation");
  const current = await login(reset.issued[0].access_code);
  ensure(!current.result.error, "New code authenticates");
  const invalid = new FormData();
  invalid.set("file", new File(["<svg>unsafe</svg>"], "photo.png", { type: "image/png" }));
  const rejected = await admin.functions.invoke("upload-media", { body: invalid });
  ensure(Boolean(rejected.error), "MIME spoofed SVG upload is rejected");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const form = new FormData();
  form.set("file", new File([png], "synthetic.png", { type: "image/png" }));
  const uploaded = await admin.functions.invoke("upload-media", { body: form });
  if (uploaded.error) throw uploaded.error;
  await call("recap", {
    caption: "가상 사진 권한 시험",
    asset_path: uploaded.data.path,
    published: true,
    sort_order: 0,
  });
  const early = await current.c.storage.from("event-media").createSignedUrl(uploaded.data.path, 60);
  ensure(Boolean(early.error), "Private recap image blocked during waiting");
  dashboard = await call("dashboard");
  const day = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await call("settings", { ...dashboard.settings, event_start_at: `${day}T18:00:00+09:00` });
  await command("phase", { phase: "RECAP" });
  const released = await current.c.storage.from("event-media").download(uploaded.data.path);
  ensure(
    !released.error && released.data.size > 0,
    "Private recap image available only after authorized release",
  );
  // This destructive operation is intentionally restricted by qa-session to this synthetic local project.
  await call("purge", { confirmation: "개인정보 영구 삭제" });
  const remaining = await sql`select
    (select count(*)::int from private.employees) employees,
    (select count(*)::int from public.surveys) surveys,
    (select count(*)::int from public.nominations) nominations,
    (select count(*)::int from private.sessions) bindings,
    (select count(*)::int from auth.users where is_anonymous) anonymous_users,
    (select count(*)::int from storage.objects where bucket_id='event-media') files`;
  ensure(
    Object.values(remaining[0]).every((count) => count === 0),
    "Purge removes all staff data, storage and anonymous Auth accounts",
  );
  ensure((await call("dashboard")).employees.length === 0, "Purge preserves separate administrator access");
  await writeFile(
    "artifacts/operations-test.json",
    JSON.stringify({ timestamp: new Date().toISOString(), outcomes, remaining: remaining[0] }, null, 2),
  );
  console.log({ passed: outcomes.length, remaining: remaining[0] });
} finally {
  // Return the development environment to exactly five synthetic employees.
  const rows = await sql`select count(*)::int count from private.employees`;
  if (rows[0].count === 0) await sql.unsafe(await readFile("supabase/seed.sql", "utf8"));
  else await sql`delete from private.employees where employee_no='TEST-OPERATIONS'`;
  await sql`update private.settings set enabled=true,survey_open=true,nomination_open=true,welcome='2026년 한 걸음 더 가까워진, 그리고 가까워질 우리',ending='덕분에, 한 걸음 더 가까워졌습니다. 우리의 다음 한 걸음도 함께해요.' where id`;
  await sql.end();
}
