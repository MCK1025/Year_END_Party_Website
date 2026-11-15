import { expect, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";

for (const from of ["nominate", "event"]) {
  test(`turns into and out of the story editor while its private list loads, from ${from}`, async ({
    page,
  }) => {
    await fixture(page);
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/functions/v1/portal", async (route) => {
      if (route.request().postDataJSON().action !== "forest_mine") return route.fallback();
      await held;
      await route.fulfill({ json: [] });
    });
    try {
      await page.goto(`/?motionDebug=1#/${from}`);
      await page.locator(".book-surface").waitFor();
      await page.locator('.book-index a[href="#/forest"]').click();
      await expect(page.locator(".curl-stage")).toHaveAttribute("data-mode", /dom|webgl/);
      await expect(page.locator(".curl-stage")).toHaveCount(0);
      await page.locator(`.book-index a[href="#/${from}"]`).click();
      await expect(page.locator(".curl-stage")).toHaveAttribute("data-mode", /dom|webgl/);
    } finally {
      release();
    }
  });
}
