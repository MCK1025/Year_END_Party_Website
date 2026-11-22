import { devices, expect, type Page, test } from "@playwright/test";
import { albumOf, type Moment } from "../../src/components/recap/model";
import { fixture } from "./notebook-fixture";

const rows: Moment[] = [1, 2].map((n) => ({
  id: `11111111-1111-4111-8111-11111111111${n}`,
  caption: `테스트 장 ${n}`,
  sort_order: n,
  published: true,
  asset_path: null,
  album: {
    ...albumOf(),
    cover_path: n === 1 ? "cover.png" : null,
    slides:
      n === 1
        ? [1, 2].map((i) => ({
            id: `22222222-2222-4222-8222-22222222222${i}`,
            asset_path: `detail${i}.png`,
            description: `설명 ${i}`,
            title: `사진 ${i}`,
            date: "2026-01-01",
          }))
        : [],
  },
}));
async function setup(page: Page) {
  const updates = { revision: 1, paused: false };
  const options: { phase: "RECAP" | "END" } = { phase: "RECAP" };
  await fixture(page, updates, options);
  let contents = rows;
  await page.route("**/functions/v1/portal", (r) =>
    r.request().postDataJSON().action === "recaps" ? r.fulfill({ json: contents }) : r.fallback(),
  );
  const requests: string[] = [];
  await page.route("**/storage/v1/object/sign/event-media/*", (r) => {
    const path = new URL(r.request().url()).pathname.split("/").pop() ?? "";
    requests.push(path);
    return r.fulfill({ json: { signedURL: `/object/sign/event-media/${path}?token=test` } });
  });
  await page.route("**/storage/v1/object/sign/event-media/*?token=test", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#a2c4b9"/><path d="M0 360 L280 125 L420 270 L510 200 L640 360" fill="#54776a"/><circle cx="500" cy="90" r="28" fill="#f2deab"/></svg>',
    }),
  );
  return {
    requests,
    refresh: async (next: Moment[] = contents) => {
      contents = next;
      updates.revision++;
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
    },
    end: async () => {
      options.phase = "END";
      updates.revision++;
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
    },
  };
}
const album = (page: Page) => page.getByRole("region", { name: "1년 회고", exact: true });
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
  await view
    .locator(".album-stage")
    .dispatchEvent("pointerdown", { pointerId: 3, isPrimary: true, button: 0, clientX: 270, clientY: 110 });
  await view
    .locator(".album-stage")
    .dispatchEvent("pointerup", { pointerId: 3, isPrimary: true, button: 0, clientX: 60, clientY: 114 });
  await expect(view.getByRole("heading", { name: "사진 2" })).toBeVisible();
  await page.reload();
  await expect(view.getByRole("heading", { name: "사진 2" })).toBeVisible();
  await expect(view.locator(".album-hardback")).toHaveCount(0);
  await feed.refresh([rows[1], rows[0]].flatMap((r, i) => (r ? [{ ...r, sort_order: i }] : [])));
  await expect(view.locator(".album-heading")).toContainText("MOMENT 02");
  await expect(view.locator(".album-controls")).toContainText("4 / 4");
  await expect(view.getByRole("button", { name: /다음/ })).toBeDisabled();
  await view.getByRole("button", { name: /이전/ }).click();
  await expect(view.getByRole("heading", { name: "사진 1" })).toBeVisible();
  await expect.poll(() => view.locator(".album-page").evaluate((e) => e.getAnimations().length)).toBe(0);
  await view.screenshot({ path: `${evidence}/detail.png` });
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
  } finally {
    await context.close();
  }
});
