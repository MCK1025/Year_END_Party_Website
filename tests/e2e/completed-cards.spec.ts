import { expect, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";

test("card failures can be retried, empty collections are explained and cached data follows publication revision", async ({
  page,
}) => {
  const state = { revision: 1, paused: false };
  await fixture(page, state, { phase: "COMPLETED" });
  let requests = 0;
  let reject = true;
  let items: object[] = [];
  await page.route("**/functions/v1/portal", async (route) => {
    if (route.request().postDataJSON().action !== "taste_cards") return route.fallback();
    requests++;
    if (reject) return route.fulfill({ status: 503, json: { error: "연결을 다시 확인해주세요." } });
    return route.fulfill({ json: { revision: state.revision, cards: items } });
  });
  await page.goto("/#/event");
  await expect(page).toHaveURL(/#\/afterparty$/);
  await page.getByRole("link", { name: /혜성식품 인물 카드/ }).click();
  await expect(page.getByRole("alert")).toHaveText("연결을 다시 확인해주세요.");
  reject = false;
  await page.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(page.getByText(/공개된 인물 카드가 아직 없습니다/)).toBeVisible();
  expect(requests).toBe(2);
  items = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "가상 하나",
      department: "기획팀",
      answers: [
        {
          id: "dream",
          question: "어릴 적 꿈은?",
          answer: "이 문장은 저장한 원문입니다.\n  줄바꿈도 보존합니다.",
        },
      ],
    },
  ];
  state.revision++;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".taste-card")).toContainText("이 문장은 저장한 원문입니다.");
  expect(requests).toBe(3);
  await page.getByRole("link", { name: "자유 관람 홈으로", exact: true }).click();
  await page.getByRole("link", { name: /혜성식품 인물 카드/ }).click();
  await expect(page.locator(".taste-card")).toBeVisible();
  expect(requests).toBe(3);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".taste-card")).toHaveCSS("animation-name", "none");
  items = [];
  state.revision++;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".taste-card")).toHaveCount(0);
  await expect(page.getByText(/공개된 인물 카드가 아직 없습니다/)).toBeVisible();
});
