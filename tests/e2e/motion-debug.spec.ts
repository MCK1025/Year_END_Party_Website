import { expect, type Page, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";

async function report(page: Page) {
  await page.locator(".book-settings summary").first().click();
  await page.locator(".motion-diagnostics summary").click();
  await page.getByRole("button", { name: "진단 정보 복사" }).click();
  return page.getByRole("textbox", { name: "복사할 진단 정보" }).inputValue();
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("blocked")) },
    }),
  );
});
test("debug and legacy URLs preserve OS policy, copy and clear are private", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?motionDebug=1&forceMotion=1&token=private-input#/invite");
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "static");
  const data = await report(page);
  expect(data).toContain("SYSTEM_REDUCED_MOTION");
  expect(data).not.toContain("private-input");
  await page.getByRole("button", { name: "진단 기록 지우기" }).click();
  await page.getByRole("button", { name: "진단 정보 복사" }).click();
  expect(
    JSON.parse(await page.getByRole("textbox", { name: "복사할 진단 정보" }).inputValue()).events,
  ).toHaveLength(0);
});
test("site still disables only the turn and excludes typed content from the report", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("hyeseong:2026:book-view", "pen:still"));
  await page.goto("/?motionDebug=1#/invite");
  await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "reading", { timeout: 9000 });
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "webgl");
  const invitation = await report(page);
  for (const event of ["IMPORT_END", "INIT_END", "SHADER_READY", "START_REQUESTED", "FIRST_RENDER_RETURNED"])
    expect(invitation).toContain(event);
  await fixture(page);
  await page.goto("/?motionDebug=1#/survey");
  await page.locator("textarea").fill("sensitive-draft-998");
  await page.getByRole("link", { name: /다음 장/ }).click();
  const data = await report(page);
  expect(data).toContain("USER_PAGE_EFFECTS_DISABLED");
  expect(data).not.toContain("sensitive-draft-998");
  expect(data).not.toContain("가상 직원");
});
for (const mode of ["no-waapi", "throw", "hidden", "zero"]) {
  test(`book diagnosis ${mode}`, async ({ page }) => {
    await fixture(page);
    await page.goto("/?motionDebug=1#/survey");
    await page.locator(".book-surface").evaluate((_, kind) => {
      if (kind === "no-waapi") Object.defineProperty(Element.prototype, "animate", { value: undefined });
      if (kind === "throw")
        Object.defineProperty(Element.prototype, "animate", {
          value: () => {
            throw new Error("private-error");
          },
        });
      if (kind === "hidden" || kind === "zero") {
        const style = document.createElement("style");
        style.textContent = `.book-surface:has(.survey-entries){${kind === "hidden" ? "display:none" : "width:0;padding:0"}}`;
        document.head.append(style);
      }
    }, mode);
    await page.getByRole("link", { name: /다음 장/ }).click();
    await expect(page.getByLabel("추천할 동료")).toBeVisible();
    const data = await report(page);
    expect(data).toContain(
      {
        "no-waapi": "WAAPI_UNAVAILABLE",
        throw: "ANIMATION_START_FAILED",
        hidden: "CSS_HIDDEN",
        zero: "ZERO_SIZE",
      }[mode],
    );
    expect(data).not.toContain("private-error");
  });
}
for (const kind of ["import", "context", "shader", "create"]) {
  test(`invitation diagnosis ${kind}`, async ({ page }) => {
    if (kind === "import") await page.route(/assets\/invitation-.*\.js/, (r) => r.abort());
    if (kind === "create")
      await page.addInitScript(() =>
        Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: () => null }),
      );
    if (kind === "shader")
      await page.addInitScript(() => {
        WebGL2RenderingContext.prototype.compileShader = () => {
          throw new Error("secret");
        };
      });
    await page.goto("/?motionDebug=1#/invite");
    if (kind === "context") {
      await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "reading", { timeout: 9000 });
      await page
        .locator("canvas")
        .evaluate(
          (el) =>
            el instanceof HTMLCanvasElement &&
            el.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext(),
        );
    }
    await expect(page.locator(".invite-page")).toHaveAttribute(
      "data-renderer",
      kind === "context" ? "static" : "simple",
    );
    const data = await report(page);
    expect(data).toContain(
      {
        import: "IMPORT_FAILED",
        context: "WEBGL_CONTEXT_LOST",
        shader: "SHADER_PREPARATION_FAILED",
        create: "WEBGL_INIT_FAILED",
      }[kind],
    );
    expect(data).not.toContain("secret");
  });
}
test("a hidden tab does not consume the active preparation deadline", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(document, "hidden", { value: true, configurable: true }),
  );
  let release = () => {};
  const held = new Promise<void>((r) => {
    release = r;
  });
  await page.route(/assets\/invitation-.*\.js/, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/?motionDebug=1#/invite", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3300);
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "webgl");
  release();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "reading", { timeout: 10000 });
  expect(await report(page)).not.toContain("PREPARATION_TIMEOUT");
});
test("low frame rate keeps envelope arrival and departure on active time", async ({ page }) => {
  await page.addInitScript(() => {
    window.requestAnimationFrame = (fn) => window.setTimeout(() => fn(performance.now()), 200);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  });
  await page.goto("/?motionDebug=1#/invite", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "reading", { timeout: 8000 });
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "webgl");
  await page.getByRole("button", { name: "행사장으로 가기" }).evaluate((b) => {
    if (b instanceof HTMLButtonElement) b.click();
  });
  await expect(page).toHaveURL(/#\/login$/, { timeout: 2300 });
  expect(await report(page)).not.toContain("DEPARTURE_TIMEOUT");
});
test("revision alone preserves the active turn, real pause and orientation settle it", async ({ page }) => {
  const updates = { revision: 1, paused: false };
  await fixture(page, updates);
  await page.goto("/?motionDebug=1#/survey");
  await page.getByRole("link", { name: /다음 장/ }).click();
  updates.revision++;
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/functions/v1/portal")),
    page.evaluate(() => dispatchEvent(new Event("online"))),
  ]);
  await expect(page.locator(".curl-stage")).toHaveAttribute("data-turn", "forward");
  updates.revision++;
  updates.paused = true;
  await page.evaluate(() => dispatchEvent(new Event("online")));
  await expect(page.locator(".curl-stage")).toHaveCount(0);
  await page.getByRole("link", { name: /이전 장/ }).click();
  await expect(page.locator(".curl-stage")).toHaveAttribute("data-turn", "backward");
  await page.setViewportSize({ width: 840, height: 390 });
  await expect(page.locator(".curl-stage")).toHaveCount(0);
  const data = await report(page);
  expect(data).toContain("EVENT_STATE_CHANGED");
  expect(data).toContain("VIEWPORT_GEOMETRY_CHANGED");
});
test("restoring motion offers explicit replay without closing the letter", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?motionDebug=1#/invite");
  await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "reading");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "static");
  await page.getByRole("button", { name: "초대장 다시 보기" }).click();
  await expect(page.locator(".invite-page")).toHaveAttribute("data-phase", "reading", { timeout: 9000 });
  await expect(page.locator(".invite-page")).toHaveAttribute("data-renderer", "webgl");
});
