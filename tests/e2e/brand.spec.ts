import { expect, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";

test("the waiting room shows only the company wordmark", async ({ page }) => {
  await fixture(page, undefined, { phase: "WAITING" });
  await page.goto("/#/event");
  const cover = page.locator(".event-cover");
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const img = cover.getByRole("img", { name: "주식회사 혜성식품" });
    await expect(img).toBeVisible();
    await expect
      .poll(() => img.evaluate((el) => el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0))
      .toBe(true);
    await expect(cover.getByRole("img")).toHaveCount(1);
    await expect(cover.getByText("혜성식품의 상품 브랜드")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await cover.screenshot({ path: `artifacts/screens/brand/lobby-${width}.png` });
  }
});

test("an uploaded company logo takes precedence over the default wordmark", async ({ page }) => {
  await fixture(page, undefined, { phase: "WAITING", logoPath: "logo/test.png" });
  await page.route("**/storage/v1/object/sign/event-media/**", (route) =>
    route.fulfill({ json: { signedURL: "/object/sign/event-media/logo/test.png?token=fixture" } }),
  );
  await page.route("**/object/sign/event-media/logo/test.png?token=fixture", (route) =>
    route.fulfill({ path: "src/assets/brand/hyeseong-foods.png", contentType: "image/png" }),
  );
  await page.goto("/#/event");
  await expect(page.getByRole("img", { name: "회사 로고", exact: true })).toHaveAttribute(
    "src",
    /logo\/test\.png/,
  );
  await expect(page.getByRole("img", { name: "마세로" })).toHaveCount(0);
});
