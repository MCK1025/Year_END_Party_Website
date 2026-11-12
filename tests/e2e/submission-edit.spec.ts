import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { command, dashboard, env, signAdmin } from "../integration/helpers";

const sql = postgres(env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55422/postgres");
async function capture(page: Page, state: string) {
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async () => {
      window.scrollTo(0, 0);
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({
      path: `artifacts/screens/submission-edit/${state}-${width}.png`,
      fullPage: (await page.getByRole("dialog").count()) === 0,
    });
  }
}
async function login(page: Page) {
  await page.goto("/#/login");
  await page.getByLabel("비밀번호", { exact: true }).fill("900101");
  await page.getByRole("button", { name: "우리의 자리로" }).click();
  await expect(page.getByRole("link", { name: "나의 이야기", exact: true })).toBeVisible();
}
test.beforeAll(async () => {
  await signAdmin();
  await sql`update private.settings set started_at=null,enabled=true,survey_open=true,nomination_open=true`;
  await command("waiting");
  await sql`delete from private.login_attempts`;
  await sql`delete from public.nominations`;
  await sql`delete from public.forest_posts`;
  await sql`delete from private.forest_limits`;
});
test.afterAll(async () => {
  await sql.end();
});

test("returning submissions, cross-device forest editing and live event lock", async ({ page, browser }) => {
  // Given: an employee submits a recommendation without a search field.
  await login(page);
  await page.getByRole("link", { name: "고마운 동료", exact: true }).click();
  await expect(page.getByLabel("이름·부서로 찾기")).toHaveCount(0);
  await capture(page, "nominate-new");
  const data = await dashboard();
  const colleague = data.employees.find((e) => e.employee_no === "TEST-002");
  const alternate = data.employees.find((e) => e.employee_no === "TEST-003");
  if (!colleague || !alternate) throw new Error("Missing local fixtures");
  await page.getByLabel("추천할 동료").selectOption(colleague.id);
  await page.getByLabel("고마운 이유 한 줄 (선택)").fill("가상 감사 원본");
  await page.getByRole("button", { name: "마음을 전하고 행사장으로" }).click();
  await page.waitForURL("**/#/event");
  await page.getByRole("link", { name: "고마운 동료", exact: true }).click();
  await expect(page.getByRole("heading", { name: "이미 추천하였습니다." })).toBeVisible();
  await capture(page, "nominate-saved");
  await page.getByRole("button", { name: "추천 수정하기" }).click();
  await page.getByLabel("추천할 동료").selectOption(alternate.id);
  await page.getByLabel("고마운 이유 한 줄 (선택)").fill("가상 감사 수정");
  await capture(page, "nominate-edit");
  await page.getByRole("button", { name: "추천 수정 저장" }).click();
  await expect(page.getByText("가상 감사 수정", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "이미 추천하였습니다." })).toBeVisible();
  expect((await dashboard()).nominations).toHaveLength(1);
  // When: the same employee signs in on another device, their anonymous post is editable there.
  await page.getByRole("link", { name: "대나무숲", exact: true }).click();
  await capture(page, "forest-empty");
  await page.getByLabel("혜성식품에게 전하고 싶은 말").fill("가상 내 글 원본");
  await page.getByRole("button", { name: "익명으로 마음 남기기" }).click();
  await expect(page.getByRole("button", { name: "내 글 수정하기" })).toBeVisible();
  await capture(page, "forest-mine");
  const device = await browser.newContext();
  const second = await device.newPage();
  await login(second);
  await second.getByRole("link", { name: "대나무숲", exact: true }).click();
  await expect(second.getByRole("button", { name: "내 글 수정하기" })).toBeVisible();
  await second.getByRole("button", { name: "내 글 수정하기" }).click();
  const editing = second
    .locator("section")
    .filter({ has: second.getByRole("button", { name: "내 글 수정 저장" }) });
  await editing.getByLabel("혜성식품에게 전하고 싶은 말").fill("가상 다른 기기에서 수정한 마음");
  await capture(second, "forest-edit");
  await editing.getByRole("button", { name: "내 글 수정 저장" }).click();
  await expect(second.getByText("가상 다른 기기에서 수정한 마음", { exact: true })).toBeVisible();
  await second.reload();
  await expect(second.getByText("가상 다른 기기에서 수정한 마음", { exact: true })).toBeVisible();
  await second.getByRole("button", { name: "모두의 마음" }).click();
  await capture(second, "forest-all");
  // Then: the organizer starts the event and every open device receives a durable read-only lock.
  const organizer = await browser.newPage();
  await organizer.goto("/#/admin");
  await organizer.getByLabel("관리자 이메일").fill(env.ADMIN_EMAIL);
  await organizer.getByLabel("비밀번호", { exact: true }).fill(env.ADMIN_PASSWORD);
  await organizer.getByRole("button", { name: "운영 화면으로" }).click();
  await expect(organizer.getByRole("button", { name: "행사 시작 · 응답 마감" })).toBeVisible();
  await capture(organizer, "admin-before-start");
  await organizer.getByRole("button", { name: "행사 시작 · 응답 마감" }).click();
  await capture(organizer, "admin-start-confirm");
  await organizer.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
  await expect(
    page.getByText("행사가 시작되어 작성과 수정이 마감되었습니다. 보낸 글은 계속 확인 가능합니다."),
  ).toBeVisible({ timeout: 10000 });
  await expect(second.getByRole("button", { name: "익명으로 마음 남기기" })).toHaveCount(0);
  await capture(page, "forest-locked");
  await capture(organizer, "admin-started");
  await command("waiting");
  await page.getByRole("link", { name: "고마운 동료", exact: true }).click();
  await expect(page.getByRole("button", { name: "추천 수정하기" })).toHaveCount(0);
  await capture(page, "nominate-locked");
  await page.getByRole("link", { name: "나의 이야기", exact: true }).click();
  await expect(page.getByRole("button", { name: "이야기 저장하고 다음으로" })).toBeDisabled();
  await capture(page, "survey-locked");
  await organizer.getByRole("button", { name: "설정·내보내기", exact: true }).click();
  await expect(organizer.getByLabel("동료 추천·변경 허용")).toBeDisabled();
  await capture(organizer, "admin-settings-locked");
  await organizer.getByRole("button", { name: "설문·추천", exact: true }).click();
  await expect(organizer.getByLabel("이름·부서 검색")).toHaveCount(0);
  await capture(organizer, "admin-data");
  await organizer.getByRole("button", { name: "사원 관리", exact: true }).click();
  await expect(organizer.getByLabel("이름·부서·사번 검색")).toHaveCount(0);
  await capture(organizer, "admin-people");
  const person = organizer.locator("details").first();
  await person.locator("summary").click();
  await person.getByRole("button", { name: "직원 삭제", exact: true }).click();
  await capture(organizer, "admin-employee-delete-confirm");
  await organizer.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
  await organizer.getByRole("button", { name: "대나무숲", exact: true }).click();
  await expect(organizer.getByText("가상 다른 기기에서 수정한 마음", { exact: true })).toBeVisible();
  await capture(organizer, "admin-forest");
  await device.close();
  await organizer.close();
});
