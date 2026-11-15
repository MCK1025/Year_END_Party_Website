import { writeFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import {
  admin,
  boot,
  call,
  command,
  dashboard,
  employee,
  env,
  eventDate,
  fixtures,
  signAdmin,
  sql,
} from "../integration/helpers";

test("50 mobile screens follow the organizer, including a disconnected reader", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1") throw Error("Local preview required");
  const pages: Page[] = [];
  let dropSocket: (() => void) | undefined;
  const timings: { label: string; screens: number; medianMs: number; p95Ms: number; maxMs: number }[] = [];
  const progress = async (...args: Parameters<typeof command>) => {
    const result = await command(...args);
    if (result.error) throw result.error;
  };
  // Install observers before publishing so timing covers command, delivery and
  // the employee DOM update, without adding the time to poll 50 browser pages.
  async function publish(label: string, text: string, advance: () => Promise<void>, readers = pages) {
    const watchers = await Promise.all(
      readers.map((page) =>
        page.evaluateHandle((expected) => {
          const paper = document.querySelector(".book-surface");
          if (!paper || paper.textContent?.includes(expected)) throw Error("Unexpected initial screen");
          const timing = { seen: 0, turning: false };
          const observer = new MutationObserver(() => {
            if (paper.textContent?.includes(expected)) {
              timing.seen = Date.now();
              timing.turning = paper.getAnimations().some((animation) => animation.id === "live-page-turn");
              observer.disconnect();
            }
          });
          observer.observe(paper, { childList: true, subtree: true, characterData: true });
          return timing;
        }, text),
      ),
    );
    try {
      const start = Date.now();
      await advance();
      const elapsed = await Promise.all(
        watchers.map(async (w) => {
          await expect.poll(() => w.evaluate((t) => t.seen), { timeout: 15_000 }).toBeGreaterThan(0);
          return (await w.evaluate((t) => t.seen)) - start;
        }),
      );
      elapsed.sort((a, b) => a - b);
      if (label === "첫 힌트") {
        const turning = await Promise.all(watchers.map((w) => w.evaluate((t) => t.turning)));
        expect(turning.filter(Boolean)).toHaveLength(readers.length);
      }
      const at = (f: number) => elapsed[Math.ceil(elapsed.length * f) - 1] ?? 0;
      timings.push({ label, screens: elapsed.length, medianMs: at(0.5), p95Ms: at(0.95), maxMs: at(1) });
    } finally {
      await Promise.all(watchers.map((w) => w.dispose()));
    }
  }
  await signAdmin();
  try {
    await sql`update private.settings set started_at=null,enabled=true,survey_open=true,nomination_open=true`;
    await progress("waiting");
    await eventDate(false);
    const seed = await employee(0);
    const me = await boot(seed);
    await call(
      seed,
      {
        action: "save_survey",
        payload: {
          answers: {
            food: "한식",
            hobby: "독서",
            youtube: "가상 채널",
            dream: "첫 번째 별",
            surprise: "두 번째 별",
            moment: "세 번째 별",
          },
          consent: true,
          excluded: [],
        },
      },
      okSchema,
    );
    await call(
      admin,
      {
        action: "round",
        payload: {
          employee_id: me.self.id,
          question_keys: ["dream", "surprise", "moment"],
          hints: ["첫 번째 별", "두 번째 별", "세 번째 별"],
          approved: true,
          sort_order: 98,
        },
      },
      okSchema,
    );
    const round = (await dashboard()).rounds.find(
      (r) => r.approved && r.eligible && r.employee_id === me.self.id && r.sort_order === 98,
    );
    if (!round) throw Error("Missing approved fixture");
    await seed.auth.signOut();
    for (let offset = 0; offset < 50; offset += 5) {
      const batch = await Promise.all(
        fixtures.map(async (_, i) => {
          const client = await employee(i);
          const {
            data: { session },
          } = await client.auth.getSession();
          if (!session) throw Error("Missing test login");
          const page = await browser.newPage({
            baseURL,
            viewport: { width: 390, height: 844 },
            storageState: {
              cookies: [],
              origins: [
                {
                  origin: new URL(baseURL).origin,
                  localStorage: [
                    {
                      name: `sb-${new URL(env.SUPABASE_URL).hostname.split(".")[0]}-auth-token`,
                      value: JSON.stringify(session),
                    },
                  ],
                },
              ],
            },
          });
          if (offset + i === 49) {
            await page.routeWebSocket("**/realtime/v1/websocket*", (socket) => {
              const server = socket.connectToServer();
              dropSocket = () => {
                socket.close();
                server.close();
              };
            });
          }
          await page.goto("/#/event");
          await expect(page.locator(".book-status")).toContainText("실시간 연결됨");
          return page;
        }),
      );
      pages.push(...batch);
    }
    await publish("회고", "우리의 장면들.", () => progress("phase", { phase: "RECAP" }));
    await publish("인물 맞히기", "다음 이야기의 주인공", () => progress("phase", { phase: "WHO_AM_I" }));
    await publish("인물 시작", "첫 번째 힌트가 곧", () => progress("start_person", { round_id: round.id }));
    await publish("첫 힌트", "첫 번째 별", () => progress("hint"));
    const reloadStarted = Date.now();
    await Promise.all(
      pages.map(async (p) => {
        await p.reload({ waitUntil: "domcontentloaded" });
        const paper = p.locator(".book-surface");
        await expect(paper).toContainText("첫 번째 별", { timeout: 15_000 });
        await expect(paper).not.toContainText("두 번째 별");
        await expect(p.locator(".book-status")).toContainText("실시간 연결됨", { timeout: 15_000 });
      }),
    );
    const reloadBatchMs = Date.now() - reloadStarted;
    const last = pages.at(-1);
    if (!last || !dropSocket) throw Error("Missing test screen or live connection");
    await last.context().setOffline(true);
    dropSocket();
    await publish("연결 중인 직원", "두 번째 별", () => progress("hint"), pages.slice(0, -1));
    await expect(last.locator(".book-surface")).not.toContainText("두 번째 별");
    await last.context().setOffline(false);
    await expect(last.locator(".book-surface")).toContainText("두 번째 별");
    await last.reload();
    await expect(last.locator(".book-surface")).toContainText("두 번째 별");
    await expect(last.locator(".book-status")).toContainText("실시간 연결됨");
    await expect(last.locator(".book-surface")).not.toContainText("세 번째 별");
    await publish("일시 정지", "잠시 쉬어갑니다", () => progress("pause"));
    await progress("resume");
    await publish("연속 힌트와 정답", fixtures[0]?.name ?? "가상직원 하나", async () => {
      await progress("hint");
      await progress("reveal");
    });
    await publish("취향", "생각보다,", () => progress("phase", { phase: "TASTES" }));
    await publish("시상", "당신이 있어,", () => progress("phase", { phase: "AWARDS" }));
    await publish("엔딩", "다음 한 걸음도,", () => progress("phase", { phase: "END" }));
    await writeFile(
      "artifacts/local-live-screens.json",
      JSON.stringify({ sessions: pages.length, employees: fixtures.length, reloadBatchMs, timings }, null, 2),
    );
    console.table(timings);
  } finally {
    await Promise.allSettled(pages.map((p) => p.context().close()));
    await progress("waiting");
    await sql.end();
  }
});
