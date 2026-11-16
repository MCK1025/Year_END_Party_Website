import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { fixture } from "../tests/e2e/notebook-fixture.ts";

// Start Vite dev and a production preview locally before running this script.
const dev = process.env.STORY_DEV_URL ?? "http://127.0.0.1:5184";
const preview = process.env.STORY_PREVIEW_URL ?? "http://127.0.0.1:4173";
for (const host of [dev, preview]) assert.ok(["localhost", "127.0.0.1"].includes(new URL(host).hostname));
const out = "artifacts/screens/waiting-story";
await mkdir(`${out}/frames`, { recursive: true });
await mkdir(`${out}/alignment`, { recursive: true });
const browser = await chromium.launch();
async function freeze(page, value) {
  const slider = page.getByRole("slider");
  // Use native keyboard input so the debug controls follow the normal React event path.
  await slider.focus();
  await slider.press("Home");
  if (value === 100) await slider.press("End");
  else for (let n = 0; n < value; n++) await slider.press("ArrowRight");
  await expect(slider).toHaveValue(String(value));
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}
async function frames() {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto(`${dev}/#/dev/waiting-story`);
  const story = p.locator(".work-story");
  await p.getByRole("button", { name: "첫 프레임" }).click();
  await expect(story.locator("canvas")).toHaveAttribute("data-ready", "true");
  const checks = [];
  for (let n = 1; n <= 6; n++) {
    await expect(story).toHaveAttribute("data-scene", String(n));
    await p.setViewportSize({ width: 390, height: 844 });
    await story.locator(".work-story-image").evaluate((img) => img.decode());
    for (const pct of [0, 25, 50, 75, 100]) {
      await freeze(p, pct);
      await story.evaluate((el) => el.scrollIntoView({ block: "start" }));
      const box = await story.boundingBox();
      const nav = await story.locator(".work-story-nav").boundingBox();
      assert.ok(box && nav);
      await p.screenshot({
        path: `${out}/frames/${n}-${String(pct).padStart(3, "0")}.png`,
        clip: { x: box.x, y: box.y, width: box.width, height: nav.y + nav.height - box.y },
      });
      if (n === 6 && [50, 75, 100].includes(pct)) {
        const m = await story
          .locator(".work-story-masero")
          .evaluate((el) => Number(getComputedStyle(el).opacity));
        const c = await story
          .locator(".work-story-company")
          .evaluate((el) => Number(getComputedStyle(el).opacity));
        assert.equal(m, pct === 50 ? 1 : 0);
        assert.equal(c, pct === 50 ? 0 : 1);
      }
    }
    await freeze(p, 25);
    for (const width of [320, 375, 390, 430, 768, 1280]) {
      await p.setViewportSize({ width, height: width === 768 ? 375 : 844 });
      const art = story.locator(".work-story-art");
      await art.scrollIntoViewIfNeeded();
      const metrics = await art.evaluate((el) => {
        const a = el.getBoundingClientRect(),
          img = el.querySelector("img"),
          canvas = el.querySelector("canvas");
        const b = img.getBoundingClientRect(),
          c = canvas.getBoundingClientRect();
        return {
          width: a.width,
          height: a.height,
          aspect: img.naturalWidth / img.naturalHeight,
          maxError: Math.max(...["left", "right", "top", "bottom"].map((k) => Math.abs(b[k] - c[k]))),
        };
      });
      assert.ok(metrics.maxError < 0.1 && Math.abs(metrics.width / metrics.height - metrics.aspect) < 0.004);
      checks.push({ scene: n, viewport: width, ...metrics });
      if (n <= 3) {
        const file = `${out}/alignment/${n}-${width}`;
        const png = await art.screenshot({
          path: `${file}-light.png`,
          style:
            ".work-story-image{visibility:hidden!important}.work-story-art,.work-story-stage,.work-story-plate{background:black!important}",
        });
        const bounds = await p.evaluate(async (data) => {
          const image = new Image();
          image.src = `data:image/png;base64,${data}`;
          await image.decode();
          const c = document.createElement("canvas");
          c.width = image.width;
          c.height = image.height;
          const ctx = c.getContext("2d");
          ctx.drawImage(image, 0, 0);
          const bytes = ctx.getImageData(0, 0, c.width, c.height).data;
          const box = [c.width, c.height, 0, 0];
          let pixels = 0;
          for (let y = 4; y < c.height - 4; y++)
            for (let x = 4; x < c.width - 4; x++) {
              if (bytes[4 * (y * c.width + x)] < 6) continue;
              pixels++;
              box[0] = Math.min(box[0], x);
              box[1] = Math.min(box[1], y);
              box[2] = Math.max(box[2], x);
              box[3] = Math.max(box[3], y);
            }
          return { pixels, box: box.map((v, i) => v * (i % 2 ? 448 / c.height : 536 / c.width)) };
        }, png.toString("base64"));
        // Regions independently read on the 536 x 448 originals (include two pixels of sampling tolerance).
        const region = [
          [259, 319, 289, 329],
          [258, 97, 278, 117],
          [307, 318, 359, 330],
        ][n - 1];
        assert.ok(
          bounds.pixels > 0 &&
            bounds.box[0] >= region[0] &&
            bounds.box[1] >= region[1] &&
            bounds.box[2] <= region[2] &&
            bounds.box[3] <= region[3],
          JSON.stringify({ n, width, bounds }),
        );
        Object.assign(checks.at(-1), bounds);
      }
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.getByLabel("앵커 표시").check();
    await story.locator(".work-story-art").screenshot({ path: `${out}/alignment/${n}-anchors.png` });
    await p.getByLabel("앵커 표시").uncheck();
    await story.getByLabel("다음 장면").click();
  }
  await writeFile(`${out}/geometry.json`, JSON.stringify(checks, null, 2));
  await p.close();
}
async function record() {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 740 },
    recordVideo: { dir: `${out}/raw`, size: { width: 390, height: 740 } },
  });
  const page = await ctx.newPage();
  await fixture(page, undefined, { phase: "WAITING" });
  await page.goto(`${preview}/#/event`);
  const story = page.locator(".work-story");
  await page.locator(".waiting-cover").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await expect(story.locator("canvas")).toHaveAttribute("data-ready", "true");
  const seen = [];
  for (const index of [1, 2, 3, 4, 5, 6, 1]) {
    await expect(story).toHaveAttribute("data-scene", String(index), { timeout: 10000 });
    seen.push({ index, at: Date.now() });
    if (index === 6) {
      for (const brand of ["masero", "company"]) {
        await expect(story.locator(`.work-story-${brand}`)).toHaveCSS("opacity", "1", { timeout: 5000 });
        await page.screenshot({ path: `${out}/final-${brand}.png` });
      }
    }
  }
  await writeFile(`${out}/loop.json`, JSON.stringify(seen, null, 2));
  const video = page.video();
  await ctx.close();
  await video.saveAs(`${out}/six-scenes.webm`);
  await video.delete();
}
try {
  await Promise.all([frames(), record()]);
} finally {
  await browser.close();
}
