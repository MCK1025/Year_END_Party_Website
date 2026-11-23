import { expect, type Page, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";
import { sampleFold } from "./sample-fold";

async function completedHome(page: Page, reducedMotion: "reduce" | "no-preference" = "reduce") {
  await page.emulateMedia({ reducedMotion });
  await fixture(page, { revision: 1, paused: false }, { phase: "COMPLETED", treeOpen: true });
  await page.route("**/functions/v1/portal", (route) => {
    switch (route.request().postDataJSON().action) {
      case "recaps":
        return route.fulfill({ json: [] });
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
  await expect(page.getByText("공개된 회고 장면이 아직 없습니다.")).toBeVisible();
}

test("turns the actual free-browsing page in both directions, including browser back", async ({
  page,
  browserName,
}) => {
  await completedHome(page, "no-preference");
  const paper = page.locator(".book-frame > .book-surface");
  const sample = async (direction: "next" | "previous", oldText: string) => {
    const moving = direction === "next" ? ".book-frame > .turn-window" : ".book-frame > .book-surface";
    const frame = await sampleFold(page, moving, direction);
    expect(frame.hinge).toBeCloseTo(0);
    expect(frame.closing).toBe(direction === "previous");
    expect(frame.depth, "the free edge lifts toward the reader").toBeGreaterThan(0);
    expect(frame.projection, "the near edge grows in perspective").toBeLessThan(1);
    const leaf = page.locator(".book-frame > .turn-window");
    await expect(leaf).toContainText(oldText);
    await expect(leaf).toBeInViewport();
    if (direction === "previous") await expect(leaf).toHaveCSS("transform", "none");
  };
  await page.locator(".afterparty-link[href='#/tree']").click();
  await expect(page).toHaveURL(/#\/tree$/);
  await expect(paper).toHaveAttribute("aria-label", "이야기 트리");
  await sample("next", "한 걸음 더 가까워진 우리");
  await page.screenshot({ path: `artifacts/screens/free-browse-turn/${browserName}-tree.png` });
  await page
    .locator(".book-pager")
    .getByRole("link", { name: /다음 장/ })
    .click();
  await expect(page).toHaveURL(/#\/cards$/);
  await expect(paper).toHaveAttribute("aria-label", "인물 카드");
  await sample("next", "이야기");
  await page.screenshot({ path: `artifacts/screens/free-browse-turn/${browserName}-cards.png` });
  await page.goBack();
  await expect(page).toHaveURL(/#\/tree$/);
  await expect(paper).toHaveAttribute("aria-label", "이야기 트리");
  await sample("previous", "혜성식품 인물 카드");
  await page.screenshot({ path: `artifacts/screens/free-browse-turn/${browserName}-return-tree.png` });
  await paper.evaluate((el) =>
    el
      .getAnimations()
      .find((a) => a.id === "browse-turn-previous")
      ?.finish(),
  );
  await page.getByRole("link", { name: "자유 관람 홈으로" }).click();
  await expect(page).toHaveURL(/#\/afterparty$/);
  await expect(paper).toHaveAttribute("aria-label", "자유 관람 홈");
  await sample("previous", "마음이 모여");
  await page.screenshot({ path: `artifacts/screens/free-browse-turn/${browserName}-home.png` });
  await page.locator("details.book-settings summary").click();
  await page.getByLabel("페이지 효과 끄기").check();
  await expect(page.locator(".book-frame > .turn-window")).toHaveCount(0);
  await expect.poll(() => paper.evaluate((el) => el.getAnimations().length)).toBe(0);
  await page.locator(".afterparty-link[href='#/cards']").click();
  await expect(page).toHaveURL(/#\/cards$/);
  await expect(page.locator(".book-frame > .turn-window")).toHaveCount(0);
  expect(await paper.evaluate((el) => el.getAnimations().length)).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByLabel("페이지 효과 끄기").uncheck();
  await page.getByRole("link", { name: "자유 관람 홈으로" }).click();
  await expect(page).toHaveURL(/#\/afterparty$/);
  await expect(page.locator(".book-frame > .turn-window")).toHaveCount(0);
  expect(await paper.evaluate((el) => el.getAnimations().length)).toBe(0);
});

test("the waiting room and free browsing open and cover from the same binding", async ({ page }) => {
  await fixture(page, undefined, { phase: "WAITING" });
  // Compare the waiting room's HTML turn even on runners which support WebGL.
  await page.route(/assets\/rasterPaper-[^/]+\.js/, (route) => route.abort());
  await page.goto("/#/survey");
  await page.getByRole("navigation", { name: "내 행사 메뉴" }).getByRole("link", { name: "행사장" }).click();
  const timing = async (id: string, arriving = false) => {
    const frame = await page.waitForFunction(
      ({ id, arriving }) => {
        const animation = document.getAnimations().find((a) => a.id === id);
        const effect = animation?.effect;
        if (!(effect instanceof KeyframeEffect) || !effect.target) return null;
        const frames = effect.getKeyframes();
        const folded = arriving ? frames[0] : frames.at(-1);
        return {
          transform: folded?.transform,
          origin: parseFloat(getComputedStyle(effect.target).transformOrigin),
          duration: effect.getTiming().duration,
          easing: effect.getTiming().easing,
        };
      },
      { id, arriving },
    );
    return frame.jsonValue();
  };
  const reference = await timing("paper-curl");
  expect(reference?.origin).toBe(0);
  await expect(page.locator(".curl-stage")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "내 행사 메뉴" })
    .getByRole("link", { name: "나의 이야기" })
    .click();
  await expect(page).toHaveURL(/#\/survey$/);
  const returnToSurvey = await timing("paper-curl", true);
  expect(returnToSurvey).toEqual(reference);
  await page.goto("about:blank");
  await completedHome(page, "no-preference");
  const tree = page.locator(".afterparty-link[href='#/tree']");
  await tree.click();
  await expect(page).toHaveURL(/#\/tree$/);
  expect(await timing("browse-turn-next")).toEqual(reference);
  await page.getByRole("link", { name: "자유 관람 홈으로" }).click();
  await expect(page).toHaveURL(/#\/afterparty$/);
  expect(await timing("browse-turn-previous", true)).toEqual(returnToSurvey);
  await expect(page.locator(".book-frame > .turn-window")).toHaveCount(0);
  await page.locator(".book-frame > .book-surface h1").evaluate((el) => el.setAttribute("data-private", ""));
  await tree.click();
  await expect(page).toHaveURL(/#\/tree$/);
  expect(await timing("browse-turn-next", true)).toEqual(reference);
  await expect(page.locator(".book-frame > .turn-window")).toHaveCount(0);
});

test("changing chapters during a return keeps the next sheet at its full width", async ({ page }) => {
  await completedHome(page, "no-preference");
  const menu = page.getByRole("navigation", { name: "내 행사 메뉴" });
  const paper = page.locator(".book-frame > .book-surface");
  const snapshot = page.locator(".book-frame > .turn-window");
  await menu.getByRole("link", { name: "인물 카드" }).click();
  await paper.getByRole("heading", { name: "혜성식품 인물 카드" }).waitFor();
  await menu.getByRole("link", { name: "자유 관람 홈" }).click();
  await sampleFold(page, ".book-frame > .book-surface", "previous");
  await menu.getByRole("link", { name: "이야기 트리" }).click();
  await expect(paper).toHaveAttribute("aria-label", "이야기 트리");
  await sampleFold(page, ".book-frame > .turn-window", "next");
  await expect(snapshot).toHaveCount(1);
  await expect(snapshot).toContainText("한 걸음 더 가까워진 우리");
  const liveWidth = await paper.evaluate((el) => el.clientWidth);
  expect(await snapshot.evaluate((el) => el.clientWidth)).toBe(liveWidth);
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
