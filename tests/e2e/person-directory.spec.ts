import { expect, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";

test("lists all colleagues and opens only the tapped person's reviewed information", async ({ page }) => {
  // Given: fifty reviewed colleagues, including long Korean text.
  const state = { revision: 1, paused: false };
  await fixture(page, state, { phase: "COMPLETED" });
  const entries = Array.from({ length: 50 }, (_, i) => ({
    id: `11111111-1111-4111-8111-${String(i + 1).padStart(12, "0")}`,
    name: i === 49 ? "이름이아주긴가상직원입니다" : `가상직원${String(i + 1).padStart(2, "0")}`,
    department: i === 49 ? "연구개발팀 선임연구원" : "사원",
    answers: [
      {
        id: "dream",
        question: "어릴 적 나의 꿈은?",
        answer: `별을 보러 가는 사람 ${i + 1}\n${"소중한 가상 이야기. ".repeat(45)}`,
      },
    ],
  }));
  let cards = entries;
  await page.route("**/functions/v1/portal", (route) =>
    route.request().postDataJSON().action === "taste_cards"
      ? route.fulfill({ json: { revision: state.revision, cards } })
      : route.fallback(),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/event");
  await page.getByRole("link", { name: "혜성식품 인물 카드", exact: true }).click();
  // Then: all names are together, while answers wait behind a real button.
  await expect(page.locator(".person-card-button")).toHaveCount(50);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/별을 보러 가는 사람/)).toHaveCount(0);
  const first = page.getByRole("button", { name: "가상직원01 사원", exact: true });
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/screens/person-directory/list-${width}.png`, fullPage: true });
    // When: touch/click a name; Then: a focus-managed, scrollable detail opens.
    await first.click();
    const detail = page.getByRole("dialog", { name: "가상직원01 사원", exact: true });
    await expect(detail).toBeVisible();
    await expect(detail).toContainText("별을 보러 가는 사람 1");
    expect(await detail.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/screens/person-directory/detail-${width}.png` });
    await detail.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(first).toBeFocused();
  }
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Tab");
  expect(await page.getByRole("dialog").evaluate((e) => e.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(first).toBeFocused();
  await first.click();
  await page.mouse.click(4, 4);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("직원 이름 검색").fill("없는사람");
  await expect(page.locator(".person-card-button")).toHaveCount(0);
  await page.getByLabel("직원 이름 검색").fill("가상직원01");
  await expect(page.locator(".person-card-button")).toHaveCount(1);
  await first.click();
  cards = entries.slice(1);
  state.revision++;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/별을 보러 가는 사람 1/)).toHaveCount(0);
});
