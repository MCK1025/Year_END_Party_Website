import { expect, type Page, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";
import { recapFixture } from "./recap-fixture";
import { sampleFold } from "./sample-fold";

async function openHome(page: Page) {
  const feed = await recapFixture(page, "COMPLETED");
  await page.goto("/#/afterparty");
  const album = page.getByRole("region", { name: "1년 회고", exact: true });
  await expect(album).toBeVisible();
  await expect(page.locator(".work-story")).toHaveCount(0);
  return { album, feed };
}

test("the completed home autoplays, pauses and allows buttons and swiping while paused", async ({
  page,
  browserName,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const { album } = await openHome(page);
  const links = page.getByRole("navigation", { name: "자유 관람 콘텐츠" });
  await expect(links.getByRole("link", { name: "이야기 트리" })).toBeInViewport();
  await expect(links.getByRole("link", { name: "혜성식품 인물 카드" })).toBeInViewport();
  await album.getByRole("button", { name: "오프닝 건너뛰기" }).click();
  await expect(album.getByRole("img", { name: "테스트 장 1" })).toBeVisible();
  await expect(album.getByRole("heading", { name: "사진 1" })).toBeVisible({ timeout: 12000 });
  await expect(album.locator(".album-controls")).toContainText("2 / 4");
  await album.getByRole("button", { name: "회고 자동 재생 일시 정지" }).click();
  await page.clock.install();
  await page.clock.fastForward(20000);
  await expect(album.locator(".album-controls")).toContainText("2 / 4");
  await album.getByRole("button", { name: /다음/ }).click();
  await expect(album.locator(".album-controls")).toContainText("3 / 4");
  const stage = album.locator(".album-stage");
  await stage.dispatchEvent("pointerdown", {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: 70,
    clientY: 140,
  });
  await stage.dispatchEvent("pointerup", {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: 270,
    clientY: 142,
  });
  await expect(album.locator(".album-controls")).toContainText("2 / 4");
  await expect(album.locator(".turn-window")).toHaveCount(0);
  await album.getByRole("button", { name: "회고 자동 재생 시작" }).click();
  for (const number of [3, 4, 1]) {
    await expect(album.locator(".album-controls")).toContainText(`${number} / 4`, { timeout: 12000 });
  }
  await expect(album.locator(".turn-window")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/screens/afterparty-album/${browserName}-home.png`,
    fullPage: true,
  });
});

test("reduced motion starts in manual mode and explicit autoplay advances without a fold", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  const { album } = await openHome(page);
  const start = album.getByRole("button", { name: "회고 자동 재생 시작" });
  await expect(start).toBeVisible();
  await page.clock.fastForward(15000);
  await expect(album.locator(".album-controls")).toContainText("1 / 4");
  await start.click();
  await page.clock.fastForward(6100);
  await expect(album.locator(".album-controls")).toContainText("2 / 4");
  await expect(album.locator(".turn-window")).toHaveCount(0);
  await album.getByRole("button", { name: "회고 자동 재생 일시 정지" }).click();
  await page.reload();
  await expect(start).toBeVisible();
});

test("keyboard readers keep their place until they leave the caption", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  const { album } = await openHome(page);
  const start = album.getByRole("button", { name: "회고 자동 재생 시작" });
  await start.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  const caption = album.getByRole("region", { name: "장면 설명" });
  await expect(caption).toBeFocused();
  await page.clock.fastForward(15000);
  await expect(caption).toBeFocused();
  await expect(album.locator(".album-controls")).toContainText("1 / 4");
  await page.keyboard.press("Shift+Tab");
  await expect(album.getByRole("button", { name: "회고 자동 재생 일시 정지" })).toBeFocused();
  await expect(album.locator(".album-controls")).toContainText("2 / 4", { timeout: 12000 });
});

test("leaving during an album turn and returning restores the photo and flat geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 1150 });
  const { album } = await openHome(page);
  await album.getByRole("button", { name: "오프닝 건너뛰기" }).click();
  await album.getByRole("button", { name: /다음/ }).click();
  await expect(album.locator(".turn-window")).toHaveCount(0);
  await album.getByRole("button", { name: /이전/ }).click();
  await sampleFold(page, ".album-volume > .album-page", "previous");
  const albumHeight = await album.evaluate((el) => el.clientHeight);
  const menu = page.getByRole("navigation", { name: "내 행사 메뉴" });
  await menu.getByRole("link", { name: "인물 카드" }).click();
  await sampleFold(page, ".book-frame > .turn-window", "next");
  const captured = page.locator(".book-frame > .turn-window .album-page");
  expect(
    await page.locator(".book-frame > .turn-window .recap-album").evaluate((el) => el.clientHeight),
  ).toBe(albumHeight);
  await expect(captured).toHaveCSS("transform", "none");
  await expect(captured.locator("canvas")).not.toHaveCount(0);
  await menu.getByRole("link", { name: "자유 관람 홈" }).click();
  await expect(album.locator(".album-hardback")).toHaveCount(0);
  await expect(album.getByRole("img", { name: "테스트 장 1" })).toBeVisible();
});

test("revoking the last published Moment removes its photos and in-flight page", async ({ page }) => {
  const { album, feed } = await openHome(page);
  await album.getByRole("button", { name: "오프닝 건너뛰기" }).click();
  await album.getByRole("button", { name: /다음/ }).click();
  await sampleFold(page, ".album-volume > .turn-window", "next");
  await feed.refresh([]);
  await expect(page.getByText("공개된 회고 장면이 아직 없습니다.")).toBeVisible();
  await expect(album).toHaveCount(0);
  await expect(page.locator(".turn-window")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "자유 관람 콘텐츠" }).getByRole("link")).toHaveCount(2);
});

test("the live waiting room still shows the six work scenes", async ({ page }) => {
  await fixture(page, undefined, { phase: "WAITING" });
  await page.goto("/#/event");
  await expect(page.getByRole("region", { name: "혜성식품 업무 이야기" })).toBeVisible();
  await expect(page.getByRole("region", { name: "1년 회고", exact: true })).toHaveCount(0);
});
