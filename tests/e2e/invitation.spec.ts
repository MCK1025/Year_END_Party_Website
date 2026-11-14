import { expect, test } from "@playwright/test";

test("first visit, animated reading, departure, same-tab return and explicit replay", async ({ page }) => {
  const errors: string[] = [];
  const api: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/auth\/|\/functions\/|\/rest\//.test(r.url())) api.push(r.url());
  });
  await page.goto("/#/login");
  await expect(page).toHaveURL(/#\/invite$/);
  await expect(page.getByRole("button", { name: "바로 입장하기" })).toBeVisible();
  await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "reading", { timeout: 12000 });
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "webgl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "한 걸음 더 가까워진, 그리고 가까워질 우리.",
  );
  expect(api).toEqual([]);
  const canvas = page.locator("canvas");
  const still = await canvas.screenshot();
  await page.waitForTimeout(200); // Observe that reading produces no additional rendered movement.
  expect(await canvas.screenshot()).toEqual(still);
  await page.getByRole("button", { name: "행사장으로 가기" }).click();
  await expect(page).toHaveURL(/#\/login$/, { timeout: 3000 });
  await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
  await expect(page.locator("#content")).toBeFocused();
  await page.reload();
  await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "초대장 다시 보기" }).click();
  await expect(page).toHaveURL(/#\/invite$/);
  await page.getByRole("button", { name: "바로 입장하기" }).click();
  await expect(page).toHaveURL(/#\/login$/);
  expect(errors).toEqual([]);
});

test("reduced motion, blocked storage, root and replay remain usable without loading the engine", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  const graphics: string[] = [];
  page.on("request", (r) => {
    if (/assets\/(invitation|service|christmas)-/.test(r.url())) graphics.push(r.url());
  });
  await page.goto("/");
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "static");
  await page.getByRole("button", { name: "행사장으로 가기" }).click();
  await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
  await page.goto("/#/invite");
  await page.getByRole("button", { name: "바로 입장하기" }).click();
  await expect(page).toHaveURL(/#\/login$/);
  expect(graphics).toEqual([]);
});

test("late preparation cannot restart static mode; direct admin is ungated", async ({ page }) => {
  await page.route(/assets\/invitation-.*\.js/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2600));
    await route.continue();
  });
  await page.goto("/#/invite");
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "static", { timeout: 4000 });
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "reading");
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "행사장으로 가기" }).click();
  await expect(page).toHaveURL(/#\/login$/);
  await page.goto("/#/admin");
  await expect(page.getByLabel("관리자 이메일")).toBeVisible();
  await expect(page.locator(".invite-page")).toHaveCount(0);
});

test("context loss and changed motion preference preserve the full letter", async ({ page }) => {
  await page.goto("/#/invite");
  await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "reading", { timeout: 12000 });
  await page.locator("canvas").evaluate((canvas) => {
    if (canvas instanceof HTMLCanvasElement)
      canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "static");
  await expect(page.getByRole("button", { name: "행사장으로 가기" })).toBeVisible();
  await page.reload();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "static");
  await page.getByRole("button", { name: "행사장으로 가기" }).click();
  await expect(page).toHaveURL(/#\/login$/);
});
