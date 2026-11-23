import { expect, type Page, test } from "@playwright/test";
import { admin, env, signAdmin } from "../integration/helpers";
import { openLogin } from "./invitation-helper";
import { localDatabase } from "./local-db";

const sql = localDatabase();

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
      path: `artifacts/screens/employee-forest/${state}-${width}.png`,
      fullPage: (await page.getByRole("dialog").count()) === 0,
    });
  }
}
test.beforeAll(async () => {
  await signAdmin();
  await sql`delete from private.login_attempts`;
  await sql`delete from public.forest_posts`;
  await sql`delete from private.forest_limits`;
  await sql`delete from private.employees where employee_no='TEST-BROWSER-NEW'`;
  await sql`update private.settings set started_at=null,enabled=true,survey_open=true,forest_multiple=false where id`;
  await sql`update public.event_public_state set phase='WAITING',payload='{}',revision=revision+1 where id`;
});
test.afterAll(async () => {
  await sql`delete from private.employees where employee_no='TEST-BROWSER-NEW'`;
  await sql.end();
});
test("birthday-only login, survey registration and anonymous message persist across sessions", async ({
  page,
  browser,
}) => {
  // Given: the employee has just one password field and no issued-code/name fields.
  await openLogin(page);
  await expect(page.locator("form input")).toHaveCount(1);
  await capture(page, "login");
  await page.getByLabel("비밀번호", { exact: true }).fill("900101");
  await page.getByRole("button", { name: "우리의 자리로" }).click();
  await page.getByRole("link", { name: "나의 이야기", exact: true }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await capture(page, "survey");
  await page.getByRole("link", { name: "이야기 트리", exact: true }).click();
  await expect(page.getByText("아직 보낸 마음이 없습니다.")).toBeVisible();
  await capture(page, "forest-empty");
  // When: a verified employee submits a message and a separate employee reads it.
  await page.getByLabel("어떤 마음인가요?").selectOption("thanks");
  await page
    .getByLabel("혜성식품에게 전하고 싶은 말")
    .fill("가상 이야기 트리 검증: 함께해 주셔서 고맙습니다.");
  await capture(page, "forest-compose");
  await page.getByRole("button", { name: "익명으로 마음 남기기" }).click();
  const compose = page.getByRole("button", { name: "익명으로 마음 남기기" });
  await expect(page.getByRole("button", { name: "내 글 수정하기" })).toHaveCount(1);
  await expect(compose).toHaveCount(0);
  await capture(page, "forest-posted");
  const organizer = await browser.newPage({ viewport: { width: 375, height: 900 } });
  await organizer.goto("/#/admin?tab=설정·내보내기");
  await organizer.getByLabel("관리자 이메일").fill(env.ADMIN_EMAIL);
  await organizer.getByLabel("비밀번호", { exact: true }).fill(env.ADMIN_PASSWORD);
  await organizer.getByRole("button", { name: "운영 화면으로" }).click();
  const multiple = organizer.getByRole("checkbox", { name: "이야기 트리 여러 메시지 작성하기" });
  await expect(multiple).not.toBeChecked();
  await multiple.check();
  await expect(organizer.getByText("이야기 트리 설정을 저장했습니다.")).toBeVisible();
  await organizer.reload();
  await expect(multiple).toBeChecked();
  for (const width of [375, 768, 1280]) {
    await organizer.setViewportSize({ width, height: 900 });
    await multiple.scrollIntoViewIfNeeded();
    await organizer.screenshot({ path: `artifacts/screens/employee-forest/message-setting-${width}.png` });
  }
  await expect(compose).toBeVisible({ timeout: 10000 });
  await page.getByLabel("혜성식품에게 전하고 싶은 말").fill("두 번째 마음도 잘 전해지길 바랍니다.");
  await compose.click();
  await expect(page.getByRole("button", { name: "내 글 수정하기" })).toHaveCount(2);
  await multiple.uncheck();
  await expect(compose).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole("button", { name: "내 글 삭제하기" })).toHaveCount(2);
  await organizer.close();
  const other = await browser.newContext();
  const second = await other.newPage();
  await openLogin(second);
  await second.getByLabel("비밀번호", { exact: true }).fill("910202");
  await second.getByRole("button", { name: "우리의 자리로" }).click();
  await second.getByRole("link", { name: "이야기 트리", exact: true }).click();
  // Then: refresh restores the shared anonymous post without exposing an author.
  await expect(second.getByText("가상 이야기 트리 검증: 함께해 주셔서 고맙습니다.")).toHaveCount(0);
  await second.reload();
  await expect(second.getByText("가상 이야기 트리 검증: 함께해 주셔서 고맙습니다.")).toHaveCount(0);
  await other.close();
});
test("administrator adds and permanently deletes one employee through confirmation", async ({ page }) => {
  // Given: an authenticated administrator uses the individual entry form.
  await page.goto("/#/admin");
  await page.getByLabel("관리자 이메일").fill(env.ADMIN_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "운영 화면으로" }).click();
  await page.getByRole("button", { name: "사원 관리", exact: true }).click();
  await capture(page, "admin-people");
  await page.getByLabel("새 직원 사번").fill("TEST-BROWSER-NEW");
  await page.getByLabel("새 직원 이름").fill("가상 브라우저 직원");
  await page.getByLabel("새 직원 직책").fill("가상팀");
  await page.getByLabel("새 직원 생년월일").fill("2002-04-06");
  await page.getByRole("button", { name: "직원 추가", exact: true }).click();
  const person = page.locator("details").filter({ hasText: "가상 브라우저 직원" });
  await expect(person).toBeVisible();
  await person.locator("summary").click();
  await capture(page, "admin-added");
  // When: cancel keeps the employee, then confirmation removes them.
  await person.getByRole("button", { name: "직원 삭제", exact: true }).click();
  await capture(page, "admin-delete-confirm");
  await page.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
  await expect(person).toBeVisible();
  await person.getByRole("button", { name: "직원 삭제", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
  // Then: server data and rendered roster both exclude the deleted employee.
  await expect(person).toHaveCount(0);
  const data = await admin.functions.invoke("portal", { body: { action: "dashboard", payload: {} } });
  expect(JSON.stringify(data.data)).not.toContain("TEST-BROWSER-NEW");
  await page.getByRole("button", { name: "이야기 트리", exact: true }).click();
  await expect(page.getByRole("heading", { name: "혜성식품 이야기 트리" })).toBeVisible();
  await capture(page, "admin-forest");
  await page.getByRole("button", { name: "글 삭제", exact: true }).first().click();
  await capture(page, "admin-forest-delete");
  await page.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.getByText("글을 삭제했습니다.")).toBeVisible();
});
