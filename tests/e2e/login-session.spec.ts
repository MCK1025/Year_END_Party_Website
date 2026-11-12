import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { env } from "../integration/helpers";

const sql = postgres(env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres");

async function capture(page: Page, state: string) {
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async () => {
      window.scrollTo(0, 0);
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/screens/login-session/${state}-${width}.png`, fullPage: true });
  }
}
async function login(page: Page, password: string) {
  await page.goto("/#/login");
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "우리의 자리로" }).click();
}
test.beforeAll(async () => {
  await sql`update private.settings set started_at=null,enabled=true,survey_open=true where id`;
  await sql`update public.event_public_state set phase='WAITING',payload='{}',revision=revision+1 where id`;
  await sql`delete from private.login_attempts`;
});
test.afterAll(async () => {
  await sql`delete from private.login_attempts`;
  await sql.end();
});
test("allows a different employee after reopening login in the same browser", async ({ page, browser }) => {
  // Given: employee B works in a clean browser, and this browser was employee A.
  const fresh = await browser.newContext();
  const other = await fresh.newPage();
  await login(other, "910202");
  await expect(other.getByText("가상직원 둘 님", { exact: true })).toBeVisible();
  await fresh.close();
  await page.goto("/#/login");
  await capture(page, "login");
  await login(page, "900101");
  await expect(page.getByText("가상직원 하나 님", { exact: true })).toBeVisible();
  await capture(page, "employee-a");
  // When: reopen login without clicking logout, then enter B's valid password.
  await login(page, "910202");
  // Then: the previous binding cannot reject B or expose A's form.
  await expect(page.getByText("가상직원 둘 님", { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("가상직원 하나 님", { exact: true })).toHaveCount(0);
  await capture(page, "employee-b");
});
test("reuses an unverified session across wrong-password retries after switching", async ({ page }) => {
  // Given: exactly one verified synthetic employee session.
  let accounts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/auth/v1/signup") accounts++;
  });
  await login(page, "900101");
  await expect(page.getByText("가상직원 하나 님", { exact: true })).toBeVisible();
  // When: two invalid passwords followed by B's valid password.
  await login(page, "000000");
  await expect(page.getByRole("alert")).toBeVisible();
  await capture(page, "wrong-password");
  const afterFirstFailure = accounts;
  await page.getByRole("button", { name: "우리의 자리로" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "우리의 자리로" })).toBeEnabled();
  expect(accounts).toBe(afterFirstFailure);
  await page.getByLabel("비밀번호", { exact: true }).fill("910202");
  await page.getByRole("button", { name: "우리의 자리로" }).click();
  // Then: no anonymous account was created for each bad attempt.
  await expect(page.getByText("가상직원 둘 님", { exact: true })).toBeVisible({ timeout: 5000 });
  expect(accounts).toBe(2);
});
test("removes an old employee form in another tab when login identity changes", async ({ page, context }) => {
  // Given: A is editing a survey in one tab.
  await login(page, "900101");
  await page.getByRole("link", { name: "나의 이야기", exact: true }).click();
  await page.getByLabel("어릴 적 나의 꿈은?").fill("가상 이전 직원의 미저장 답변");
  const next = await context.newPage();
  // When: another tab signs in as B.
  await login(next, "910202");
  await expect(next.getByText("가상직원 둘 님", { exact: true })).toBeVisible({ timeout: 5000 });
  // Then: A's stale form cannot be submitted under B's credentials.
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByLabel("어릴 적 나의 꿈은?")).toHaveCount(0);
  await capture(page, "old-tab-cleared");
  await next.close();
});
test("keeps the existing session when the binding check cannot connect", async ({ page }) => {
  // Given: a verified A session and a temporary binding-query outage.
  let accounts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/auth/v1/signup") accounts++;
  });
  await login(page, "900101");
  await expect(page.getByText("가상직원 하나 님", { exact: true })).toBeVisible();
  await page.route("**/rest/v1/rpc/current_employee", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "PGRST000", message: "Synthetic outage" }),
    }),
  );
  // When: B attempts to log in while the binding check fails.
  await login(page, "910202");
  await expect(page.getByRole("alert")).toContainText("로그인 연결");
  await capture(page, "connection-error");
  // Then: the failed query does not silently discard A or create new Auth accounts.
  expect(accounts).toBe(1);
  await page.unroute("**/rest/v1/rpc/current_employee");
  await page.getByRole("button", { name: "우리의 자리로" }).click();
  await expect(page.getByText("가상직원 둘 님", { exact: true })).toBeVisible();
  expect(accounts).toBe(2);
});
