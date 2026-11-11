import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const project = z
  .string()
  .regex(/^[a-z]{20}$/)
  .parse(process.argv[2]);
const env = z
  .object({
    SUPABASE_URL: z.url(),
    SUPABASE_PUBLISHABLE_KEY: z.string(),
    ADMIN_EMAIL: z.email(),
    ADMIN_PASSWORD: z.string(),
  })
  .parse(parseEnv(await readFile(".env.admin.production.local", "utf8")));
assert.equal(env.SUPABASE_URL, `https://${project}.supabase.co`);
const keys = z
  .array(z.object({ name: z.string(), api_key: z.string() }))
  .parse(JSON.parse(await readFile("artifacts/local-production-keys.json", "utf8")));
const serviceKey = keys.find((k) => k.name === "service_role")?.api_key;
assert.ok(serviceKey?.startsWith("eyJ"));
const make = (key = env.SUPABASE_PUBLISHABLE_KEY) =>
  createClient(env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const admin = make();
const guest = make();
const service = make(serviceKey);
const checks = [];
let guestId;
let channel;
let broadcastTimer;
function checked(name, condition) {
  assert.ok(condition, name);
  checks.push({ name, passed: true });
}
try {
  const settings = await fetch(`${env.SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY },
  });
  const authSettings = z.object({ disable_signup: z.boolean() }).parse(await settings.json());
  checked("Signup routing enabled for anonymous authentication", !authSettings.disable_signup);
  const signed = await admin.auth.signInWithPassword({
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  });
  checked("Separate administrator authenticates", !signed.error && Boolean(signed.data.user));
  const dashboard = await admin.functions.invoke("portal", { body: { action: "dashboard", payload: {} } });
  checked(
    "Hosted Edge administrator authorization",
    !dashboard.error && dashboard.data?.employees?.length === 0,
  );
  const anonymous = await guest.auth.signInAnonymously();
  checked(
    "Employee anonymous Auth works while public email registration is blocked",
    !anonymous.error && Boolean(anonymous.data.user),
  );
  guestId = anonymous.data.user?.id;
  const token = anonymous.data.session?.access_token;
  assert.ok(token);
  const permanent = await make().auth.signUp({
    email: "signup-probe@example.invalid",
    password: "Probe-only-Not-A-Credential-749!",
    options: { data: { party_admin_provisioning: true } },
  });
  checked(
    "Public email signup and forged user_metadata blocked by Auth hook",
    Boolean(permanent.error) && !permanent.data.user && permanent.error.status === 403,
  );
  const denied = await guest.functions.invoke("portal", { body: { action: "dashboard", payload: {} } });
  checked("Unverified user denied administrator API", denied.error?.context?.status === 403);
  const privateRows = await guest.from("surveys").select("*");
  checked("Unverified user cannot read survey rows", !privateRows.error && privateRows.data?.length === 0);
  const publicState = await guest.from("event_public_state").select("*");
  checked(
    "Unverified user cannot read public event snapshot",
    !publicState.error && publicState.data?.length === 0,
  );
  const directRpc = await guest.rpc("portal", {
    p_actor: signed.data.user?.id,
    p_action: "dashboard",
    p: {},
  });
  checked("Direct privileged RPC denied", Boolean(directRpc.error));
  const legacy = await guest.from("game_state").select("id");
  checked("Previous prototype hint endpoint is inaccessible", Boolean(legacy.error));
  const unknown = await guest.functions.invoke("verify-employee", {
    body: {
      name: `운영 연결 점검 ${crypto.randomUUID()}`,
      date_of_birth: "1990-01-01",
      access_code: "NOT-REGISTERED-CHECK",
    },
  });
  checked("Unregistered employee identity rejected", unknown.error?.context?.status === 401);
  const headers = {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const cors = await fetch(`${env.SUPABASE_URL}/functions/v1/portal`, {
    method: "POST",
    headers: { ...headers, Origin: "https://not-allowed.invalid" },
    body: JSON.stringify({ action: "dashboard", payload: {} }),
  });
  checked(
    "Unapproved browser origin rejected",
    cors.status === 403 && cors.headers.get("access-control-allow-origin") === "null",
  );
  const preflight = await fetch(`${env.SUPABASE_URL}/functions/v1/portal`, {
    method: "OPTIONS",
    headers: { Origin: "https://MCK1025.github.io", "Access-Control-Request-Method": "POST" },
  });
  checked(
    "GitHub Pages CORS preflight allowed",
    preflight.status === 204 &&
      preflight.headers.get("access-control-allow-origin") === "https://MCK1025.github.io",
  );
  const file = new FormData();
  file.set("file", new File([new Uint8Array([0])], "invalid.png", { type: "image/png" }));
  const upload = await guest.functions.invoke("upload-media", { body: file });
  checked("Unverified user denied media upload", upload.error?.context?.status === 403);
  assert.equal(dashboard.data.state.phase, "WAITING", "Readiness check only runs before the event");
  const expectedRevision = dashboard.data.state.revision + 1;
  let received;
  let missed;
  const broadcast = new Promise((resolve, reject) => {
    received = resolve;
    missed = reject;
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Hosted Realtime subscription timeout")), 15000);
    channel = admin
      .channel("production-readiness")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "event_public_state",
        },
        (event) => {
          if (event.new.revision === expectedRevision) received(event.new);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
        }
        if (status === "CHANNEL_ERROR") {
          clearTimeout(timer);
          reject(new Error("Hosted Realtime subscription failed"));
        }
      });
  });
  await ready;
  checked("Hosted Realtime channel connects", true);
  broadcastTimer = setTimeout(() => missed(new Error("Hosted state update timeout")), 15000);
  const [snapshot] = await Promise.all([
    broadcast,
    admin.functions
      .invoke("portal", {
        body: {
          action: "command",
          payload: { command: "waiting", revision: dashboard.data.state.revision },
        },
      })
      .then((result) => checked("Hosted waiting-state command succeeds", !result.error)),
  ]);
  checked(
    "Hosted Postgres Changes delivers the new snapshot",
    snapshot.phase === "WAITING" && snapshot.revision === expectedRevision,
  );
  await writeFile(
    "artifacts/production-smoke.json",
    JSON.stringify(
      {
        project,
        timestamp: new Date().toISOString(),
        checks,
        limits:
          "No employee fixtures, employee save/game publication, load test or physical devices on production",
      },
      null,
      2,
    ),
  );
  console.log({ project, passed: checks.length });
} finally {
  clearTimeout(broadcastTimer);
  if (channel) await admin.removeChannel(channel);
  await guest.auth.signOut();
  await admin.auth.signOut();
  if (guestId) {
    const removed = await service.auth.admin.deleteUser(guestId);
    assert.equal(removed.error, null, "Temporary anonymous probe cleanup");
  }
}
