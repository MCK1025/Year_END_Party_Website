import { expect, type Page, test } from "@playwright/test";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { admin, boot, call, dashboard, employee, env, signAdmin } from "../integration/helpers";
import { localDatabase } from "./local-db";

test("the organizer ends the event and employees freely browse, reconnect and search real approved answers", async ({
  browser,
  page,
  baseURL,
}) => {
  if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1") throw Error("Local preview required");
  const sql = localDatabase();
  test.setTimeout(180000);
  const screens = process.env.PARTY_BROWSERS === "50" ? 50 : 5;
  const guests: Page[] = [];
  const longAnswer = `${"올해 함께 만든 소중한 순간을 기억합니다. ".repeat(14)}\n  다음 이야기도 함께.`;
  await signAdmin();
  await sql`update private.settings set started_at=null,enabled=true,survey_open=true,nomination_open=true,event_start_at=now()-interval '1 hour'`;
  await sql`update public.event_public_state set phase='WAITING',payload='{}',paused=false,tree_open=false,revision=revision+1`;
  try {
    for (let i = 0; i < 5; i++) {
      const client = await employee(i);
      const data = await boot(client);
      await call(
        client,
        {
          action: "save_survey",
          payload: {
            answers: Object.fromEntries(
              data.questions.map((q) => [
                q.id,
                q.id === "moment" ? longAnswer : `가상 원문 ${i + 1} ${q.id}`,
              ]),
            ),
            consent: true,
            excluded: [],
          },
        },
        okSchema,
      );
      await call(
        admin,
        {
          action: "review_card",
          payload: {
            employee_id: data.self.id,
            question_keys: ["food", "moment"],
            revision: (await dashboard()).state.revision,
          },
        },
        okSchema,
      );
      const session = (await client.auth.getSession()).data.session;
      if (!session) throw Error("Missing fixture session");
      const guest = await browser.newPage({
        baseURL,
        viewport: { width: 390, height: 844 },
        hasTouch: true,
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
      guests.push(guest);
      await guest.goto("/#/event");
      await expect(guest.locator(".book-status")).toContainText("실시간 연결됨");
    }
    for (let offset = 5; offset < screens; offset += 5) {
      const extra = await Promise.all(
        guests.slice(0, 5).map(async (original) => {
          const state = await original.context().storageState();
          const guest = await browser.newPage({
            baseURL,
            viewport: { width: 390, height: 844 },
            storageState: state,
            reducedMotion: "reduce",
          });
          await guest.goto("/#/survey");
          await expect(guest.locator(".book-status")).toContainText("실시간 연결됨");
          return guest;
        }),
      );
      guests.push(...extra);
    }
    const send = async (command: string, extra: object = {}) => {
      const r = await admin.functions.invoke("portal", {
        body: {
          action: "command",
          payload: { command, revision: (await dashboard()).state.revision, ...extra },
        },
      });
      if (r.error) throw r.error;
    };
    await send("start_event");
    for (const phase of ["RECAP", "WHO_AM_I", "TASTES", "AWARDS", "END"]) await send("phase", { phase });
    const first = guests[0],
      offline = guests.at(-1);
    if (!first || !offline) throw Error("Missing mobile screens");
    await offline.context().setOffline(true);
    await page.goto("/#/admin");
    await page.getByLabel("관리자 이메일").fill(env.ADMIN_EMAIL);
    await page.getByLabel("비밀번호", { exact: true }).fill(env.ADMIN_PASSWORD);
    await page.getByRole("button", { name: "운영 화면으로" }).click();
    await page.getByRole("button", { name: "행사 종료 및 자유 관람 시작", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "확인", exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "취소" }).click();
    expect((await dashboard()).state.phase).toBe("END");
    await page.getByRole("button", { name: "행사 종료 및 자유 관람 시작", exact: true }).click();
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "확인", exact: true }).click();
    for (const guest of guests.slice(0, -1)) {
      await expect(guest).toHaveURL(/#\/afterparty$/, { timeout: 15000 });
      await expect(guest.getByRole("heading", { name: "2026년, 한 걸음 더 가까워진 우리" })).toBeVisible();
    }
    await offline.context().setOffline(false);
    await expect(offline).toHaveURL(/#\/afterparty$/, { timeout: 25000 });
    console.log(
      `${screens} mobile browser screens reached the completed home, including the reconnected screen`,
    );
    await first.screenshot({ path: "artifacts/screens/afterparty/home-390.png", fullPage: true });
    await first.reload();
    await expect(first).toHaveURL(/#\/afterparty$/);
    let cardReads = 0;
    first.on("request", (r) => {
      if (r.url().includes("/functions/v1/portal") && r.postDataJSON()?.action === "taste_cards") cardReads++;
    });
    await first.getByRole("link", { name: /혜성식품 인물 카드/ }).click();
    await expect(first.locator(".taste-card")).toContainText(longAnswer);
    await expect(first.locator(".taste-card-nav")).toContainText("1 / 5");
    const initialName = await first.locator(".taste-person h2").textContent();
    await first.getByRole("button", { name: "다음 직원 →" }).click();
    await expect(first.locator(".taste-person h2")).not.toHaveText(initialName ?? "");
    await first.locator(".taste-card").dispatchEvent("pointerdown", {
      pointerType: "touch",
      pointerId: 1,
      isPrimary: true,
      clientX: 300,
      clientY: 200,
    });
    await first.locator(".taste-card").dispatchEvent("pointerup", {
      pointerType: "touch",
      pointerId: 1,
      isPrimary: true,
      clientX: 100,
      clientY: 210,
    });
    await expect(first.locator(".taste-card-nav")).toContainText("3 / 5");
    await first.getByLabel("직원 이름 검색").fill("없는사람");
    await expect(first.getByText("이름에 맞는 공개 카드가 없습니다.")).toBeVisible();
    await first.getByLabel("직원 이름 검색").fill("가상직원 하나");
    await expect(first.locator(".taste-card-nav")).toContainText("1 / 1");
    await first.screenshot({
      path: "artifacts/screens/afterparty/card-390.png",
      fullPage: true,
      animations: "disabled",
    });
    expect(cardReads).toBe(1);
    await first.getByRole("link", { name: "자유 관람 홈으로", exact: true }).click();
    await first
      .getByRole("navigation", { name: "자유 관람 콘텐츠" })
      .getByRole("link", { name: "이야기 트리", exact: true })
      .click();
    await expect(first.locator(".message-tree")).toBeVisible();
    await first.getByRole("link", { name: "자유 관람 홈으로", exact: true }).click();
    await first.getByRole("link", { name: /혜성식품 인물 카드/ }).click();
    await expect(first.locator(".taste-card")).toBeVisible();
    expect(cardReads).toBe(1);
    const blocked = await admin.functions.invoke("portal", {
      body: {
        action: "command",
        payload: { command: "waiting", revision: (await dashboard()).state.revision },
      },
    });
    expect(blocked.error?.context?.status).toBe(409);
    await expect(first).toHaveURL(/#\/cards$/);
    await first.reload();
    await expect(first).toHaveURL(/#\/afterparty$/);
    const late = await browser.newPage({ baseURL });
    guests.push(late);
    await late.goto("/#/login");
    await late.getByRole("button", { name: "바로 입장하기" }).click();
    await late.getByLabel("비밀번호", { exact: true }).fill("900101");
    await late.getByRole("button", { name: "우리의 자리로" }).click();
    await expect(late).toHaveURL(/#\/afterparty$/, { timeout: 15000 });
    await first.getByRole("link", { name: /혜성식품 인물 카드/ }).click();
    const treeGuest = guests[1];
    if (!treeGuest) throw Error("Missing tree screen");
    await treeGuest.locator('.book-index a[href="#/tree"]').click();
    await expect(treeGuest.locator(".message-tree")).toBeVisible();
    await page.getByRole("button", { name: "처음부터 다시 진행", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
    for (const guest of guests) await expect(guest).toHaveURL(/#\/event$/, { timeout: 15000 });
    expect((await dashboard()).state).toMatchObject({ phase: "WAITING", editing_locked: true });
    for (const phase of ["RECAP", "WHO_AM_I", "TASTES", "AWARDS", "END"]) await send("phase", { phase });
    await send("complete_event", { reviewed: true });
    for (const guest of guests) await expect(guest).toHaveURL(/#\/afterparty$/, { timeout: 15000 });
    console.log(`${screens} connected screens restarted and completed the event again`);
  } finally {
    await Promise.allSettled(guests.map((g) => g.context().close()));
    await sql`update public.event_public_state set phase='WAITING',payload='{}',tree_open=false,paused=false,revision=revision+1`;
    await sql.end();
  }
});
