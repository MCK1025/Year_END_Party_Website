import { expect, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";

test("a visible invitation still reaches reading when no animation frame arrives", async ({ page }) => {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 1;
  });
  await page.goto("/?motionDebug=1#/invite", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "reading", { timeout: 7500 });
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "simple");
  // Direct DOM activation keeps Playwright's own frame-based actionability out of this no-frame fixture.
  await page
    .locator(".book-settings summary")
    .first()
    .evaluate((el) => el instanceof HTMLElement && el.click());
  await page.locator(".motion-diagnostics summary").evaluate((el) => el instanceof HTMLElement && el.click());
  await expect(page.locator(".motion-diagnostics")).toContainText("FIRST_FRAME_TIMEOUT");
});
test("a height-only resize does not cancel a user page turn", async ({ page }) => {
  await fixture(page);
  await page.goto("/?motionDebug=1#/survey");
  await page.getByRole("link", { name: /다음 장/ }).click();
  await expect(page.locator(".curl-stage")).toHaveAttribute("data-turn", "forward");
  await page.setViewportSize({ width: 390, height: 720 });
  await expect(page.locator(".curl-stage")).toHaveAttribute("data-mode", /webgl|dom/);
  const result = await page.locator(".curl-stage").evaluate((leaf) => {
    const before = leaf.getAnimations({ subtree: true })[0]?.playState;
    window.dispatchEvent(new Event("resize"));
    return [before, leaf.getAnimations({ subtree: true })[0]?.playState];
  });
  expect(result).toEqual(["running", "running"]);
});
