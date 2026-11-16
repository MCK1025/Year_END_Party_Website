import { expect, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";

test("the six original illustrations fit portrait, landscape and desktop without clipping", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixture(page, undefined, { phase: "PRE_SURVEY" });
  await page.goto("/#/event");
  const story = page.locator(".work-story");
  const titles = ["연구개발팀", "경영관리팀", "생산팀", "생산팀", "물류팀", "우리가 만드는 맛있는 세상"];
  for (const [i, title] of titles.entries()) {
    await expect(story.getByRole("heading")).toHaveText(title);
    await expect(story.locator(".work-story-image")).toHaveAttribute(
      "src",
      new RegExp(`scene-${i + 1}.webp$`),
    );
    await expect(story.locator("canvas")).toHaveCount(0);
    for (const width of [320, 375, 390, 430, 768, 1280]) {
      await page.setViewportSize({ width, height: width === 768 ? 375 : 844 });
      const fit = await story.evaluate((el) => {
        const frame = el.querySelector(".work-story-stage")?.getBoundingClientRect();
        const img = el.querySelector("img.work-story-image");
        if (!frame || !(img instanceof HTMLImageElement) || !img.naturalWidth) return false;
        const rect = img.getBoundingClientRect();
        return (
          rect.left >= frame.left - 1 &&
          rect.right <= frame.right + 1 &&
          rect.top >= frame.top - 1 &&
          rect.bottom <= frame.bottom + 1 &&
          Math.abs(rect.width / rect.height - img.naturalWidth / img.naturalHeight) < 0.004 &&
          document.documentElement.scrollWidth <= innerWidth
        );
      });
      expect(fit).toBe(true);
    }
    if (i === 5) {
      await expect(story.getByAltText("마세로")).toBeVisible();
      await expect(story.getByAltText("주식회사 혜성식품")).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await story.screenshot({ path: "artifacts/screens/waiting-story/reduced.png" });
    }
    await story.getByRole("button", { name: "다음 장면" }).click();
  }
  await expect(story).toHaveAttribute("data-scene", "1");
});

test("animates on the real waiting route, stops for visibility and yields to event updates", async ({
  page,
}) => {
  const status = { phase: "WAITING" as "WAITING" | "END" };
  const updates = { revision: 1, paused: false };
  await fixture(page, updates, status);
  await page.goto("/#/event");
  const story = page.locator(".work-story");
  await story.locator(".work-story-stage").scrollIntoViewIfNeeded();
  await expect(story.locator("canvas")).toHaveAttribute("data-ready", "true");
  await expect(story).toHaveAttribute("data-scene", "2", { timeout: 6500 });
  await story.getByLabel("이야기 일시 정지").click();
  await expect(story).toHaveAttribute("data-playing", "false");
  await story.getByLabel("이야기 재생").click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(story).toHaveAttribute("data-playing", "false");
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(story).toHaveAttribute("data-playing", "true");
  updates.revision++;
  updates.paused = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(story).toHaveAttribute("data-playing", "false");
  status.phase = "END";
  updates.revision++;
  updates.paused = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(story).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "다음 한 걸음도, 함께." })).toBeVisible();
});

test("WebGL loss, slow CPU and missing primary image retain story navigation and the notebook", async ({
  page,
}) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.route("**/waiting-story/scene-1.webp", (r) => r.abort());
  await fixture(page, undefined, { phase: "WAITING" });
  await page.goto("/#/event");
  const story = page.locator(".work-story");
  await story.scrollIntoViewIfNeeded();
  const canvas = story.locator("canvas");
  await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 10000 });
  await expect(story.locator(".work-story-image")).toHaveAttribute("src", /scene-1\.jpg$/);
  await canvas.evaluate((el) =>
    (el instanceof HTMLCanvasElement ? el.getContext("webgl2") : null)
      ?.getExtension("WEBGL_lose_context")
      ?.loseContext(),
  );
  await expect(canvas).toHaveCount(0);
  await expect(story.locator(".work-story-image")).toBeVisible();
  await story.screenshot({ path: "artifacts/screens/waiting-story/graphics-fallback.png" });
  await story.getByRole("button", { name: "다음 장면" }).click();
  await expect(story.getByRole("heading")).toHaveText("경영관리팀");
  await page.getByRole("link", { name: "나의 이야기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "들려주지 않은 당신의 이야기" })).toBeVisible();
});

test("a GPU creation failure on entry leaves the complete 2D story available", async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: function (this: HTMLCanvasElement, ...args: Parameters<typeof get>) {
        if (String(args[0]).startsWith("webgl")) return null;
        return Reflect.apply(get, this, args);
      },
    });
  });
  await fixture(page, undefined, { phase: "WAITING" });
  await page.goto("/#/event");
  const story = page.locator(".work-story");
  await story.scrollIntoViewIfNeeded();
  await expect(story).toHaveAttribute("data-scene", "2", { timeout: 7000 });
  await expect(story.locator("canvas")).toHaveCount(0);
  await story.getByLabel("이전 장면").click();
  await story.getByLabel("이전 장면").click();
  await expect(story.locator(".work-story-company")).toHaveCSS("opacity", "1", { timeout: 6000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(story).toHaveAttribute("data-static", "true");
  await expect(story.locator(".work-story-masero")).toHaveCSS("opacity", "1");
  await page.reload();
  await expect(story).toHaveAttribute("data-scene", "1");
  await expect(story).toHaveAttribute("data-playing", "false");
});

test("leaving the animated waiting page turns the original paper and releases its overlay", async ({
  page,
}) => {
  await fixture(page, undefined, { phase: "WAITING" });
  await page.goto("/#/event");
  const story = page.locator(".work-story");
  await story.scrollIntoViewIfNeeded();
  await expect(story.locator("canvas")).toHaveAttribute("data-ready", "true");
  await page.locator('.book-index a[href="#/survey"]').evaluate((el) => (el as HTMLAnchorElement).click());
  await expect(page.locator(".curl-stage")).toHaveAttribute("data-turn", "backward");
  await expect(page.locator(".work-story-light")).toHaveCount(0);
  await expect(page.locator(".curl-stage")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "들려주지 않은 당신의 이야기" })).toBeVisible();
});
