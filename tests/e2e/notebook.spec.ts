import { mkdir, writeFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { openLogin } from "./invitation-helper";

const id = "11111111-1111-4111-8111-111111111111";
const person = { id, name: "가상 직원", department: "시험", active: true };
async function fixture(page: Page) {
  let rejectRefresh = false;
  await page.route("**/functions/v1/portal", async (route) => {
    const { action } = route.request().postDataJSON();
    if (action === "save_survey") {
      rejectRefresh = true;
      return route.fulfill({ json: { ok: true } });
    }
    if (action === "bootstrap" && rejectRefresh)
      return route.fulfill({ status: 503, json: { error: "저장 결과 확인 연결 오류" } });
    const json =
      action === "bootstrap"
        ? {
            self: person,
            directory: [person, { ...person, id: "22222222-2222-4222-8222-222222222222", name: "가상 동료" }],
            questions: [
              { id: "dream", prompt: "어릴 적 나의 꿈은?", choices: [], sort_order: 1, active: true },
            ],
            survey: null,
            nomination: null,
            server_time: new Date().toISOString(),
            settings: {
              event_start_at: null,
              deletion_date: null,
              survey_open: true,
              nomination_open: true,
              welcome: "함께하는 겨울",
              logo_path: null,
            },
            state: {
              phase: "WHO_AM_I",
              revision: 1,
              paused: false,
              payload: { round_id: id, round_index: 1, hints: ["어릴 때는 별을 세는 사람이 되고 싶었어요."] },
            },
          }
        : action === "forest_mine"
          ? [{ id: 1, kind: "thanks", body: "올 한 해도 함께해 주셔서 고맙습니다.", day: "2026-11-14" }]
          : { ok: true };
    return route.fulfill({ json });
  });
}
async function capture(page: Page, state: string, readAt?: string) {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await page.evaluate(async () => {
      scrollTo(0, 0);
      await document.fonts.ready;
      await Promise.allSettled(
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished),
      );
    });
    if (readAt) await page.locator(readAt).first().scrollIntoViewIfNeeded();
    await expect(page.locator(".book-turn[data-turn]")).toHaveCount(0);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/screens/notebook/${state}-${width}.png` });
  }
}
test("one active employee page preserves writing across chapters, history, font changes and failed save refresh", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/#/survey");
  const story = page.getByLabel("어릴 적 나의 꿈은?");
  const text = "우주를 보고 싶어요.\n똠 뷁 ㅋㅠ ABC 2026 🙂";
  await story.fill(text);
  await page.getByRole("checkbox", { name: /내 답변을/ }).check();
  await capture(page, "survey");
  await page.getByRole("link", { name: /다음 장/ }).click();
  await expect(page.locator(".book-turn")).toHaveAttribute("data-turn", "forward");
  await page.getByLabel("고마운 이유 (10자 이상)").fill("한 해 동안 도움을 많이 받았어요.");
  await page.getByRole("link", { name: /이전 장/ }).click();
  await expect(page.locator(".book-turn")).toHaveAttribute("data-turn", "backward");
  await expect(story).toHaveValue(text);
  await page.locator(".book-settings summary").click();
  await page.getByLabel("글씨", { exact: true }).selectOption("ui");
  await page.locator(".book-settings summary").click();
  await expect(story).toHaveValue(text);
  await expect(page.getByRole("checkbox", { name: /내 답변을/ })).toBeChecked();
  await capture(page, "system");
  await page.goBack();
  await expect(page.getByLabel("고마운 이유 (10자 이상)")).toHaveValue("한 해 동안 도움을 많이 받았어요.");
  await page.goForward();
  await page.getByRole("button", { name: "이야기 저장하고 다음으로" }).click();
  await expect(page.getByRole("alert").first()).toContainText("저장 결과 확인 연결 오류");
  await expect(page).toHaveURL(/#\/survey$/);
  await expect(story).toHaveValue(text);
});
test("font asset renders Korean, private forest edits survive navigation, hints and reduced motion remain available", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/#/forest");
  const body = page.getByLabel("혜성식품에게 전하고 싶은 말");
  await body.fill("보내기 전의 마음");
  await page.getByRole("button", { name: "내 글 수정하기" }).click();
  await page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "내 글 수정 저장" }) })
    .locator("textarea")
    .fill("수정 중인 글");
  await page.getByRole("link", { name: "행사장", exact: true }).click();
  await expect(page.locator(".hint p")).toHaveText("어릴 때는 별을 세는 사람이 되고 싶었어요.");
  await capture(page, "hint", ".hint p");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: ".hint p" });
  const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  expect(fonts.some((f) => f.isCustomFont && f.glyphCount > 0 && /Nanum/i.test(f.familyName))).toBe(true);
  await mkdir("artifacts/screens/notebook", { recursive: true });
  await writeFile("artifacts/screens/notebook/rendered-font.json", JSON.stringify(fonts, null, 2));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("link", { name: "대나무숲", exact: true }).click();
  await expect(body.first()).toHaveValue("보내기 전의 마음");
  await expect(body.last()).toHaveValue("수정 중인 글");
  await expect(page.locator(".book-turn")).not.toHaveAttribute("data-turn", /.+/);
  await capture(page, "reduced", "form:has(button) textarea");
  await page.getByRole("button", { name: "수정 취소" }).click();
  await expect(page.locator(".story-text")).toHaveText("올 한 해도 함께해 주셔서 고맙습니다.");
  await capture(page, "forest", ".story-text");
});
test("login and editing work with font downloads blocked, small window and zoom", async ({ page }) => {
  await page.route("**/*.woff2", (r) => r.abort());
  await openLogin(page);
  await capture(page, "login-fallback");
  await page.getByLabel("비밀번호", { exact: true }).fill("123456");
  await fixture(page);
  await page.goto("/#/survey");
  for (const width of [320, 375, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 420 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 640, height: 360 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await page.getByLabel("어릴 적 나의 꿈은?").fill("글꼴을 못 받아도 쓸 수 있어요.");
  await page.getByRole("link", { name: /다음 장/ }).click();
  await expect(page.getByLabel("추천할 동료")).toBeVisible();
});
test("invitation to the inside cover retains the six digit login and view preferences", async ({ page }) => {
  await openLogin(page);
  await capture(page, "login");
  await page.getByRole("link", { name: "초대장 다시 보기" }).click();
  await expect(page.getByRole("button", { name: "행사장으로 가기" })).toBeVisible({ timeout: 12000 });
  await capture(page, "invite");
});
