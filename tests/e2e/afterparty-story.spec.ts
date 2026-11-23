import { expect, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";
import { sampleFold } from "./sample-fold";

test("turns the six illustrated scenes on the afterparty home itself", async ({ page, browserName }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await fixture(page, undefined, { phase: "COMPLETED" });
  await page.goto("/#/afterparty");
  const story = page.getByRole("region", { name: "혜성식품 업무 이야기" });
  const next = story.getByRole("button", { name: "다음 장면" });
  const previous = story.getByRole("button", { name: "이전 장면" });
  await story.scrollIntoViewIfNeeded();
  async function frame(direction: "next" | "previous", oldTitle: string, newTitle: string) {
    const moving =
      direction === "next" ? ".work-story-spread > .turn-window" : ".work-story-spread > .work-story-sheet";
    const geometry = await sampleFold(page, moving, direction);
    expect(geometry.hinge).toBeCloseTo(0);
    expect(geometry.closing).toBe(direction === "previous");
    expect(geometry.depth, "the illustrated page lifts toward the reader").toBeGreaterThan(0);
    await expect(story.getByRole("heading", { name: newTitle, exact: true })).toBeVisible();
    const old = story.locator(".turn-window");
    await expect(old).toHaveAttribute("aria-hidden", "true");
    await expect(old).toContainText(oldTitle);
    if (direction === "previous") await expect(old).toHaveCSS("transform", "none");
    await expect(old.locator("canvas")).not.toHaveCount(0);
    await expect(next).toBeEnabled();
    await story.screenshot({
      path: `artifacts/screens/afterparty-story/${browserName}-scene-${direction}.png`,
    });
    await story.locator(moving).evaluate((el) => el.getAnimations()[0]?.finish());
    await expect(old).toHaveCount(0);
  }
  // The first change is the existing automatic advance, without leaving this route.
  await frame("next", "연구개발팀", "경영관리팀");
  await story.getByRole("button", { name: "이야기 일시 정지" }).click();
  await previous.click();
  await frame("previous", "경영관리팀", "연구개발팀");
  const image = story.locator("img.work-story-image");
  await image.dispatchEvent("pointerdown", {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: 210,
    clientY: 100,
  });
  await image.dispatchEvent("pointerup", {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: 50,
    clientY: 100,
  });
  await expect(story).toHaveAttribute("data-scene", "2");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(story.locator(".turn-window")).toHaveCount(0);
  await next.click();
  await expect(story).toHaveAttribute("data-scene", "3");
  expect(await story.locator(".work-story-sheet").evaluate((el) => el.getAnimations().length)).toBe(0);
  await expect(page).toHaveURL(/#\/afterparty$/);
});

test("a chapter opened during a scene return carries the full illustration", async ({ page }) => {
  await fixture(page, undefined, { phase: "COMPLETED" });
  await page.goto("/#/afterparty");
  const story = page.getByRole("region", { name: "혜성식품 업무 이야기" });
  await story.getByRole("button", { name: "이야기 일시 정지" }).click();
  await story.getByRole("button", { name: "다음 장면" }).click();
  await expect(story.locator(".turn-window")).toHaveCount(0);
  await story.getByRole("button", { name: "이전 장면" }).click();
  await sampleFold(page, ".work-story-spread > .work-story-sheet", "previous");
  await page
    .getByRole("navigation", { name: "자유 관람 콘텐츠" })
    .getByRole("link", { name: "이야기 트리" })
    .click();
  await sampleFold(page, ".book-frame > .turn-window", "next");
  const captured = page.locator(".book-frame > .turn-window .work-story-sheet");
  await expect(captured).toHaveCSS("transform", "none");
  await expect(captured.locator("canvas")).not.toHaveCount(0);
});

test("a scene changed during the return home uses the flat page width", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 1150 });
  await fixture(page, undefined, { phase: "COMPLETED" });
  await page.goto("/#/afterparty");
  const menu = page.getByRole("navigation", { name: "내 행사 메뉴" });
  await menu.getByRole("link", { name: "인물 카드" }).click();
  await page.getByRole("link", { name: "자유 관람 홈으로" }).click();
  await sampleFold(page, ".book-frame > .book-surface", "previous");
  const story = page.getByRole("region", { name: "혜성식품 업무 이야기" });
  await story.getByRole("button", { name: "이전 장면" }).click();
  await sampleFold(page, ".work-story-spread > .work-story-sheet", "previous");
  const spread = story.locator(".work-story-spread");
  const frozen = spread.locator(":scope > .turn-window");
  expect(await frozen.evaluate((el) => el.clientWidth)).toBe(await spread.evaluate((el) => el.clientWidth));
  await expect(page.locator(".book-frame > .turn-window")).toHaveCount(0);
});

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
  await expect(story.locator(".turn-window")).toHaveCount(0);
});

test("rapid wraparound and site motion settings keep exactly one readable scene", async ({ page }) => {
  await fixture(page, undefined, { phase: "COMPLETED" });
  await page.goto("/#/afterparty");
  const story = page.getByRole("region", { name: "혜성식품 업무 이야기" });
  await story.getByLabel("이야기 일시 정지").click();
  const previous = story.getByRole("button", { name: "이전 장면" });
  const next = story.getByRole("button", { name: "다음 장면" });
  await previous.click();
  await expect(story).toHaveAttribute("data-scene", "6");
  await next.click();
  await expect(story).toHaveAttribute("data-scene", "1");
  await expect(story.getByRole("heading")).toHaveText("연구개발팀");
  await expect(story.locator(".turn-window")).toHaveCount(0);
  await page.locator(".book-settings summary").click();
  await page.getByLabel("페이지 효과 끄기").check();
  await next.click();
  await expect(story.getByRole("heading")).toHaveText("경영관리팀");
  expect(await story.locator(".work-story-sheet").evaluate((el) => el.getAnimations().length)).toBe(0);
  await expect(story.locator(".turn-window")).toHaveCount(0);
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
