import { expect, type Page, test } from "@playwright/test";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { admin, boot, call, dashboard, employee, env, signAdmin } from "../integration/helpers";
import { localDatabase } from "./local-db";

test("rescheduling reopens selected employee forms live and closes them at the new start", async ({
  browser,
  page,
  baseURL,
}) => {
  if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1") throw new Error("Local preview required");
  await signAdmin();
  const sql = localDatabase();
  const original = (await dashboard()).settings;
  const guests: Page[] = [];
  try {
    await sql`update private.settings set started_at=null,enabled=true,survey_open=true,nomination_open=true where id`;
    const seed = await employee(0);
    const fixture = await boot(seed);
    const nominee = fixture.directory.find((person) => person.id !== fixture.self.id);
    if (!nominee) throw new Error("Missing local nominee");
    await call(
      seed,
      {
        action: "save_survey",
        payload: {
          answers: Object.fromEntries(
            fixture.questions.map((q) => [q.id, q.choices[0] ?? `가상 응답 ${q.id}`]),
          ),
          consent: true,
          excluded: [],
        },
      },
      okSchema,
    );
    await call(
      seed,
      {
        action: "nominate",
        payload: {
          nominee_id: nominee.id,
          reason: "처음 저장한 가상 직원의 추천입니다.",
        },
      },
      okSchema,
    );
    await seed.auth.signOut();
    await sql`update private.settings set started_at=now(),enabled=true,survey_open=false,
      nomination_open=false,event_start_at=now()-interval '1 hour' where id`;
    await sql`update public.event_public_state set phase='WAITING',payload='{}',tree_open=false,revision=revision+1 where id`;
    for (const route of ["/survey", "/nominate"]) {
      const client = await employee(0);
      const data = await boot(client);
      const session = (await client.auth.getSession()).data.session;
      if (!session || !data.survey || !data.nomination) throw new Error("Missing saved local fixture");
      const guest = await browser.newPage({
        baseURL,
        viewport: { width: 375, height: 812 },
        reducedMotion: "reduce",
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
      await guest.goto(`/#${route}`);
      await expect(guest.locator(".book-status")).toContainText("실시간 연결됨");
    }
    const [surveyPage, nominationPage] = guests;
    if (!surveyPage || !nominationPage) throw new Error("Missing employee pages");
    await expect(surveyPage.getByRole("button", { name: "이야기 저장하고 다음으로" })).toBeDisabled();
    await expect(nominationPage.getByRole("button", { name: "추천 수정하기" })).toHaveCount(0);

    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/#/admin");
    await page.getByLabel("관리자 이메일").fill(env.ADMIN_EMAIL);
    await page.getByLabel("비밀번호", { exact: true }).fill(env.ADMIN_PASSWORD);
    await page.getByRole("button", { name: "운영 화면으로" }).click();
    await page.getByRole("button", { name: "설정·내보내기" }).click();
    const surveyToggle = page.getByLabel("설문 수정 허용");
    const nominationToggle = page.getByLabel("동료 추천·변경 허용");
    await expect(surveyToggle).toBeDisabled();
    await page.getByRole("button", { name: "설정 저장" }).focus();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "artifacts/screens/reschedule/admin-closed-375.png", fullPage: true });
    await page.getByLabel("행사일", { exact: true }).fill("2027-01-02");
    await page.getByLabel("행사 시작 시각 (한국시간)").fill("00:07");
    await expect(surveyToggle).toBeEnabled();
    await surveyToggle.check();
    await nominationToggle.check();
    await page.getByRole("button", { name: "설정 저장" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
    await expect(page.locator("form").getByRole("status").last()).toContainText("저장했습니다");
    // Both already-open pages update without waiting for the 20-second polling fallback.
    await expect(surveyPage.getByRole("button", { name: "이야기 저장하고 다음으로" })).toBeEnabled({
      timeout: 10000,
    });
    await expect(nominationPage.getByRole("button", { name: "추천 수정하기" })).toBeVisible({
      timeout: 10000,
    });
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("button", { name: "설정 저장" }).focus();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `artifacts/screens/reschedule/admin-${width}.png`, fullPage: true });
    }
    await page.getByRole("button", { name: "실시간 진행", exact: true }).click();
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("button", { name: "새로고침", exact: true }).focus();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `artifacts/screens/reschedule/progress-${width}.png`, fullPage: true });
      await page.getByRole("button", { name: "처음부터 다시 진행", exact: true }).click();
      await page.screenshot({ path: `artifacts/screens/reschedule/restart-${width}.png` });
      await page.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
    }
    const field = surveyPage.locator("textarea").first();
    await field.fill("다시 열린 설문에 남긴 가상 직원의 이야기");
    await surveyPage.screenshot({ path: "artifacts/screens/reschedule/survey-open-375.png" });
    await surveyPage.getByRole("button", { name: "이야기 저장하고 다음으로" }).click();
    await expect(surveyPage).toHaveURL(/#\/nominate$/);
    await nominationPage.getByRole("button", { name: "추천 수정하기" }).click();
    await nominationPage
      .getByLabel("고마운 이유 (10자 이상)")
      .fill("일정을 변경한 뒤 다시 전하는 고마운 마음입니다.");
    await nominationPage.screenshot({ path: "artifacts/screens/reschedule/nomination-open-375.png" });
    await nominationPage.getByRole("button", { name: "추천 수정 저장" }).click();
    await expect(
      nominationPage.getByText("일정을 변경한 뒤 다시 전하는 고마운 마음입니다.", { exact: true }),
    ).toBeVisible();
    await surveyPage.goto("/#/survey");
    await expect(surveyPage.locator("textarea").first()).toHaveValue(
      "다시 열린 설문에 남긴 가상 직원의 이야기",
    );
    await nominationPage.reload();
    await expect(nominationPage.getByRole("button", { name: "추천 수정하기" })).toBeVisible();

    // A short real server deadline proves active forms relock without a new admin action.
    const current = (await dashboard()).settings;
    await call(
      admin,
      {
        action: "settings",
        payload: { ...current, event_start_at: new Date(Date.now() + 8000).toISOString() },
      },
      okSchema,
    );
    await nominationPage.getByRole("button", { name: "추천 수정하기" }).click();
    await expect(surveyPage.getByRole("button", { name: "이야기 저장하고 다음으로" })).toBeDisabled({
      timeout: 15000,
    });
    await expect(nominationPage.getByRole("button", { name: "추천 수정하기" })).toHaveCount(0);
    await surveyPage.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
    await surveyPage.screenshot({ path: "artifacts/screens/reschedule/survey-closed-375.png" });
    await nominationPage.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
    await nominationPage.screenshot({ path: "artifacts/screens/reschedule/nomination-closed-375.png" });
  } finally {
    for (const guest of guests) await guest.close();
    await sql`update private.settings set started_at=${original.started_at} where id`;
    await call(
      admin,
      { action: "settings", payload: { ...original, survey_open: false, nomination_open: false } },
      okSchema,
    );
    await sql.end();
  }
});
