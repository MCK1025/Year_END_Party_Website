import { expect, type Page, test } from "@playwright/test";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { forestListSchema } from "../../supabase/functions/_shared/forest";
import { admin, call, dashboard, employee, env, signAdmin } from "../integration/helpers";
import { localDatabase } from "./local-db";

async function capture(page: Page, name: string) {
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await document.fonts.ready;
  });
  await page.screenshot({
    path: `artifacts/screens/story-reschedule/${name}.png`,
    fullPage: (await page.getByRole("dialog").count()) === 0,
  });
}

test("a postponed event lets employees create and manage stories, then closes all writes at its deadline", async ({
  page,
  browser,
  baseURL,
}) => {
  if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1") throw new Error("Local preview required");
  const sql = localDatabase();
  await signAdmin();
  const original = (await dashboard()).settings;
  const owner = await employee(0);
  const mobile = await browser.newContext({
    baseURL,
    viewport: { width: 375, height: 900 },
    reducedMotion: "reduce",
  });
  try {
    await sql`delete from public.forest_posts`;
    await sql`delete from private.forest_limits`;
    await sql`update private.settings set started_at=null,enabled=true,survey_open=false,nomination_open=false,forest_multiple=true,
      event_start_at=now()-interval '1 hour' where id`;
    const first = "가상 이야기: 함께 도와주셔서 감사합니다.";
    const second = "가상 이야기: 다음에도 따뜻한 송년회를 부탁드립니다.";
    for (const body of [first, second])
      await call(owner, { action: "forest_post", payload: { kind: "thanks", body } }, okSchema);
    await sql`update private.settings set started_at=now() where id`;
    await sql`update public.event_public_state set phase='COMPLETED',payload='{}',tree_open=false,revision=revision+1 where id`;
    const session = (await owner.auth.getSession()).data.session;
    if (!session) throw new Error("Missing local employee session");
    await mobile.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: `sb-${new URL(env.SUPABASE_URL).hostname.split(".")[0]}-auth-token`,
      value: JSON.stringify(session),
    });
    const guest = await mobile.newPage();
    await guest.goto("/#/afterparty");
    await expect(guest.locator(".book-status")).toContainText("실시간 연결됨");

    await page.goto("/#/admin");
    await page.getByLabel("관리자 이메일").fill(env.ADMIN_EMAIL);
    await page.getByLabel("비밀번호", { exact: true }).fill(env.ADMIN_PASSWORD);
    await page.getByRole("button", { name: "운영 화면으로" }).click();
    await page.getByRole("button", { name: "설정·내보내기" }).click();
    await page.getByLabel("행사일", { exact: true }).fill("2027-01-02");
    await page.getByLabel("행사 시작 시각 (한국시간)").fill("00:07");
    await expect(page.getByLabel("설문 수정 허용")).not.toBeChecked();
    await expect(page.getByLabel("동료 추천·변경 허용")).not.toBeChecked();
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("button", { name: "설정 저장" }).focus();
      await capture(page, `settings-${width}`);
      await page.getByRole("button", { name: "설정 저장" }).click();
      await capture(page, `settings-confirm-${width}`);
      if (width === 1280)
        await page.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
      else await page.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
    }
    await expect(guest).toHaveURL(/#\/event$/, { timeout: 10000 });
    await guest.getByRole("link", { name: "이야기 트리", exact: true }).click();
    await expect(guest.getByRole("button", { name: "내 글 수정하기" })).toHaveCount(2);
    await expect(guest.getByRole("button", { name: "익명으로 마음 남기기" })).toBeVisible();
    const created = "가상 이야기: 일정을 변경한 뒤 새로 남기는 첫 마음입니다.";
    await guest.getByLabel("혜성식품에게 전하고 싶은 말").fill(created);
    for (const width of [375, 768, 1280]) {
      await guest.setViewportSize({ width, height: 900 });
      await guest.getByRole("button", { name: "다시 확인", exact: true }).focus();
      await capture(guest, `open-${width}`);
    }
    await guest.getByRole("button", { name: "익명으로 마음 남기기" }).click();
    await expect(guest.getByText(created, { exact: true })).toBeVisible();
    await guest.reload();
    await expect(guest.getByText(created, { exact: true })).toBeVisible();
    await guest.setViewportSize({ width: 375, height: 900 });
    await guest
      .getByText(first, { exact: true })
      .locator("..")
      .getByRole("button", { name: "내 글 수정하기" })
      .click();
    const edited = "가상 이야기: 변경된 일정 전에 다시 전하는 고마운 마음입니다.";
    await guest
      .locator("form")
      .filter({ has: guest.getByRole("button", { name: "내 글 수정 저장" }) })
      .getByLabel("혜성식품에게 전하고 싶은 말")
      .fill(edited);
    await capture(guest, "editing-375");
    await guest.getByRole("button", { name: "내 글 수정 저장" }).click();
    await expect(guest.getByText(edited, { exact: true })).toBeVisible();
    await guest.reload();
    await expect(guest.getByText(edited, { exact: true })).toBeVisible();
    const remove = () =>
      guest
        .getByText(edited, { exact: true })
        .locator("..")
        .getByRole("button", { name: "내 글 삭제하기" })
        .click();
    await remove();
    await capture(guest, "delete-375");
    await guest.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
    await expect(guest.getByText(edited, { exact: true })).toBeVisible();
    await remove();
    await guest.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
    await expect(guest.getByText(edited, { exact: true })).toHaveCount(0);
    await guest.reload();
    await expect(guest.getByText(second, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "실시간 진행", exact: true }).click();
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("button", { name: "새로고침", exact: true }).focus();
      await capture(page, `progress-${width}`);
    }
    await call(
      admin,
      {
        action: "settings",
        payload: {
          ...(await dashboard()).settings,
          event_start_at: new Date(Date.now() + 8000).toISOString(),
        },
      },
      okSchema,
    );
    await guest
      .getByText(second, { exact: true })
      .locator("..")
      .getByRole("button", { name: "내 글 삭제하기" })
      .click();
    await expect(guest.getByRole("dialog")).toBeVisible();
    await expect(guest.getByRole("dialog")).toHaveCount(0, { timeout: 15000 });
    await expect(guest.getByRole("button", { name: "내 글 수정하기" })).toHaveCount(0);
    await expect(guest.getByRole("button", { name: "내 글 삭제하기" })).toHaveCount(0);
    await expect(guest.getByRole("button", { name: "익명으로 마음 남기기" })).toHaveCount(0);
    await capture(guest, "closed-375");
    expect(await call(owner, { action: "forest_mine", payload: {} }, forestListSchema)).toContainEqual(
      expect.objectContaining({ body: second }),
    );
  } finally {
    await mobile.close();
    await owner.auth.signOut();
    await sql`update private.settings set started_at=${original.started_at} where id`;
    await call(
      admin,
      { action: "settings", payload: { ...original, survey_open: false, nomination_open: false } },
      okSchema,
    );
    await call(admin, { action: "forest_policy", payload: { multiple: original.forest_multiple } }, okSchema);
    await sql.end();
  }
});
