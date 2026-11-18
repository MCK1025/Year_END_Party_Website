import { expect, type Page, test } from "@playwright/test";
import { z } from "zod";
import type { Dashboard } from "../../supabase/functions/_shared/contracts";

const adminId = "11111111-1111-4111-8111-111111111111";
const portalRequest = z.object({
  action: z.string(),
  payload: z.record(z.string(), z.unknown()),
});
const commandRequest = z.object({ command: z.string(), revision: z.number().int() });

async function completedAdmin(page: Page, rejectRestart = false) {
  const data: Dashboard = {
    settings: {
      enabled: true,
      require_admin_mfa: false,
      event_start_at: "2026-11-18T09:00:00Z",
      started_at: "2026-11-18T09:00:00Z",
      deletion_date: null,
      survey_open: false,
      nomination_open: false,
      welcome: "가상 행사를 기다립니다.",
      ending: "함께해 주셔서 고맙습니다.",
      logo_path: null,
    },
    employees: [],
    surveys: [],
    nominations: [],
    reviews: [],
    questions: [],
    rounds: [],
    tastes: [],
    recaps: [],
    winners: [],
    card_reviews: [],
    logs: [],
    rehearsal: null,
    state: {
      phase: "COMPLETED",
      paused: false,
      revision: 10,
      editing_locked: true,
      tree_open: true,
      payload: {},
    },
  };
  const commands: z.infer<typeof commandRequest>[] = [];
  const user = {
    id: adminId,
    aud: "authenticated",
    role: "authenticated",
    email: "organizer@example.invalid",
    is_anonymous: false,
    app_metadata: {},
    user_metadata: {},
    factors: [],
    created_at: "2026-11-18T00:00:00Z",
  };
  const payload = Buffer.from(
    JSON.stringify({ sub: adminId, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  await page.route("**/auth/v1/**", (route) =>
    route.fulfill({
      json: route.request().url().includes("/token")
        ? {
            access_token: `e30.${payload}.fixture`,
            refresh_token: "local-fixture-refresh",
            token_type: "bearer",
            expires_in: 3600,
            user,
          }
        : user,
    }),
  );
  await page.route("**/functions/v1/portal", (route) => {
    const request = portalRequest.parse(route.request().postDataJSON());
    if (request.action === "dashboard") return route.fulfill({ json: data });
    expect(request.action).toBe("command");
    const command = commandRequest.parse(request.payload);
    commands.push(command);
    expect(command.command).toBe("restart_event");
    if (rejectRestart)
      return route.fulfill({ status: 503, json: { error: "연결을 확인하고 다시 시도해주세요." } });
    data.state = {
      ...data.state,
      phase: "WAITING",
      payload: {},
      paused: false,
      tree_open: false,
      revision: data.state.revision + 1,
    };
    return route.fulfill({ json: data.state });
  });
  await page.goto("/#/admin");
  await page.getByLabel("관리자 이메일").fill(user.email);
  await page.getByLabel("비밀번호", { exact: true }).fill("local-fixture-password");
  await page.getByRole("button", { name: "운영 화면으로" }).click();
  await expect(page.getByText(/자유 관람 · REV 10/)).toBeVisible();
  return { commands, data };
}

for (const width of [390, 768, 1280]) {
  test(`completed event can restart without deleting responses at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const { commands, data } = await completedAdmin(page);
    const restart = page.getByRole("button", { name: "처음부터 다시 진행", exact: true });
    await expect(restart).toBeEnabled();
    await restart.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/설문|답변/);
    await expect(dialog).toContainText(/추천/);
    await expect(dialog).toContainText(/유지|보존/);
    await expect(dialog).toContainText(/마감|잠금|수정/);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/screens/afterparty-restart/confirm-${width}.png` });
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(commands).toEqual([]);
    expect(data.state.phase).toBe("COMPLETED");

    await restart.click();
    await dialog.getByRole("button", { name: "확인", exact: true }).click();
    await expect(page.getByText(/대기실 · REV 11/)).toBeVisible();
    expect(commands).toEqual([{ command: "restart_event", revision: 10 }]);
    expect(data.state.editing_locked).toBe(true);
    expect(data.settings.started_at).toBe("2026-11-18T09:00:00Z");
    const next = page.getByRole("button", { name: "다음 순서 · 1년의 장면들", exact: true });
    await expect(next).toBeEnabled();
    await expect(page.getByText(/직원의 설문·추천·이야기 트리 작성과 수정은 마감/)).toBeVisible();
    await next.focus();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator(".skip-link")).toHaveCSS("top", "-100px");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `artifacts/screens/afterparty-restart/restarted-${width}.png`,
      fullPage: true,
    });
  });
}

test("failed restart preserves the completed screen and exposes the error", async ({ page }) => {
  const { commands, data } = await completedAdmin(page, true);
  await page.getByRole("button", { name: "처음부터 다시 진행", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
  await expect(page).toHaveURL(/#\/admin$/);
  await expect(page.getByRole("alert")).toContainText("연결을 확인하고 다시 시도해주세요.");
  await expect(page.getByText(/자유 관람 · REV 10/)).toBeVisible();
  expect(commands).toEqual([{ command: "restart_event", revision: 10 }]);
  expect(data.state.phase).toBe("COMPLETED");
  expect(data.state.revision).toBe(10);
  await expect(page.getByRole("button", { name: "다음 순서 · 1년의 장면들", exact: true })).toHaveCount(0);
});
