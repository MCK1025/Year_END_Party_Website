import { expect, type Page, test } from "@playwright/test";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { boot, call, dashboard, employee, env, signAdmin } from "../integration/helpers";
import { localDatabase } from "./local-db";

async function capture(page: Page, name: string) {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async () => {
      window.scrollTo(0, 0);
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    expect(
      await page
        .locator(".skip-link")
        .evaluate((e) => !e.matches(":focus") && e.getBoundingClientRect().bottom <= 0),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({
      path: `artifacts/screens/person-directory/${name}-${width}.png`,
      fullPage: true,
    });
  }
}

test("preselects available answers and approvals without saving or publishing on screen open", async ({
  page,
}) => {
  // Given: a saved, unreviewed local survey.
  const sql = localDatabase();
  await signAdmin();
  await sql`update public.event_public_state set phase='WAITING',payload='{}',tree_open=false,revision=revision+1 where id`;
  await sql`update private.settings set enabled=true,started_at=null,survey_open=true,event_start_at=now()-interval '1 hour' where id`;
  await sql`delete from private.login_attempts`;
  await sql`delete from private.rounds`;
  await sql`delete from private.card_reviews`;
  await sql`delete from private.tastes`;
  await sql`delete from public.surveys`;
  const guest = await employee(0);
  try {
    const me = await boot(guest);
    await call(
      guest,
      {
        action: "save_survey",
        payload: {
          answers: Object.fromEntries(me.questions.map((q) => [q.id, `가상 기본선택 ${q.id}`])),
          excluded: [],
        },
      },
      okSchema,
    );
    await page.goto("/#/admin");
    await page.getByLabel("관리자 이메일").fill(env.ADMIN_EMAIL);
    await page.getByLabel("비밀번호", { exact: true }).fill(env.ADMIN_PASSWORD);
    await page.getByRole("button", { name: "운영 화면으로" }).click();
    // When: open each selection form. Then: checkboxes default on, data stays unapproved until save.
    await page.getByRole("button", { name: "인물 카드", exact: true }).click();
    await expect(page.getByRole("checkbox")).toHaveCount(6);
    for (const box of await page.getByRole("checkbox").all()) await expect(box).toBeChecked();
    expect((await dashboard()).card_reviews).toHaveLength(0);
    await capture(page, "admin-cards-default");
    await page.getByRole("checkbox").first().uncheck();
    await page.getByRole("button", { name: "인물 카드 공개 검수 저장" }).click();
    await expect.poll(async () => (await dashboard()).card_reviews[0]?.question_keys.length).toBe(5);
    await page.getByRole("button", { name: "인물 맞히기", exact: true }).click();
    await page.getByLabel("설문을 등록한 직원").selectOption(me.self.id);
    await expect(page.getByRole("checkbox")).toHaveCount(7);
    for (const box of await page.getByRole("checkbox").all()) await expect(box).toBeChecked();
    expect((await dashboard()).rounds).toHaveLength(0);
    await capture(page, "admin-round-default");
    await page.getByRole("button", { name: "문제 저장", exact: true }).click();
    await expect.poll(async () => (await dashboard()).rounds[0]?.approved).toBe(true);
    expect((await dashboard()).rounds[0]?.question_keys).toHaveLength(6);
    await page.getByRole("button", { name: "취향 통계", exact: true }).click();
    await page.getByRole("button", { name: "응답 자동 집계하기" }).click();
    await expect(page.getByRole("checkbox")).toBeChecked();
    expect((await dashboard()).tastes[0]?.approved).toBe(false);
    await capture(page, "admin-taste-default");
    await page.getByRole("button", { name: "검수 결과 저장" }).click();
    await expect.poll(async () => (await dashboard()).tastes[0]?.approved).toBe(true);
    await page.getByRole("checkbox").uncheck();
    await page.getByRole("button", { name: "검수 결과 저장" }).click();
    await expect.poll(async () => (await dashboard()).tastes[0]?.approved).toBe(false);
    expect((await dashboard()).state.phase).toBe("WAITING");
    // Existing explicit partial selection remains intact when returning to its form.
    await page.getByRole("button", { name: "인물 카드", exact: true }).click();
    await expect(page.getByRole("checkbox").first()).not.toBeChecked();
  } finally {
    await guest.auth.signOut();
    await sql.end();
  }
});
