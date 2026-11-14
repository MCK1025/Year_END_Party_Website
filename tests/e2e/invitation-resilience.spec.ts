import { expect, test } from "@playwright/test";

for (const phase of ["preparing", "arriving", "opening", "reading"]) {
  test(`skip during ${phase} leaves no canvas or late navigation`, async ({ page }) => {
    if (phase === "preparing") await page.route(/assets\/invitation-.*\.js/, (route) => route.abort());
    await page.goto("/#/invite");
    if (phase !== "preparing")
      await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", phase);
    await page.getByRole("button", { name: "바로 입장하기" }).click();
    await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page).toHaveURL(/#\/login$/);
  });
}

for (const failure of ["creation", "shader"]) {
  test(`graphics ${failure} failure presents an actionable static invitation`, async ({ page }) => {
    await page.addInitScript((kind) => {
      if (kind === "creation")
        Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: () => null });
      else
        WebGL2RenderingContext.prototype.compileShader = () => {
          throw new Error("Synthetic shader failure");
        };
    }, failure);
    await page.goto("/#/invite");
    await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "static");
    await page.getByRole("button", { name: "행사장으로 가기" }).click();
    await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
  });
}

test("reading suspends draw calls, resize stays aligned, departure survives hidden tab and duplicate clicks", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      document.documentElement.dataset.draws = String(
        Number(document.documentElement.dataset.draws ?? 0) + 1,
      );
      return original.apply(this, args);
    };
  });
  await page.goto("/#/invite");
  await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "reading");
  const before = await page.locator("html").getAttribute("data-draws");
  await page.waitForTimeout(250); // Render-loop inactivity is a time-based contract.
  expect(await page.locator("html").getAttribute("data-draws")).toBe(before);
  await page.setViewportSize({ width: 768, height: 600 });
  await expect(page.getByRole("button", { name: "행사장으로 가기" })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByRole("button", { name: "행사장으로 가기" }).evaluate((button) => {
    if (button instanceof HTMLButtonElement) {
      button.click();
      button.click();
    }
  });
  await expect(page).toHaveURL(/#\/login$/, { timeout: 2500 });
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("small heights, 200 percent zoom and large text retain reachable controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("/#/invite");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await page.getByRole("button", { name: "행사장으로 가기" }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(async () => {
    scrollTo(0, 0);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.screenshot({ path: "artifacts/screens/invitation/zoom-200.png", fullPage: true });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "1";
    document.body.style.fontSize = "32px";
  });
  await page.setViewportSize({ width: 320, height: 480 });
  await page.getByRole("button", { name: "행사장으로 가기" }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(async () => {
    scrollTo(0, 0);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.screenshot({ path: "artifacts/screens/invitation/large-text.png", fullPage: true });
  await page.getByRole("button", { name: "행사장으로 가기" }).click();
  await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
});
