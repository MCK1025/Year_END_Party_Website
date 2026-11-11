import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

const env = parseEnv(await readFile(".env.test.local", "utf8"));
const url = env.SUPABASE_URL;
if (!url || !/^(127\.0\.0\.1|localhost)$/.test(new URL(url).hostname))
  throw new Error("Local load test only");
const make = () =>
  createClient(url, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = make();
const login = await admin.auth.signInWithPassword({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD });
if (login.error) throw login.error;
async function call(client, action, payload = {}) {
  const { data, error } = await client.functions.invoke("portal", { body: { action, payload } });
  if (error) throw error;
  return data;
}
let d = await call(admin, "dashboard");
const day = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
await call(admin, "settings", {
  ...d.settings,
  enabled: true,
  event_start_at: `${day}T18:00:00+09:00`,
  survey_open: true,
});
d = await call(admin, "dashboard");
await call(admin, "command", { command: "waiting", revision: d.state.revision });
const fixture = { name: "가상직원 하나", date_of_birth: "1990-01-01", access_code: "TEST2026-A1" };
const clients = [];
const readyTimes = [];
let expectedRevision = -1;
let publishedAt = 0;
try {
  // Fifty independent Auth users and fifty sockets, all bound to synthetic fixture IDs.
  for (let batch = 0; batch < 10; batch++) {
    await Promise.all(
      Array.from({ length: 5 }, async () => {
        const c = make();
        clients.push(c);
        const signIn = await c.auth.signInAnonymously();
        if (signIn.error) throw signIn.error;
        const verified = await c.functions.invoke("verify-employee", { body: fixture });
        if (verified.error) throw verified.error;
        await call(c, "bootstrap");
      }),
    );
  }
  const seed = clients[0];
  if (!seed) throw new Error("No clients");
  const me = await call(seed, "bootstrap");
  await call(seed, "save_survey", {
    answers: {
      food: "한식",
      hobby: "독서",
      youtube: "가상 채널",
      dream: "가상 꿈",
      surprise: "가상 반전",
      moment: "가상 기억",
    },
    consent: true,
    excluded: [],
  });
  await call(admin, "round", {
    employee_id: me.self.id,
    question_keys: ["dream", "surprise", "moment"],
    hints: ["LOAD_HINT_1", "LOAD_HINT_2", "LOAD_HINT_3"],
    approved: true,
    sort_order: 99,
  });
  for (const phase of ["RECAP", "WHO_AM_I"]) {
    d = await call(admin, "dashboard");
    await call(admin, "command", { command: "phase", phase, revision: d.state.revision });
  }
  d = await call(admin, "dashboard");
  const round = d.rounds.find((r) => r.hints[0] === "LOAD_HINT_1");
  await call(admin, "command", { command: "start_person", round_id: round.id, revision: d.state.revision });
  await Promise.all(
    clients.map(
      (c, i) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Subscriber ${i} timed out`)), 15000);
          c.channel(`load-${i}`)
            .on(
              "postgres_changes",
              { event: "UPDATE", schema: "public", table: "event_public_state" },
              (event) => {
                if (event.new.revision === expectedRevision) readyTimes[i] = performance.now() - publishedAt;
              },
            )
            .subscribe((status) => {
              if (status === "SUBSCRIBED") {
                clearTimeout(timer);
                resolve();
              }
              if (status === "CHANNEL_ERROR") {
                clearTimeout(timer);
                reject(new Error(`Subscriber ${i} failed`));
              }
            });
        }),
    ),
  );
  const snapshotsAt = performance.now();
  await Promise.all(clients.map((c) => call(c, "bootstrap")));
  const snapshotDuration = performance.now() - snapshotsAt;
  d = await call(admin, "dashboard");
  expectedRevision = d.state.revision + 1;
  publishedAt = performance.now();
  await call(admin, "command", { command: "hint", revision: d.state.revision });
  const deadline = performance.now() + 10000;
  while (readyTimes.filter(Number.isFinite).length < 50 && performance.now() < deadline)
    await new Promise((r) => setTimeout(r, 25));
  const restored = await call(clients[49], "bootstrap");
  const ordered = readyTimes.filter(Number.isFinite).sort((a, b) => a - b);
  const result = {
    timestamp: new Date().toISOString(),
    environment: "local Docker Supabase, real Auth/Edge/Postgres Changes",
    concurrentClients: 50,
    received: ordered.length,
    p50Ms: Math.round(ordered[24] ?? 0),
    p95Ms: Math.round(ordered[47] ?? 0),
    maxMs: Math.round(ordered.at(-1) ?? 0),
    concurrentSnapshotBatchMs: Math.round(snapshotDuration),
    restoredRevision: restored.state.revision,
    restoredHintCount: restored.state.payload.hints?.length,
    unrevealedHintLeaked: JSON.stringify(restored.state).includes("LOAD_HINT_2"),
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/load-test.json", JSON.stringify(result, null, 2));
  console.log(result);
  if (result.received !== 50 || result.restoredHintCount !== 1 || result.unrevealedHintLeaked)
    throw new Error("Load test acceptance failed");
} finally {
  await Promise.all(
    clients.map(async (c) => {
      await c.removeAllChannels();
      await c.auth.signOut();
    }),
  );
  d = await call(admin, "dashboard");
  await call(admin, "command", { command: "waiting", revision: d.state.revision });
}
