import { expect, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";

test("a single-message composer switches to the existing post if another device submits first", async ({
  page,
}) => {
  await fixture(page);
  let submittedElsewhere = false;
  await page.route("**/functions/v1/portal", async (route) => {
    const { action } = route.request().postDataJSON();
    if (action === "forest_mine")
      return route.fulfill({
        json: submittedElsewhere
          ? [{ id: 1, kind: "wish", body: "먼저 도착한 마음", day: "2026-11-24" }]
          : [],
      });
    if (action === "forest_post") {
      submittedElsewhere = true;
      return route.fulfill({ status: 409, json: { error: "이미 마음을 남겼습니다." } });
    }
    return route.fallback();
  });
  await page.goto("/#/forest");
  await page.getByLabel("혜성식품에게 전하고 싶은 말").fill("두 번째 기기의 초안");
  const submit = page.getByRole("button", { name: "익명으로 마음 남기기" });
  await submit.click();
  await expect(page.getByText("먼저 도착한 마음", { exact: true })).toBeVisible();
  await expect(submit).toHaveCount(0);
  await expect(page.getByRole("button", { name: "내 글 수정하기" })).toBeVisible();
});

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
