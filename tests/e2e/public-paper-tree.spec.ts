import { mkdir, writeFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { lamps } from "../../src/graphics/treeModel";
import { publicTreeFixture } from "./public-tree-fixture";

const output = "artifacts/screens/public-paper-tree";
async function open(page: Page, count: number) {
  await publicTreeFixture(page, count);
  await page.goto("/#/tree");
  await page.locator(".tree-stage").scrollIntoViewIfNeeded();
}
for (const count of [0, 1, 3, 12, 13, 30, 31]) {
  test(`story tree keeps all ${count} story targets and keyboard access`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, count);
    const buttons = page.locator(".tree-ornament");
    await expect(buttons).toHaveCount(Math.min(30, count));
    await expect(page.locator(".tree-caption")).toContainText(`${count}개의 이야기`);
    expect(
      await buttons.evaluateAll((els) => {
        const boxes = els.map((e) => e.getBoundingClientRect());
        return boxes.every(
          (a, i) =>
            a.width >= 48 &&
            a.height >= 48 &&
            boxes
              .slice(i + 1)
              .every((b) => a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom),
        );
      }),
    ).toBe(true);
    if (count) {
      await buttons.first().focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toContainText(`가상의 겨울 이야기 ${count}`);
      await page.keyboard.press("Escape");
      await expect(buttons.first()).toBeFocused();
    }
    if (count === 31) {
      await page.getByRole("button", { name: "다음 이야기들" }).click();
      await expect(buttons).toHaveCount(1);
      await expect(buttons.first()).toHaveAccessibleName(/31/);
    }
    if (count === 30 || count === 0) {
      // Capture the complete narrow card without a scrolling screenshot moving
      // the fixed site chrome into the middle of the image.
      await page.setViewportSize({ width: 320, height: 1800 });
      await buttons.evaluateAll((els) => {
        for (const el of els) if (el instanceof HTMLElement) el.blur();
      });
      await page.locator(".message-tree").screenshot({ path: `${output}/stories-${count}.png` });
    }
  });
}
test("page changes and new revisions preserve the stopped scene and refresh approved stories", async ({
  page,
}) => {
  const updates = { revision: 2 };
  await publicTreeFixture(page, 31, updates);
  await page.goto("/#/tree");
  await page.getByRole("button", { name: "효과 멈추기" }).click();
  const canvas = page.locator(".tree-canvas");
  await canvas.evaluate((el) => el.setAttribute("data-test-session", "original"));
  await page.getByRole("button", { name: "다음 이야기들" }).click();
  await expect(page.locator(".tree-ornament")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "효과 재생" })).toHaveAttribute("aria-pressed", "true");
  updates.revision++;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".tree-ornament")).toHaveCount(30);
  await expect(canvas).toHaveAttribute("data-test-session", "original");
  await expect(page.getByRole("button", { name: "효과 재생" })).toBeVisible();
});
test("landscape and enlarged labels keep the story and pause controls reachable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page, 3);
  await page
    .locator(".message-tree :is(.tree-caption span, .tree-instruction p, .tree-instruction button)")
    .evaluateAll((els) => {
      for (const el of els)
        if (el instanceof HTMLElement)
          el.style.fontSize = `${2 * parseFloat(getComputedStyle(el).fontSize)}px`;
    });
  for (const [width, height] of [
    [320, 568],
    [844, 390],
  ] as const) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const button = page.locator(".tree-instruction button");
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();
  }
});
test("captures the live paper tree, reads lamp and snow pixels and records eight seconds", async ({
  page,
}) => {
  await mkdir(output, { recursive: true });
  await open(page, 3);
  const card = page.locator(".message-tree"),
    stage = page.locator(".tree-stage");
  await expect(page.locator(".tree-scene")).toHaveAttribute("data-renderer", "webgl");
  for (const [width, height] of [
    [320, 568],
    [375, 812],
    [390, 844],
    [768, 1024],
    [1280, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    await card.screenshot({ path: `${output}/tree-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await card.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const area = await stage.boundingBox();
  if (!area) throw Error("Missing tree stage");
  const frames: number[][] = [];
  await page.screencast.start({ path: `${output}/winter-tree.webm`, size: { width: 1280, height: 800 } });
  const start = Date.now();
  try {
    for (const seconds of [0, 0.5, 1, 1.5, 2, 3, 4]) {
      await page.waitForTimeout(Math.max(0, start + seconds * 1000 - Date.now()));
      const png = await stage.screenshot({ path: `${output}/frame-${seconds}.png` });
      frames.push(
        await page.evaluate(
          async ({ src, points }) => {
            const img = new Image();
            img.src = src;
            await img.decode();
            const c = document.createElement("canvas");
            c.width = img.width;
            c.height = img.height;
            const ctx = c.getContext("2d");
            if (!ctx) throw Error("Missing pixel reader");
            ctx.drawImage(img, 0, 0);
            return points.map(
              (p) =>
                ctx.getImageData(Math.round((c.width / 400) * p.x), Math.round((c.height / 520) * p.y), 1, 1)
                  .data[0] ?? 0,
            );
          },
          { src: `data:image/png;base64,${png.toString("base64")}`, points: lamps },
        ),
      );
    }
    await page.waitForTimeout(Math.max(0, start + 8000 - Date.now()));
  } finally {
    await page.screencast.stop();
  }
  const spans = lamps.map(
    (_, i) => Math.max(...frames.map((f) => f[i] ?? 0)) - Math.min(...frames.map((f) => f[i] ?? 0)),
  );
  expect(spans.filter((s, i) => !lamps[i]?.steady && s > 15).length).toBeGreaterThanOrEqual(6);
  expect(spans.filter((s, i) => lamps[i]?.steady && s <= 8).length).toBeGreaterThanOrEqual(3);
  await writeFile(
    `${output}/sampling.json`,
    JSON.stringify({ seconds: [0, 0.5, 1, 1.5, 2, 3, 4], frames, spans }),
  );
  await page.getByRole("button", { name: "효과 멈추기" }).click();
  const quiet = await stage.screenshot();
  await page.waitForTimeout(350);
  expect(await stage.screenshot()).toEqual(quiet);
  await page.getByRole("button", { name: "효과 재생" }).click();
  await page.waitForTimeout(240);
  expect(await stage.screenshot()).not.toEqual(quiet);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await stage.screenshot();
  await page.waitForTimeout(240);
  expect(await stage.screenshot()).toEqual(reduced);
});
test("pause before initialization and static fallback retain the entire tree", async ({ page }) => {
  let resume = () => {};
  const held = new Promise<void>((r) => {
    resume = r;
  });
  await page.route(/assets\/christmas-[^/]+\.js/, async (r) => {
    await held;
    await r.continue();
  });
  await open(page, 3);
  await page.getByRole("button", { name: "효과 멈추기" }).click();
  resume();
  await expect(page.locator(".tree-scene")).toHaveAttribute("data-renderer", "webgl");
  const canvas = page.locator(".tree-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const a = await canvas.screenshot();
  await page.waitForTimeout(250);
  expect(await canvas.screenshot()).toEqual(a);
  await canvas.evaluate((el) =>
    (el as HTMLCanvasElement).getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext(),
  );
  await expect(page.locator(".tree-scene")).toHaveAttribute("data-renderer", "fallback");
  await page.locator(".message-tree").screenshot({ path: `${output}/fallback.png` });
  await page.locator(".tree-ornament").first().click();
  await expect(page.getByRole("dialog")).toContainText("가상의 겨울 이야기 3");
});
