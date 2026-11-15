import { expect, test } from "@playwright/test";
import { paperDifference } from "./curl-pixels";
import { publicTreeFixture } from "./public-tree-fixture";

const out = "artifacts/screens/public-paper-tree";

test("seeded snow moves in open air at fixed active times; leaving the viewport freezes the clock", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const schedule = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      schedule(() => cb(Number(document.documentElement.dataset.treeTime ?? 0)));
    const proto = WebGL2RenderingContext.prototype;
    Object.defineProperty(proto, "bufferSubData", {
      configurable: true,
      value: new Proxy(proto.bufferSubData, {
        apply(original, self, args) {
          const data = args[2];
          if (data instanceof Float32Array && (data.length === 360 || data.length === 54)) {
            document.documentElement.dataset[`batch${data.length}`] = Array.from(data).join(",");
          }
          return Reflect.apply(original, self, args);
        },
      }),
    });
  });
  await publicTreeFixture(page, 3);
  await page.goto("/#/tree");
  const stage = page.locator(".tree-stage"),
    scene = page.locator(".tree-scene");
  await stage.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-renderer", "webgl");
  async function tick(ms: number) {
    await page.evaluate(async (t) => {
      document.documentElement.dataset.treeTime = String(t);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    }, ms);
  }
  await tick(0);
  const first = await stage.screenshot();
  for (const t of [0.5, 1, 1.5, 2, 3, 4]) {
    await tick(t * 1000);
    const frame = await stage.screenshot({ path: `${out}/active-${t}s.png` });
    expect(await paperDifference(page, first, frame, { x: 3, y: 3, width: 75, height: 110 })).toBeGreaterThan(
      0.04,
    );
  }
  const batches = () =>
    page.evaluate(() => [
      document.documentElement.dataset.batch360,
      document.documentElement.dataset.batch54,
    ]);
  const before = await batches();
  expect(before.every(Boolean)).toBe(true);
  await page.evaluate(() => {
    document.querySelector<HTMLElement>(".message-tree")?.style.setProperty("margin-top", "240vh");
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(180);
  await tick(38_000);
  expect(await batches()).toEqual(before);
  await stage.scrollIntoViewIfNeeded();
  await page.waitForTimeout(180);
  expect(await batches()).toEqual(before);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await tick(78_000);
  expect(await batches()).toEqual(before);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await tick(78_000);
  expect(await batches()).toEqual(before);
  await tick(78_500);
  expect(await batches()).not.toEqual(before);
});

for (const failure of ["context", "shader"]) {
  test(`static stories survive a ${failure} initialization failure`, async ({ page }) => {
    await page.addInitScript((f) => {
      if (f === "shader") {
        const original = WebGL2RenderingContext.prototype.shaderSource;
        WebGL2RenderingContext.prototype.shaderSource = function (shader, source) {
          return original.call(this, shader, `${source}\n invalid_test_shader`);
        };
      } else {
        const original = HTMLCanvasElement.prototype.getContext;
        Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
          value: function (this: HTMLCanvasElement, ...args: unknown[]) {
            return args[0] === "webgl2" ? null : Reflect.apply(original, this, args);
          },
        });
      }
    }, failure);
    await publicTreeFixture(page, 3);
    await page.goto("/#/tree");
    await page.locator(".tree-stage").scrollIntoViewIfNeeded();
    await expect(page.locator(".tree-scene")).toHaveAttribute("data-renderer", "fallback");
    await expect(page.getByRole("button", { name: "정적 트리" })).toBeDisabled();
    await page.locator(".tree-ornament").nth(1).click();
    await expect(page.getByRole("dialog")).toContainText("가상의 겨울 이야기 2");
  });
}
test("ten tree visits release buffers, shader programs and the canvas", async ({ page }) => {
  await page.addInitScript(() => {
    const proto = WebGL2RenderingContext.prototype;
    for (const method of ["createBuffer", "deleteBuffer", "createProgram", "deleteProgram"] as const) {
      const original = proto[method];
      Object.defineProperty(proto, method, {
        configurable: true,
        value: new Proxy(original as (...a: unknown[]) => unknown, {
          apply(fn, self, args) {
            const stats = document.documentElement.dataset;
            stats[method] = String(Number(stats[method] ?? 0) + 1);
            return Reflect.apply(fn, self, args);
          },
        }),
      });
    }
  });
  await publicTreeFixture(page, 3);
  await page.goto("/#/tree");
  for (let i = 0; i < 10; i++) {
    if (i) await page.locator('.book-index a[href="#/tree"]').click();
    await page.locator(".tree-stage").scrollIntoViewIfNeeded();
    await expect(page.locator(".tree-scene")).toHaveAttribute("data-renderer", "webgl");
    await page.locator('.book-index a[href="#/event"]').click();
    await expect(page.locator(".tree-canvas")).toHaveCount(0);
  }
  const stats = await page.evaluate(() => ({ ...document.documentElement.dataset }));
  expect(Number(stats.createBuffer)).toBeGreaterThan(0);
  expect(Number(stats.deleteBuffer)).toBe(Number(stats.createBuffer));
  expect(Number(stats.deleteProgram)).toBe(Number(stats.createProgram));
});

test("a reduced-motion first visit stays readable and closing publication withdraws the open story", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const updates = { revision: 1, open: true };
  await publicTreeFixture(page, 3, updates);
  await page.goto("/#/tree");
  const stage = page.locator(".tree-stage");
  await stage.scrollIntoViewIfNeeded();
  await expect(page.locator(".tree-scene")).toHaveAttribute("data-renderer", "webgl");
  const first = await stage.screenshot();
  await page.waitForTimeout(300);
  expect((await stage.screenshot()).equals(first)).toBe(true);
  await page.locator(".tree-ornament").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  updates.open = false;
  updates.revision++;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".tree-canvas")).toHaveCount(0);
  await expect(page).toHaveURL(/#\/event$/);
  updates.open = true;
  updates.revision++;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".tree-ornament")).toHaveCount(3);
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.locator(".message-tree")).toHaveCount(0);
});
