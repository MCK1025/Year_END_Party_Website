import { expect, type Page, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";

async function completedHome(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixture(page, { revision: 1, paused: false }, { phase: "COMPLETED" });
  await page.route("**/functions/v1/portal", (route) => {
    switch (route.request().postDataJSON().action) {
      case "taste_cards":
        return route.fulfill({ json: { revision: 1, cards: [] } });
      case "forest_tree":
        return route.fulfill({ json: { total: 0, notes: [] } });
      default:
        return route.fallback();
    }
  });
  await page.goto("/#/event");
  await expect(page).toHaveURL(/#\/afterparty$/);
}

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
