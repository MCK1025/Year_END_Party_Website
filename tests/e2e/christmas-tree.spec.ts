import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { admin, call, command, dashboard, employee, env, eventDate, signAdmin } from "../integration/helpers";

const sql = postgres(env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55422/postgres");
async function capture(page: Page, name: string) {
  await page.bringToFront();
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async () => {
      scrollTo(0, 0);
      await document.fonts.ready;
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    });
    await page.getByRole("dialog").evaluateAll(async (dialogs) => {
      await Promise.all(
        dialogs.flatMap((dialog) => dialog.getAnimations().map((animation) => animation.finished)),
      );
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({
      path: `artifacts/screens/christmas-tree/${name}-${width}.png`,
      fullPage: (await page.getByRole("dialog").count()) === 0,
    });
  }
}
async function expectStillCanvas(page: Page) {
  const before = await page.locator("canvas").screenshot();
  await page.waitForTimeout(150);
  expect(await page.locator("canvas").screenshot()).toEqual(before);
}
test.beforeAll(async () => {
  await signAdmin();
  await sql`update private.settings set started_at=null,enabled=true,survey_open=true,nomination_open=true`;
  await command("waiting");
  await eventDate(false);
  await sql`delete from public.forest_posts`;
  await sql`delete from private.forest_limits`;
  await sql`delete from private.login_attempts`;
  await sql`delete from public.nominations`;
  await sql`insert into public.forest_posts(kind,body) select case when n%3=0 then 'regret' when n%3=1 then 'thanks' else 'wish' end,'가상 트리의 마음 '||n||': 함께한 오늘이 참 고맙습니다. 내년에도 서로에게 든든한 동료가 되어주세요.' from generate_series(1,15) n`;
  const c = await employee(0);
  await call(
    c,
    { action: "forest_post", payload: { kind: "thanks", body: "가상 내가 보낸 삭제할 글" } },
    okSchema,
  );
  await c.auth.signOut();
});
test.afterAll(async () => {
  await command("waiting");
  await sql.end();
});
test("owner deletion, ten-character recommendation, reviewed WebGL tree, note zoom and dismissal", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#/login");
  await page.getByLabel("비밀번호", { exact: true }).fill("900101");
  await page.getByRole("button", { name: "우리의 자리로" }).click();
  await page.getByRole("link", { name: "고마운 동료", exact: true }).click();
  const nominee = (await dashboard()).employees.find((p) => p.employee_no === "TEST-002");
  if (!nominee) throw new Error("Missing local employee");
  await page.getByLabel("추천할 동료").selectOption(nominee.id);
  await page.getByLabel("고마운 이유 (10자 이상)").fill("123456789");
  await expect(page.getByRole("button", { name: "마음을 전하고 행사장으로" })).toBeDisabled();
  await capture(page, "reason-short");
  await page.getByLabel("고마운 이유 (10자 이상)").fill("1234567890");
  await expect(page.getByRole("button", { name: "마음을 전하고 행사장으로" })).toBeEnabled();
  await capture(page, "reason-valid");
  await page.getByRole("link", { name: "대나무숲", exact: true }).click();
  await expect(page.getByText("가상 내가 보낸 삭제할 글", { exact: true })).toBeVisible();
  await expect(page.getByText(/가상 트리의 마음/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "모두의 마음" })).toHaveCount(0);
  await capture(page, "forest-own-only");
  await page.getByRole("button", { name: "내 글 삭제하기" }).click();
  await capture(page, "forest-delete-confirm");
  await page.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByText("가상 내가 보낸 삭제할 글", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "내 글 삭제하기" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.getByText("아직 보낸 마음이 없습니다.")).toBeVisible();
  await capture(page, "forest-deleted");
  const organizer = await browser.newPage();
  await organizer.goto("/#/admin");
  await organizer.getByLabel("관리자 이메일").fill(env.ADMIN_EMAIL);
  await organizer.getByLabel("비밀번호", { exact: true }).fill(env.ADMIN_PASSWORD);
  await organizer.getByRole("button", { name: "운영 화면으로" }).click();
  await organizer.getByRole("button", { name: "마음 트리", exact: true }).click();
  await expect(organizer.getByRole("button", { name: "검수한 전체 글로 트리 공개" })).toBeDisabled();
  await expect(organizer.getByRole("button", { name: /쪽지 .* 열기/ })).toHaveCount(12);
  await expect(organizer.locator(".tree-scene")).toHaveAttribute("data-renderer", "webgl", {
    timeout: 15000,
  });
  await capture(organizer, "admin-unpublished");
  const started = await admin.functions.invoke("portal", {
    body: {
      action: "command",
      payload: { command: "start_event", revision: (await dashboard()).state.revision },
    },
  });
  expect(started.error).toBeNull();
  await organizer.getByRole("button", { name: "새로고침", exact: true }).click();
  await organizer.getByLabel("전체 글의 개인정보·비방 내용을 검수했습니다.").check();
  await organizer.getByRole("button", { name: "검수한 전체 글로 트리 공개" }).click();
  await capture(organizer, "admin-publish-confirm");
  await organizer.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
  await page.waitForURL("**/#/tree", { timeout: 15000 });
  await expect(page.getByRole("button", { name: /쪽지 .* 열기/ })).toHaveCount(12);
  await expect(page.locator(".tree-scene")).toHaveAttribute("data-renderer", "webgl", { timeout: 15000 });
  const graphics = await page.locator("canvas").evaluate((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Expected canvas");
    const gl = canvas.getContext("webgl2");
    return (
      gl && {
        width: gl.drawingBufferWidth,
        height: gl.drawingBufferHeight,
        version: gl.getParameter(gl.VERSION),
      }
    );
  });
  expect(graphics?.width).toBeGreaterThan(0);
  expect(graphics?.version).toContain("WebGL 2");
  const reusable = await page.evaluate(async () => {
    const asset = performance
      .getEntriesByType("resource")
      .find((entry) => /\/christmas-[^/]+\.js/.test(entry.name));
    if (!asset) throw new Error("Missing loaded graphics asset");
    const module = await import(asset.name);
    if (typeof module.createChristmasScene !== "function") throw new Error("Missing scene factory");
    const canvas = document.createElement("canvas");
    canvas.style.width = "120px";
    canvas.style.height = "156px";
    document.body.append(canvas);
    let failures = 0;
    try {
      const first = module.createChristmasScene(canvas, () => failures++);
      first.dispose();
      await first.ready;
      first.dispose();
      const second = module.createChristmasScene(canvas, () => failures++);
      await second.ready;
      second.setPaused(true);
      const healthy = canvas.getContext("webgl2")?.isContextLost() === false;
      second.dispose();
      return healthy && failures === 0;
    } finally {
      canvas.remove();
    }
  });
  expect(reusable).toBe(true);
  await capture(page, "tree-published");
  await page.getByRole("button", { name: "효과 멈추기" }).click();
  await capture(page, "tree-paused");
  await expectStillCanvas(page);
  await page.getByRole("button", { name: /쪽지 01 열기/ }).click();
  await expect(page.getByRole("dialog")).toContainText("가상 트리의 마음 15");
  await capture(page, "note-expanded");
  await page.mouse.click(3, 3);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /쪽지 01 열기/ })).toBeFocused();
  await page.getByRole("button", { name: /쪽지 02 열기/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "다음 쪽지들" }).click();
  await expect(page.getByRole("button", { name: /쪽지 .* 열기/ })).toHaveCount(3);
  await capture(page, "tree-next-branch");
  await page.reload();
  await expect(page.getByRole("button", { name: /쪽지 .* 열기/ })).toHaveCount(12);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await capture(page, "tree-reduced-motion");
  await expectStillCanvas(page);
  await page.locator("canvas").evaluate((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Expected canvas");
    canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  await expect(page.locator(".tree-scene")).toHaveAttribute("data-renderer", "fallback");
  await capture(page, "tree-fallback");
  await page.getByRole("button", { name: /쪽지 01 열기/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "트리로 돌아가기" }).click();
  await organizer.getByRole("button", { name: "트리 공개 종료" }).click();
  await organizer.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
  await page.waitForURL("**/#/event", { timeout: 15000 });
  await expect(page.getByRole("link", { name: "마음 트리", exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
  await organizer.close();
});
