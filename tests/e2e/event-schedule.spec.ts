import { expect, test } from "@playwright/test";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { admin, call, dashboard, env, signAdmin } from "../integration/helpers";

test.use({ timezoneId: "America/Los_Angeles", viewport: { width: 375, height: 812 } });

test("an organizer can save and reload a Korean start time from a different time zone", async ({ page }) => {
  await signAdmin();
  const original = (await dashboard()).settings;
  try {
    await page.goto("/#/admin");
    await page.getByLabel("관리자 이메일").fill(env.ADMIN_EMAIL);
    await page.getByLabel("비밀번호", { exact: true }).fill(env.ADMIN_PASSWORD);
    await page.getByRole("button", { name: "운영 화면으로" }).click();
    const settings = page.getByRole("button", { name: "설정·내보내기" });
    await settings.click();
    const date = page.getByLabel("행사일", { exact: true });
    const time = page.getByLabel("행사 시작 시각 (한국시간)", { exact: true });
    await date.fill("2027-01-02");
    await time.fill("00:07");
    await page.getByRole("button", { name: "설정 저장" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
    await expect(page.getByText("완료했습니다.", { exact: true })).toBeVisible();
    expect(Date.parse((await dashboard()).settings.event_start_at ?? "")).toBe(
      Date.parse("2027-01-01T15:07:00Z"),
    );
    await page.reload();
    await settings.click();
    await expect(date).toHaveValue("2027-01-02");
    await expect(time).toHaveValue("00:07");
  } finally {
    await call(admin, { action: "settings", payload: original }, okSchema);
  }
});
