import { expect, test } from "@playwright/test";

test("first visit, animated reading, departure, same-tab return and explicit replay", async ({ page }) => {
  const errors: string[] = [];
  const api: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/auth\/|\/functions\/|\/rest\//.test(r.url())) api.push(r.url());
  });
  await page.goto("/#/login");
  await expect(page).toHaveURL(/#\/invite$/);
  await expect(
    page.locator(".invite-top").getByText("2026 혜성식품 송년의 밤", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".invite-message > h1")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "바로 입장하기" })).toBeVisible();
  await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "reading", { timeout: 12000 });
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "webgl");
  await expect(page.locator(".heart-ink")).toHaveCSS("animation-name", "heart-handwriting");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "한 걸음 더 가까워진, 그리고 가까워질 우리.",
  );
  expect(api).toEqual([]);
  const canvas = page.locator("canvas");
  // The stationary canvas sits behind an independently animated HTML letter.
  const canvasFrame = () => canvas.screenshot({ style: ".letter-heart { opacity: 0 !important }" });
  const still = await canvasFrame();
  await page.waitForTimeout(200); // Observe that reading produces no additional rendered movement.
  expect((await canvasFrame()).equals(still)).toBe(true);
  await page.getByRole("button", { name: "행사장으로 가기" }).click();
  await expect(page).toHaveURL(/#\/login$/, { timeout: 3000 });
  await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
  await expect(page.locator("#content")).toBeFocused();
  await page.reload();
  await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "초대장 다시 보기" }).click();
  await expect(page).toHaveURL(/#\/invite$/);
  await page.getByRole("button", { name: "바로 입장하기" }).click();
  await expect(page).toHaveURL(/#\/login$/);
  expect(errors).toEqual([]);
});

test("the pen draws, rests, glints, fades and draws again within the message", async ({ page }) => {
  await page.goto("/#/invite");
  const heart = page.locator(".letter-heart");
  await expect(heart).toHaveCount(0);
  await expect(heart).toBeVisible({ timeout: 12000 });
  const frame = (fraction: number) =>
    heart.evaluate((svg, time) => {
      for (const a of svg.getAnimations({ subtree: true })) {
        a.pause();
        a.currentTime = time * Number(a.effect?.getTiming().duration);
      }
      const ink = svg.querySelector(".heart-ink");
      const glint = svg.querySelector(".heart-glint");
      if (!ink || !glint) throw new Error("Missing invitation decoration");
      const style = getComputedStyle(ink);
      return {
        opacity: Number(style.opacity),
        offset: parseFloat(style.strokeDashoffset),
        glint: Number(getComputedStyle(glint).opacity),
      };
    }, fraction);
  expect((await frame(0.02)).opacity).toBe(0);
  const partial = await frame(0.2);
  expect(partial.offset).toBeGreaterThan(0);
  expect(partial.offset).toBeLessThan(1);
  const held = await frame(0.44);
  expect(held.offset).toBe(0);
  expect(held.opacity).toBeGreaterThan(0.5);
  expect(held.opacity).toBeLessThan(0.75);
  expect(held.glint).toBe(0);
  expect((await frame(0.56)).glint).toBeGreaterThan(0.5);
  const fading = await frame(0.74);
  expect(fading.opacity).toBeGreaterThan(0);
  expect(fading.opacity).toBeLessThan(held.opacity);
  expect((await frame(0.91)).opacity).toBe(0);
  expect(await frame(1.2)).toEqual(partial);
  await frame(1.44);
  for (const width of [320, 360, 375, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const continuous = await heart.locator(".heart-ink").evaluate((path) => {
      if (!(path instanceof SVGPathElement)) return false;
      const length = path.getTotalLength();
      return Array.from({ length: 201 }, (_, i) => path.getPointAtLength((i / 200) * length)).every((point) =>
        path.isPointInStroke(point),
      );
    });
    expect(continuous, `full continuous stroke at ${width}px`).toBe(true);
    const rect = await heart.boundingBox();
    const cta = await page.getByRole("button", { name: "행사장으로 가기" }).boundingBox();
    if (!rect || !cta) throw new Error("Missing letter layout");
    expect(rect.width).toBeGreaterThan(width < 768 ? width * 0.7 : 350);
    expect(rect.y + rect.height).toBeLessThanOrEqual(cta.y);
  }
  await page.getByText("보기 설정", { exact: true }).click();
  const stop = page.getByRole("checkbox", { name: "페이지 효과 끄기" });
  await stop.check();
  const animations = () => heart.evaluate((s) => s.getAnimations({ subtree: true }).length);
  expect(await animations()).toBe(0);
  await stop.uncheck();
  expect(await animations()).toBe(3);
});

test("reduced motion, blocked storage, root and replay remain usable without loading the engine", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  const graphics: string[] = [];
  page.on("request", (r) => {
    if (/assets\/(invitation|service|christmas)-/.test(r.url()) && r.resourceType() === "script")
      graphics.push(r.url());
  });
  await page.goto("/");
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "static");
  await expect(page.locator(".heart-ink")).toBeVisible();
  await expect(page.locator(".heart-ink")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".envelope-seal")).toBeHidden();
  await page.getByRole("button", { name: "행사장으로 가기" }).click();
  await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
  await page.goto("/#/invite");
  await page.getByRole("button", { name: "바로 입장하기" }).click();
  await expect(page).toHaveURL(/#\/login$/);
  expect(graphics).toEqual([]);
});

test("late preparation cannot restart graphics after lightweight fallback; direct admin is ungated", async ({
  page,
}) => {
  await page.route(/assets\/invitation-.*\.js/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3500));
    await route.continue();
  });
  await page.goto("/#/invite");
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "simple", { timeout: 4400 });
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "reading");
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByText("보기 설정", { exact: true }).click();
  await page.getByRole("checkbox", { name: "페이지 효과 끄기" }).check();
  await expect(page.locator(".heart-ink")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".heart-ink")).toBeVisible();
  await page.getByRole("button", { name: "행사장으로 가기" }).click();
  await expect(page).toHaveURL(/#\/login$/);
  await page.goto("/#/admin");
  await expect(page.getByLabel("관리자 이메일")).toBeVisible();
  await expect(page.locator(".invite-page")).toHaveCount(0);
});

test("context loss and changed motion preference preserve the full letter", async ({ page }) => {
  await page.goto("/#/invite");
  await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "reading", { timeout: 12000 });
  await page.locator("canvas").evaluate((canvas) => {
    if (canvas instanceof HTMLCanvasElement)
      canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "static");
  await expect(page.getByRole("button", { name: "행사장으로 가기" })).toBeVisible();
  await page.reload();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "static");
  await page.getByRole("button", { name: "행사장으로 가기" }).click();
  await expect(page).toHaveURL(/#\/login$/);
});

test("departure removes the heart and replay starts one fresh set of animations", async ({ page }) => {
  await page.goto("/#/invite");
  const heart = page.locator(".letter-heart");
  await expect(heart).toBeVisible({ timeout: 12000 });
  const previous = await heart.evaluateHandle((el) => el.getAnimations({ subtree: true }));
  const enter = page.getByRole("button", { name: "행사장으로 가기" });
  await enter.focus();
  await expect(enter).toBeFocused();
  await page.getByRole("button", { name: "행사장으로 가기" }).click();
  await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "departing");
  await expect(heart).toHaveCount(0);
  await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
  expect(await previous.evaluate((items) => items.every((a) => a.playState === "idle"))).toBe(true);
  await page.getByRole("link", { name: "초대장 다시 보기" }).click();
  await expect(heart).toBeVisible({ timeout: 12000 });
  expect(await heart.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(3);
});
