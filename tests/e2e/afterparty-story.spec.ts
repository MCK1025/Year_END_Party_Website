import { expect, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";

test("completed home keeps compact icon links side by side above the familiar story", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixture(page, undefined, { phase: "COMPLETED" });
  await page.goto("/#/event");
  await expect(page).toHaveURL(/#\/afterparty$/);
  const links = page.getByRole("navigation", { name: "자유 관람 콘텐츠" });
  await expect(links.getByRole("link")).toHaveCount(2);
  await expect(links.getByRole("link").nth(0)).toHaveText("이야기 트리");
  await expect(links.getByRole("link").nth(1)).toHaveText("혜성식품 인물 카드");
  const story = page.locator(".work-story");
  await expect(story).toHaveAttribute("data-static", "true");
  await expect(story.locator("canvas")).toHaveCount(0);
  await expect(story.getByRole("heading")).toHaveText("연구개발팀");
  await expect
    .poll(() =>
      story
        .locator("img.work-story-image")
        .evaluate((el) => el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0),
    )
    .toBe(true);
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const a = await links.getByRole("link").nth(0).boundingBox();
    const b = await links.getByRole("link").nth(1).boundingBox();
    if (!a || !b) throw new Error("Missing completed navigation");
    expect(Math.abs(a.y - b.y)).toBeLessThan(1);
    expect(a.x + a.width).toBeLessThan(b.x);
    expect(a.height).toBeGreaterThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/screens/afterparty-story/home-${width}.png`, fullPage: true });
  }
  await story.getByRole("button", { name: "다음 장면" }).click();
  await expect(story.getByRole("heading")).toHaveText("경영관리팀");
});

test("completed story plays, pauses and releases its animation when a card link opens", async ({ page }) => {
  await fixture(page, undefined, { phase: "COMPLETED" });
  await page.goto("/#/event");
  const story = page.locator(".work-story");
  await story.locator(".work-story-stage").scrollIntoViewIfNeeded();
  await expect(story.locator("canvas")).toHaveAttribute("data-ready", "true");
  await expect(story).toHaveAttribute("data-scene", "2", { timeout: 6500 });
  await story.getByLabel("이야기 일시 정지").click();
  await expect(story).toHaveAttribute("data-playing", "false");
  await page
    .getByRole("navigation", { name: "자유 관람 콘텐츠" })
    .getByRole("link", { name: "혜성식품 인물 카드" })
    .click();
  await expect(page).toHaveURL(/#\/cards$/);
  await expect(story).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "혜성식품 인물 카드", exact: true })).toBeVisible();
});
