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
  await expect(page.locator(".invite-letter > h1:first-child")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "바로 입장하기" })).toBeVisible();
  await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "reading", { timeout: 12000 });
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "webgl");
  const foil = page.locator(".heart-foil");
  const halo = page.locator(".heart-halo");
  await expect(foil).toHaveAttribute("d", /Z$/);
  await expect(foil).toHaveCSS("stroke-dasharray", "none");
  await expect(halo).toHaveCSS("animation-name", "letter-lamplight");
  const brightness = () => halo.evaluate((light) => getComputedStyle(light).opacity);
  const initialBrightness = await brightness();
  await expect.poll(brightness).not.toBe(initialBrightness);
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

test("the whole heart is drawn once and stays closed across screen sizes as its glow changes", async ({
  page,
}) => {
  await page.goto("/#/invite");
  const heart = page.locator(".letter-heart");
  const foil = page.locator(".heart-foil");
  await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "reading");
  await expect
    .poll(() => foil.evaluate((p) => Number.parseFloat(getComputedStyle(p).strokeDashoffset)))
    .toBeGreaterThan(0);
  await expect(heart).toHaveAttribute("data-lamplight", "true");
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(foil).toHaveCSS("stroke-dasharray", "none");
    const continuous = await foil.evaluate((path) => {
      if (!(path instanceof SVGPathElement)) return false;
      const length = path.getTotalLength();
      return Array.from({ length: 201 }, (_, i) => path.getPointAtLength((i / 200) * length)).every((point) =>
        path.isPointInStroke(point),
      );
    });
    expect(continuous, `full continuous outline at ${width}px`).toBe(true);
  }
  await page.getByText("보기 설정", { exact: true }).click();
  const stop = page.getByRole("checkbox", { name: "페이지 효과 끄기" });
  await stop.check();
  await stop.uncheck();
  await expect(foil).toHaveCSS("stroke-dasharray", "none");
  expect(await foil.evaluate((p) => p.getAnimations().length)).toBe(0);
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
  await expect(page.locator(".heart-foil")).toBeVisible();
  await expect(page.locator(".heart-halo")).toHaveCSS("animation-name", "none");
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
  await expect(page.locator(".heart-halo")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".heart-foil")).toBeVisible();
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

test("the full letter and solid heart remain available if the browser refuses to animate the stroke", async ({
  page,
}) => {
  await page.addInitScript(() => {
    SVGPathElement.prototype.animate = () => {
      throw new DOMException("Unsupported stroke", "NotSupportedError");
    };
  });
  await page.goto("/#/invite");
  await expect(page.locator(".letter-heart")).toHaveAttribute("data-lamplight", "true", { timeout: 12000 });
  await expect(page.locator(".heart-foil")).toHaveCSS("stroke-dasharray", "none");
  await page.getByRole("button", { name: "행사장으로 가기" }).click();
  await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
});
