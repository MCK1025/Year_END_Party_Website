import { expect, type Page, test } from "@playwright/test";
import { markPixels, paperDifference } from "./curl-pixels";
import { fixture } from "./notebook-fixture";

const answer = "올해는 동료들과 한 걸음 더 가까워졌어요.";
const evidence = "artifacts/screens/spiral-notebook";
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "내 행사 메뉴" })
    .getByRole("link", { name: new RegExp(name) })
    .evaluate((e) => {
      if (e instanceof HTMLElement) e.click();
    });
}
async function settled(page: Page) {
  await expect(page.locator(".curl-stage")).toHaveCount(0);
}
async function fillStory(page: Page) {
  await fixture(page, undefined, { choice: true });
  await page.goto("/?motionDebug=1#/survey");
  await page.getByLabel("어릴 적 나의 꿈은?").fill(answer);
  await page.getByLabel("함께한 시간").selectOption("점심시간");
  await page.getByRole("checkbox", { name: /내 답변을/ }).check();
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelector(".book-frame")?.scrollIntoView({ block: "start" });
  });
}
for (const mode of ["webgl", "dom"] as const) {
  test(`both directions carry real paper through five frames (${mode})`, async ({ page, browserName }) => {
    const folder = browserName === "chromium" ? evidence : `${evidence}/${browserName}`;
    await page.setViewportSize({ width: 850, height: 1280 });
    // The animation clock is controlled exclusively in this Playwright document.
    await page.addInitScript((fallback) => {
      if (fallback) {
        const get = HTMLCanvasElement.prototype.getContext;
        Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
          value: function (kind: string, ...args: unknown[]) {
            return kind === "webgl2" ? null : Reflect.apply(get, this, [kind, ...args]);
          },
        });
      }
      const native = Element.prototype.animate;
      Element.prototype.animate = function (frames, options) {
        const a = native.call(this, frames, options);
        if (a.id === "paper-curl") {
          a.pause();
          a.currentTime = 0;
        }
        return a;
      };
      window.setTimeout = new Proxy(window.setTimeout, {
        apply(timer, owner, [fn, ms, ...args]) {
          return Reflect.apply(timer, owner, [fn, ms === 1450 ? 60000 : ms, ...args]);
        },
      });
    }, mode === "dom");
    await fillStory(page);
    await page.screenshot({ path: `${folder}/original-story.png` });
    for (const direction of ["forward", "backward"]) {
      const stickerArea =
        direction === "forward" ? await page.locator(".book-surface .sticker-gift").boundingBox() : null;
      const checkArea =
        direction === "forward"
          ? await page.getByRole("checkbox", { name: /내 답변을/ }).boundingBox()
          : null;
      const select = direction === "forward" ? await page.getByLabel("함께한 시간").boundingBox() : null;
      const liveBefore = await page.screenshot();
      await nav(page, direction === "forward" ? "고마운 동료" : "나의 이야기");
      const stage = page.locator(".curl-stage");
      await expect(stage).toHaveAttribute("data-mode", mode);
      await expect(stage.locator(".turn-window").last()).toContainText(answer);
      await expect(stage.locator(".turn-window").last()).toContainText("점심시간");
      if (direction === "forward") await expect(stage.locator("[data-checked]")).toHaveCount(1);
      await expect(page.locator(".book-frame > .book-surface textarea").first()).toHaveValue(
        direction === "forward" ? "" : answer,
      );
      const area = await stage.boundingBox();
      if (!area) throw Error("missing paper area");
      const frames: Buffer[] = [];
      for (const pct of [0, 25, 50, 75, 100]) {
        await stage.evaluate(async (el, p) => {
          const a = el.getAnimations({ subtree: true }).find((x) => x.id === "paper-curl");
          if (!a) throw Error("clock missing");
          a.currentTime = (640 * p) / 100;
          await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        }, pct);
        frames.push(await page.screenshot({ path: `${folder}/${mode}-${direction}-${pct}.png` }));
      }
      await stage.evaluate((el) =>
        el
          .getAnimations({ subtree: true })
          .find((x) => x.id === "paper-curl")
          ?.finish(),
      );
      await settled(page);
      const [start, , middle, , end] = frames;
      if (!start || !middle || !end) throw Error("missing curl sample");
      const after = await page.screenshot();
      // Compare rendered pixels, including the newly uncovered right side of the page.
      expect(await paperDifference(page, liveBefore, start, area)).toBeLessThan(7);
      if (stickerArea) {
        const ink = await markPixels(page, liveBefore, stickerArea, false);
        expect(ink).toBeGreaterThan(stickerArea.width * stickerArea.height * 0.13);
        expect(await markPixels(page, start, stickerArea, false)).toBeGreaterThan(ink * 0.8);
        if (mode === "webgl")
          expect(await paperDifference(page, start, middle, stickerArea)).toBeGreaterThan(9);
      }
      if (direction === "backward") {
        const returned = await page.locator(".book-surface .sticker-gift").boundingBox();
        if (!returned) throw Error("Missing gift on the returning page");
        const ink = await markPixels(page, after, returned, false);
        expect(ink).toBeGreaterThan(returned.width * returned.height * 0.13);
        expect(await markPixels(page, end, returned, false)).toBeGreaterThan(ink * 0.8);
      }
      if (select) {
        const arrow = {
          x: select.x + select.width - 23,
          y: select.y + select.height / 2 - 12,
          width: 22,
          height: 24,
        };
        const original = await markPixels(page, liveBefore, arrow, false);
        expect(original).toBeGreaterThan(5);
        expect(await markPixels(page, start, arrow, false)).toBeGreaterThan(original * 0.5);
      }
      if (checkArea) {
        const originalTick = await markPixels(page, liveBefore, checkArea);
        expect(originalTick).toBeGreaterThan(10);
        expect(await markPixels(page, start, checkArea)).toBeGreaterThan(originalTick * 0.65);
      }
      expect(await paperDifference(page, start, middle, area)).toBeGreaterThan(1);
      expect(await paperDifference(page, end, after, area)).toBeLessThan(7);
      if (direction === "forward" && mode === "webgl")
        expect(await paperDifference(page, middle, after, area, 0.72, 0.98)).toBeLessThan(3);
    }
    await expect(page.getByLabel("어릴 적 나의 꿈은?")).toHaveValue(answer);
  });
}
