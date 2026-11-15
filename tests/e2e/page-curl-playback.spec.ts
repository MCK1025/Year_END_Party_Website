import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";

const dir = "artifacts/screens/spiral-notebook";
for (const fallback of [false, true]) {
  test(`records uninterrupted content turns and releases its surfaces (${fallback ? "DOM" : "GPU"})`, async ({
    browser,
    browserName,
    baseURL,
  }) => {
    test.setTimeout(100000);
    await mkdir(dir, { recursive: true });
    const context = await browser.newContext({
      baseURL: baseURL ?? "http://127.0.0.1:4173",
      viewport: { width: 390, height: 844 },
      recordVideo: { dir: "artifacts/local-curl-videos", size: { width: 390, height: 844 } },
    });
    const page = await context.newPage();
    const video = page.video();
    await page.addInitScript(() => {
      const gl = window.WebGL2RenderingContext?.prototype;
      if (!gl) return;
      for (const method of ["createTexture", "deleteTexture"] as const) {
        const fn = gl[method];
        Object.defineProperty(gl, method, {
          value: new Proxy(fn as (...args: unknown[]) => unknown, {
            apply(target, self, args) {
              const key = method === "createTexture" ? "texturesCreated" : "texturesDeleted";
              const stats = document.documentElement.dataset;
              stats[key] = String(Number(stats[key] ?? 0) + 1);
              return Reflect.apply(target, self, args);
            },
          }),
        });
      }
    });
    if (fallback) await page.route(/assets\/rasterPaper-.*\.js/, (r) => r.abort());
    await fixture(page);
    await page.goto("/?motionDebug=1#/survey");
    await page.getByLabel("어릴 적 나의 꿈은?").fill("올해는 동료들과 한 걸음 더 가까워졌어요.");
    await page.evaluate(async () => {
      await document.fonts.ready;
      document.querySelector(".book-frame")?.scrollIntoView({ block: "start" });
    });
    const sample = async (to: string) =>
      page.evaluate(async (path) => {
        const nav = document.querySelector(`.book-index a[href="#/${path}"]`);
        if (!(nav instanceof HTMLElement)) throw Error("missing chapter");
        const start = performance.now();
        nav.click();
        let frames = 0,
          first = 0,
          mode = "";
        while (performance.now() - start < 3500) {
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          const stage = document.querySelector<HTMLElement>(".curl-stage");
          if (stage?.dataset.mode) {
            if (!first) first = performance.now();
            frames++;
            mode = stage.dataset.mode;
          }
          if (!stage && location.hash === `#/${path}`) break;
        }
        return {
          mode,
          prepare: Math.round(first - start),
          duration: Math.round(performance.now() - first),
          browserFrames: frames,
          remaining: document.querySelectorAll(".curl-stage, .paper-replica, .book-frame canvas").length,
        };
      }, to);
    const data = [];
    const cdp = browserName === "chromium" ? await context.newCDPSession(page) : undefined;
    async function resources() {
      if (!cdp) return null;
      await cdp.send("HeapProfiler.collectGarbage");
      return {
        dom: await cdp.send("Memory.getDOMCounters"),
        heap: (await cdp.send("Runtime.getHeapUsage")).usedSize,
      };
    }
    const before = await resources();
    const count = !fallback && browserName === "chromium" ? 20 : 2;
    for (let i = 0; i < count; i++) {
      const row = await sample(i % 2 === 0 ? "nominate" : "survey");
      data.push(row);
      expect(row.remaining).toBe(0);
      expect(["webgl", "dom"]).toContain(row.mode);
      if (fallback) expect(row.mode).toBe("dom");
    }
    const after = await resources();
    const textures = await page.evaluate(() => ({
      created: Number(document.documentElement.dataset.texturesCreated ?? 0),
      deleted: Number(document.documentElement.dataset.texturesDeleted ?? 0),
    }));
    await expect(page.getByLabel("어릴 적 나의 꿈은?")).toHaveValue(/가까워졌어요/);
    await context.close();
    const name = `${browserName}-${fallback ? "dom" : "normal"}`;
    await video?.saveAs(`${dir}/${name}.webm`);
    await writeFile(`${dir}/${name}.json`, JSON.stringify({ before, after, textures, data }, null, 2));
  });
}
