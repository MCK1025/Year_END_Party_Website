import { expect, type Page, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";

async function chapter(page: Page, part: string) {
  await page.locator(`.book-index a[href="#/${part}"]`).evaluate((a) => {
    if (a instanceof HTMLElement) a.click();
  });
}
test("an IME draft at the bottom moves from the current visible slice when capture fails", async ({
  page,
}) => {
  await fixture(page, undefined, { extraQuestions: 18 });
  await page.route(/assets\/rasterPaper-.*\.js/, (r) => r.abort());
  await page.goto("/#/survey");
  await expect(page.getByRole("heading", { name: "들려주지 않은 당신의 이야기", exact: true })).toBeVisible();
  const last = page.getByRole("textbox", { name: /기억 18/ });
  const draft = Array.from({ length: 16 }, (_, i) => `겨울 기억 ${i + 1}`).join("\n");
  await last.fill(draft);
  await last.focus();
  await last.evaluate((e) => {
    e.scrollIntoView({ block: "center" });
    e.scrollTop = e.scrollHeight;
    e.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  });
  await page.setViewportSize({ width: 390, height: 536 });
  await chapter(page, "nominate");
  await expect(page).toHaveURL(/#\/survey$/);
  await last.evaluate((e) =>
    e.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "억" })),
  );
  const stage = page.locator(".curl-stage");
  await expect(stage).toHaveAttribute("data-mode", "dom");
  await expect(stage).toContainText("겨울 기억 16");
  await expect(stage).not.toContainText("들려주지 않은");
  expect((await stage.boundingBox())?.height).toBeLessThanOrEqual(536);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(stage).toHaveCount(0);
  await chapter(page, "survey");
  await expect(stage).toHaveCount(0);
  await expect(last).toHaveValue(draft);
});
for (const pref of ["reduce", "site"]) {
  test(`policy skips both snapshot and graphics (${pref})`, async ({ page }) => {
    const assets: string[] = [];
    page.on("request", (r) => {
      if (/assets\/(pageCurl|rasterPaper)-/.test(r.url())) assets.push(r.url());
    });
    if (pref === "reduce") await page.emulateMedia({ reducedMotion: "reduce" });
    else await page.addInitScript(() => localStorage.setItem("hyeseong:2026:book-view", "pen:still"));
    await fixture(page);
    await page.goto("/#/survey");
    await chapter(page, "nominate");
    await expect(page.getByLabel("추천할 동료")).toBeVisible();
    await expect(page.locator(".curl-stage")).toHaveCount(0);
    expect(assets).toHaveLength(0);
  });
}
test("late capture cannot resurrect a hidden or superseded page; hidden values stay outside the mirror", async ({
  page,
}) => {
  await fixture(page);
  let release = () => {};
  const held = new Promise<void>((r) => {
    release = r;
  });
  await page.route(/assets\/rasterPaper-.*\.js/, async (r) => {
    await held;
    await r.continue();
  });
  await page.goto("/#/survey");
  await page.locator(".book-surface").evaluate((el) => {
    const secret = document.createElement("input");
    secret.type = "hidden";
    secret.value = "private-test-token";
    el.append(secret);
  });
  await chapter(page, "nominate");
  const stage = page.locator(".curl-stage");
  await expect(stage).toHaveAttribute("data-mode", "dom");
  expect(await stage.innerHTML()).not.toContain("private-test-token");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  release();
  await expect(stage).toHaveCount(0);
  await expect(page.getByLabel("추천할 동료")).toBeEnabled();
  await expect(page.locator(".book-frame canvas")).toHaveCount(0);
});
test("unruled paper, stickers and inputs remain usable at six widths and large type", async ({ page }) => {
  await fixture(page);
  await page.goto("/#/survey");
  const text = page.getByLabel("어릴 적 나의 꿈은?");
  await text.fill("한 걸음씩 함께한 겨울\n우리들의 이야기");
  for (const width of [320, 375, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const metrics = await text.evaluate((el) => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      answerBackground: getComputedStyle(el).backgroundImage,
      paperBackground: getComputedStyle(el.closest(".book-surface") ?? el).backgroundImage,
      left: el.getBoundingClientRect().left,
      binding: document.querySelector(".book-binding")?.getBoundingClientRect().right ?? 0,
    }));
    expect(metrics.overflow).toBe(false);
    expect(metrics.answerBackground).toBe("none");
    expect(metrics.paperBackground).toBe("none");
    expect(metrics.left).toBeGreaterThan(metrics.binding);
    if ([320, 390, 1280].includes(width)) {
      await text.evaluate((el) => el.closest(".book-frame")?.scrollIntoView({ block: "start" }));
      await page.screenshot({ path: `artifacts/screens/spiral-notebook/survey-${width}.png` });
    }
  }
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  await page.setViewportSize({ width: 320, height: 720 });
  await expect(text).toHaveValue(/우리들의/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("WebGL context loss during the curl leaves a single editable destination", async ({ page }) => {
  await fixture(page);
  await page.goto("/#/survey");
  await page.evaluate(() => document.fonts.ready.then(() => true));
  // Warm a transition so the test loses a real drawing context after its first frame.
  await chapter(page, "nominate");
  await expect(page).toHaveURL(/#\/nominate$/);
  await expect(page.locator(".curl-stage")).toHaveCount(0);
  await chapter(page, "survey");
  const canvas = page.locator('.curl-stage[data-mode="webgl"] canvas');
  await canvas.evaluate((el) => {
    if (!(el instanceof HTMLCanvasElement)) throw Error("canvas missing");
    const ext = el.getContext("webgl2")?.getExtension("WEBGL_lose_context");
    if (!ext) throw Error("missing loss extension");
    ext.loseContext();
  });
  await expect(page.locator(".curl-stage")).toHaveCount(0);
  await expect(page.locator(".book-frame form")).toHaveCount(1);
  await page.getByLabel("어릴 적 나의 꿈은?").fill("계속 쓸 수 있어요.");
});
test("loaded cross-origin photo stays in a private DOM turn; sensitive surfaces skip capture", async ({
  page,
}) => {
  await fixture(page);
  await page.route("https://assets.example.test/photo.svg", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="green"/></svg>',
    }),
  );
  await page.goto("/#/survey");
  await page.getByLabel("어릴 적 나의 꿈은?").fill("사진과 함께");
  await page.locator(".book-surface").evaluate(async (el) => {
    const img = new Image(16, 16);
    img.src = "https://assets.example.test/photo.svg";
    await img.decode();
    el.prepend(img);
    el.scrollIntoView({ block: "start" });
  });
  await chapter(page, "nominate");
  const stage = page.locator(".curl-stage");
  await expect(stage).toHaveAttribute("data-mode", "dom");
  expect(await stage.innerHTML()).not.toContain("assets.example.test");
  await expect(stage.locator(".turn-window canvas")).toHaveCount(1);
  await expect(stage).toHaveCount(0);
  await page.locator(".book-surface").evaluate((el) => {
    const secret = document.createElement("input");
    secret.type = "password";
    secret.value = "test-private";
    el.append(secret);
  });
  await chapter(page, "survey");
  await expect(page).toHaveURL(/#\/survey$/);
  await expect(stage).toHaveCount(0);
});
