import { devices, expect, type Page, test } from "@playwright/test";
import { rows, recapFixture as setup } from "./recap-fixture";
import { sampleFold } from "./sample-fold";

const album = (page: Page) => page.getByRole("region", { name: "1년 회고", exact: true });

async function sampleTurn(page: Page, direction: "next" | "previous", capture?: string) {
  const selector = direction === "next" ? ".album-volume > .turn-window" : ".album-volume > .album-page";
  const geometry = await sampleFold(page, selector, direction);
  expect(geometry.hinge).toBeCloseTo(0);
  expect(geometry.depth).toBeGreaterThan(0);
  expect(geometry.closing).toBe(direction === "previous");
  if (capture) await album(page).screenshot({ path: capture });
  await page.locator(selector).evaluate((el) => el.getAnimations()[0]?.finish());
}

test("opens the hardback once, navigates by button and swipe, and restores a stable slide across revisions and reloads", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 750 });
  const feed = await setup(page);
  await page.goto("/#/event");
  const view = album(page);
  await expect(view.locator(".album-hardback")).toBeVisible();
  await expect(view.getByRole("button", { name: "오프닝 건너뛰기" })).toBeInViewport();
  const evidence = `artifacts/screens/recap-album/${info.project.use.browserName ?? "chromium"}`;
  await view.screenshot({ path: `${evidence}/opening.png` });
  await page.waitForFunction(() => {
    const a = document.querySelector(".album-volume")?.getAnimations()[0];
    return Number(a?.currentTime) > 1250;
  });
  await view.screenshot({ path: `${evidence}/leaves.png` });
  await expect(view.locator(".album-hardback")).toHaveCount(0, { timeout: 4500 });
  await expect(view.locator(".album-controls")).toContainText("1 / 4");
  await expect(view.getByRole("button", { name: /이전/ })).toBeDisabled();
  await expect(view.getByRole("button", { name: /다음/ })).toBeInViewport();
  expect(feed.requests).not.toContain("detail2.png");
  await view.screenshot({ path: `${evidence}/cover.png` });
  await view.getByRole("button", { name: /다음/ }).click();
  await expect(view.getByRole("heading", { name: "사진 1" })).toBeVisible();
  await sampleTurn(page, "next", `${evidence}/turn-next.png`);
  await view
    .locator(".album-stage")
    .dispatchEvent("pointerdown", { pointerId: 3, isPrimary: true, button: 0, clientX: 270, clientY: 110 });
  await view
    .locator(".album-stage")
    .dispatchEvent("pointerup", { pointerId: 3, isPrimary: true, button: 0, clientX: 60, clientY: 114 });
  await expect(view.getByRole("heading", { name: "사진 2" })).toBeVisible();
  await sampleTurn(page, "next");
  await page.reload();
  await expect(view.getByRole("heading", { name: "사진 2" })).toBeVisible();
  await expect(view.locator(".album-hardback")).toHaveCount(0);
  await feed.refresh([rows[1], rows[0]].flatMap((r, i) => (r ? [{ ...r, sort_order: i }] : [])));
  await expect(view.locator(".album-heading")).toContainText("MOMENT 02");
  await expect(view.locator(".album-controls")).toContainText("4 / 4");
  await expect(view.getByRole("button", { name: /다음/ })).toBeDisabled();
  await view.getByRole("button", { name: /이전/ }).click();
  await expect(view.getByRole("heading", { name: "사진 1" })).toBeVisible();
  await sampleTurn(page, "previous", `${evidence}/turn-previous.png`);
  await expect.poll(() => view.locator(".album-page").evaluate((e) => e.getAnimations().length)).toBe(0);
  await view.screenshot({ path: `${evidence}/detail.png` });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await view.getByRole("button", { name: /다음/ }).click();
  await expect(view.getByRole("heading", { name: "사진 2" })).toBeVisible();
  expect(await view.locator(".album-page").evaluate((el) => el.getAnimations().length)).toBe(0);
});
test("skip, reduced motion, empty collection, photo retry and realtime stage interruption", async ({
  page,
}) => {
  const feed = await setup(page);
  let imageFails = true;
  await page.route("**/cover.png?token=test", (r) =>
    imageFails ? r.fulfill({ status: 404 }) : r.fallback(),
  );
  await page.goto("/#/event");
  const view = album(page);
  await view.getByRole("button", { name: "오프닝 건너뛰기" }).click();
  await expect(view.locator(".album-hardback")).toHaveCount(0);
  imageFails = false;
  await view.getByRole("button", { name: "사진 다시 시도" }).click();
  await expect
    .poll(() =>
      view
        .locator(".album-image-slot:not([hidden]) img")
        .evaluate((e) => e instanceof HTMLImageElement && e.naturalWidth),
    )
    .toBe(640);
  for (const [width, height] of [
    [320, 568],
    [844, 390],
    [1280, 820],
  ] as const) {
    await page.setViewportSize({ width, height });
    await view.evaluate((e) => e.scrollIntoView());
    await expect(view.getByRole("button", { name: /다음/ })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await feed.refresh([]);
  await expect(page.getByText("첫 번째 Moment를 준비하고 있습니다.")).toBeVisible();
  await feed.refresh(rows);
  await expect(view.getByRole("button", { name: /다음/ })).toBeVisible();
  const clearBookmark = () =>
    page.evaluate(() => {
      for (const key of Object.keys(sessionStorage))
        if (key.startsWith("hyeseong:2026:recap:")) sessionStorage.removeItem(key);
    });
  await clearBookmark();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(view.getByRole("button", { name: /다음/ })).toBeVisible();
  await expect(view.locator(".album-hardback")).toHaveCount(0);
  await clearBookmark();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await expect(view.locator(".album-hardback")).toBeVisible();
  await feed.end();
  await expect(view).toHaveCount(0);
});

test("a long scrolled caption stays on the same lines on the outgoing page", async ({ page }) => {
  const feed = await setup(page);
  await page.goto("/#/event");
  const view = album(page);
  await view.getByRole("button", { name: "오프닝 건너뛰기" }).click();
  const intro = Array.from({ length: 40 }, (_, i) => `회고 문장 ${i + 1}`).join("\n");
  await feed.refresh(
    rows.map((row, i) =>
      row.album && i === 0 ? { ...row, album: { ...row.album, introduction: intro } } : row,
    ),
  );
  const caption = view.locator(".album-page .album-caption");
  await expect(caption).toContainText("회고 문장 40");
  const original = await caption.evaluate((el) => {
    el.scrollTop = 250;
    const paragraph = el.querySelector("p");
    if (!paragraph) throw new Error("Missing caption");
    return paragraph.getBoundingClientRect().top - el.getBoundingClientRect().top;
  });
  expect(original).toBeLessThan(0);
  await view.getByRole("button", { name: /다음/ }).click();
  const origin = await view.locator(".turn-window").evaluate(async (el) => {
    const a = el.getAnimations()[0];
    if (!a) throw new Error("Missing outgoing page");
    a.pause();
    await a.ready;
    a.currentTime = 0;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const copy = el.querySelector(".album-caption");
    const paragraph = copy?.querySelector("p");
    if (!copy || !paragraph) throw new Error("Missing caption");
    return paragraph.getBoundingClientRect().top - copy.getBoundingClientRect().top;
  });
  expect(Math.abs(origin - original)).toBeLessThan(2);
});

test("phone profile keeps navigation reachable and falls back when the opening completion event is missing", async ({
  browser,
  browserName,
  baseURL,
}) => {
  const profile = devices[browserName === "webkit" ? "iPhone 13" : "Pixel 7"];
  if (!profile || !baseURL) throw new Error("Missing mobile test profile");
  const context = await browser.newContext({ ...profile, baseURL, reducedMotion: "no-preference" });
  try {
    const page = await context.newPage();
    await setup(page);
    await page.addInitScript(() =>
      document.addEventListener(
        "animationend",
        (e) => {
          if (e.animationName === "album-unfold") e.stopImmediatePropagation();
        },
        true,
      ),
    );
    await page.goto("/#/event");
    const view = album(page);
    await expect(view.locator(".album-hardback")).toBeVisible();
    const photo = await view.locator(".album-image-slot:not([hidden]) img").elementHandle();
    await expect(view.locator(".album-hardback")).toHaveCount(0, { timeout: 5000 });
    expect(await photo?.evaluate((e) => e.isConnected)).toBe(true);
    await expect(view.getByRole("button", { name: /다음/ })).toBeInViewport({ ratio: 1 });
    await view.getByRole("button", { name: /다음/ }).tap();
    await expect(view.locator(".album-controls")).toContainText("2 / 4");
    await page.evaluate(() => {
      localStorage.setItem("hyeseong:2026:book-view", "still");
      for (const k of Object.keys(sessionStorage))
        if (k.startsWith("hyeseong:2026:recap:")) sessionStorage.removeItem(k);
    });
    await page.reload();
    await expect(view.getByRole("button", { name: /다음/ })).toBeVisible();
    await expect(view.locator(".album-hardback")).toHaveCount(0);
    await view.getByRole("button", { name: /다음/ }).tap();
    await expect(view.getByRole("heading", { name: "사진 1" })).toBeVisible();
    expect(await view.locator(".album-page").evaluate((el) => el.getAnimations().length)).toBe(0);
  } finally {
    await context.close();
  }
});
