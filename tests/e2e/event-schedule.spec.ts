import { expect, test } from "@playwright/test";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { admin, call, dashboard, env, signAdmin, sql } from "../integration/helpers";

test.use({ timezoneId: "America/Los_Angeles", viewport: { width: 375, height: 812 } });

test("after event start an organizer can save Korean schedule changes without reopening responses", async ({
  page,
}) => {
  await signAdmin();
  const original = (await dashboard()).settings;
  try {
    await sql`update private.settings set started_at=now(),survey_open=false,nomination_open=false where id`;
    await page.goto("/#/admin");
    await page.getByLabel("관리자 이메일").fill(env.ADMIN_EMAIL);
    await page.getByLabel("비밀번호", { exact: true }).fill(env.ADMIN_PASSWORD);
    await page.getByRole("button", { name: "운영 화면으로" }).click();
    const settings = page.getByRole("button", { name: "설정·내보내기" });
    await settings.click();
    await expect(page.getByLabel("설문 수정 허용")).toBeDisabled();
    await expect(page.getByLabel("동료 추천·변경 허용")).toBeDisabled();
    const date = page.getByLabel("행사일", { exact: true });
    const time = page.getByLabel("행사 시작 시각 (한국시간)", { exact: true });
    await date.fill("2027-01-02");
    await time.fill("00:07");
    let rejectSave = true;
    await page.route("**/functions/v1/portal", (route) => {
      if (route.request().postDataJSON().action === "settings" && rejectSave) {
        rejectSave = false;
        return route.fulfill({
          status: 503,
          json: { error: "일시적인 연결 오류입니다. 다시 저장해주세요." },
        });
      }
      return route.fallback();
    });
    await page.getByRole("button", { name: "설정 저장" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText(
      "일시적인 연결 오류입니다. 다시 저장해주세요.",
    );
    await page.getByRole("button", { name: "설정 저장" }).focus();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "artifacts/screens/event-schedule/save-error-375.png", fullPage: true });
    await expect(date).toHaveValue("2027-01-02");
    await expect(time).toHaveValue("00:07");
    expect((await dashboard()).settings.event_start_at).toBe(original.event_start_at);
    await page.getByRole("button", { name: "설정 저장" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
    await expect(
      page.locator("form").getByRole("status").filter({ hasText: "행사 일정과 설정을 저장했습니다." }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    const saved = (await dashboard()).settings;
    expect(saved.survey_open).toBe(false);
    expect(saved.nomination_open).toBe(false);
    expect(saved.started_at).toBeTruthy();
    expect(Date.parse(saved.event_start_at ?? "")).toBe(Date.parse("2027-01-01T15:07:00Z"));
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("button", { name: "설정 저장" }).focus();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `artifacts/screens/event-schedule/save-success-${width}.png`,
        fullPage: true,
      });
    }
    await page.reload();
    await settings.click();
    await expect(date).toHaveValue("2027-01-02");
    await expect(time).toHaveValue("00:07");
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("heading", { name: "행사 일정과 공개 범위" }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `artifacts/screens/event-schedule/locked-schedule-${width}.png` });
    }
  } finally {
    await sql`update private.settings set started_at=${original.started_at} where id`;
    await call(admin, { action: "settings", payload: original }, okSchema);
    await sql.end();
  }
});
