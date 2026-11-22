import { expect, type Page, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";

async function completedHome(page: Page, reducedMotion: "reduce" | "no-preference" = "reduce") {
  await page.emulateMedia({ reducedMotion });
  await fixture(page, { revision: 1, paused: false }, { phase: "COMPLETED", treeOpen: true });
  await page.route("**/functions/v1/portal", (route) => {
    switch (route.request().postDataJSON().action) {
      case "taste_cards":
        return route.fulfill({ json: { revision: 1, cards: [] } });
      case "forest_tree":
        return route.fulfill({
          json: { total: 1, notes: [{ id: 1, kind: "thanks", body: "가상의 이야기", day: "2026-11-22" }] },
        });
      default:
        return route.fallback();
    }
  });
  await page.goto("/#/event");
  await expect(page).toHaveURL(/#\/afterparty$/);
}

test("turns the actual free-browsing page in both directions, including browser back", async ({
  page,
  browserName,
}) => {
  await completedHome(page, "no-preference");
  const paper = page.locator(".book-frame > .book-surface");
  const sample = async (direction: "next" | "previous") => {
    const snapshot = await page.waitForFunction((dir) => {
      const el = document.querySelector(".book-frame > .book-surface");
      const turn = el?.getAnimations().find((a) => a.id === `browse-turn-${dir}`);
      if (!el || !turn) return false;
      turn.pause();
      turn.currentTime = 85;
      return getComputedStyle(el).transform;
    }, direction);
    expect(await snapshot.jsonValue()).toMatch(/^matrix3d/);
  };
  await page.locator(".afterparty-link[href='#/tree']").click();
  await expect(page).toHaveURL(/#\/tree$/);
  await sample("next");
  await page.screenshot({ path: `artifacts/screens/free-browse-turn/${browserName}-tree.png` });
  await page
    .locator(".book-pager")
    .getByRole("link", { name: /다음 장/ })
    .click();
  await expect(page).toHaveURL(/#\/cards$/);
  await sample("next");
  await page.goBack();
  await expect(page).toHaveURL(/#\/tree$/);
  await sample("previous");
  await paper.evaluate((el) => {
    for (const a of el.getAnimations()) a.finish();
  });
  await page.getByRole("link", { name: "자유 관람 홈으로" }).click();
  await expect(page).toHaveURL(/#\/afterparty$/);
  await sample("previous");
  await page.screenshot({ path: `artifacts/screens/free-browse-turn/${browserName}-home.png` });
  await page.locator("details.book-settings summary").click();
  await page.getByLabel("페이지 효과 끄기").check();
  await expect.poll(() => paper.evaluate((el) => el.getAnimations().length)).toBe(0);
  await page.locator(".afterparty-link[href='#/cards']").click();
  await expect(page).toHaveURL(/#\/cards$/);
  expect(await paper.evaluate((el) => el.getAnimations().length)).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByLabel("페이지 효과 끄기").uncheck();
  await page.getByRole("link", { name: "자유 관람 홈으로" }).click();
  await expect(page).toHaveURL(/#\/afterparty$/);
  expect(await paper.evaluate((el) => el.getAnimations().length)).toBe(0);
});

test("a consecutive click on a different free-browsing destination must not be discarded", async ({
  page,
}) => {
  await completedHome(page);
  await page
    .getByRole("navigation", { name: "자유 관람 콘텐츠" })
    .getByRole("link", { name: "이야기 트리", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/tree$/);
  await page.getByRole("link", { name: "자유 관람 홈으로", exact: true }).click();
  await expect(page).toHaveURL(/#\/afterparty$/);
  await page.getByRole("link", { name: /혜성식품 인물 카드/ }).dispatchEvent("click", {
    button: 0,
    detail: 2,
  });
  await expect(page).toHaveURL(/#\/cards$/);
  await expect(page.getByText(/공개된 인물 카드가 아직 없습니다/)).toBeVisible();
});

test("touch users can quickly move between the large tree and card links", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("Missing preview address");
  const page = await browser.newPage({
    baseURL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 660 },
  });
  try {
    await completedHome(page);
    for (const destination of ["tree", "cards", "tree", "cards"]) {
      const link = page.locator(`.afterparty-link[href="#/${destination}"]`);
      await link.scrollIntoViewIfNeeded();
      const box = await link.boundingBox();
      if (!box) throw new Error("Missing visible free-browsing link");
      await page.touchscreen.tap(box.x + 12, box.y + 12);
      await expect(page).toHaveURL(new RegExp(`#/${destination}$`));
      await page.getByRole("link", { name: "자유 관람 홈으로", exact: true }).tap();
      await expect(page).toHaveURL(/#\/afterparty$/);
    }
  } finally {
    await page.context().close();
  }
});
