import { expect, type Page, test } from "@playwright/test";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { boot, call, command, dashboard, employee, env, signAdmin } from "../integration/helpers";
import { openLogin } from "./invitation-helper";
import { localDatabase } from "./local-db";

const sql = localDatabase();
async function capture(page: Page, name: string) {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async () => {
      window.scrollTo(0, 0);
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({
      path: `artifacts/screens/person-publication/${name}-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 375, height: 900 });
}

test.beforeAll(async () => {
  await signAdmin();
  await sql`update public.event_public_state set phase='WAITING',payload='{}',paused=false,tree_open=false,revision=revision+1 where id`;
  await sql`update private.settings set enabled=true,started_at=null,survey_open=true,nomination_open=true,
    event_start_at=now()-interval '1 hour' where id`;
  await sql`delete from private.login_attempts`;
  await sql`delete from private.rounds`;
  await sql`delete from private.card_reviews`;
  await sql`delete from public.surveys`;
});
test.afterAll(async () => {
  await sql`update public.event_public_state set phase='WAITING',payload='{}',revision=revision+1 where id`;
  await sql.end();
});

test("no-consent registration, six-question quiz and two reviewed person cards with live positions", async ({
  page,
  browser,
}) => {
  test.setTimeout(150000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openLogin(page);
  await page.getByLabel("비밀번호", { exact: true }).fill("900101");
  await page.getByRole("button", { name: "우리의 자리로" }).click();
  await page.getByRole("link", { name: "나의 이야기", exact: true }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByLabel("오늘 가장 먹고 싶은 음식은?").selectOption("고기");
  await page.getByLabel("퇴근 뒤, 나를 가장 나답게 만드는 취미는?").selectOption("운동");
  await page.getByLabel("최근 즐겨보는 유튜브 채널은?").fill("가상 산책 채널");
  await page.getByLabel("어릴 적 나의 꿈은?").fill("우주를 걷는 사람");
  await page.getByLabel("동료들이 아직 모르는 나의 반전은?").fill("새벽에 빵을 굽습니다");
  await page.getByLabel("올해, 오래 기억하고 싶은 순간은?").fill("함께 끝낸 첫 프로젝트");
  await capture(page, "survey");
  await page.getByRole("button", { name: "이야기 저장하고 다음으로" }).click();
  await expect(page).toHaveURL(/#\/nominate$/);
  const second = await employee(1);
  const me = await boot(second);
  await call(
    second,
    {
      action: "save_survey",
      payload: {
        answers: Object.fromEntries(me.questions.map((q) => [q.id, `가상 두 번째 답변 ${q.id}`])),
        excluded: [],
      },
    },
    okSchema,
  );
  await second.auth.signOut();
  const data = await dashboard();
  const first = data.employees.find((e) => e.employee_no === "TEST-001");
  if (!first) throw new Error("Missing local person");
  expect(data.surveys).toHaveLength(2);
  expect(data.surveys.every((s) => !s.consent)).toBe(true);
  expect(data.card_reviews).toHaveLength(0);

  const context = await browser.newContext({ reducedMotion: "reduce" });
  const host = await context.newPage();
  try {
    await host.goto("/#/admin");
    await host.getByLabel("관리자 이메일").fill(env.ADMIN_EMAIL);
    await host.getByLabel("비밀번호", { exact: true }).fill(env.ADMIN_PASSWORD);
    await host.getByRole("button", { name: "운영 화면으로" }).click();
    await host.getByRole("button", { name: "인물 카드", exact: true }).click();
    await expect(host.getByText("설문 등록 2명 · 공개 승인 0명 · 검수 대기 2명")).toBeVisible();
    await capture(host, "admin-pending");
    await host.getByRole("button", { name: "인물 맞히기", exact: true }).click();
    await host.getByLabel("설문을 등록한 직원").selectOption(first.id);
    for (const q of data.questions) await host.getByRole("checkbox", { name: q.prompt }).check();
    await expect(host.getByRole("textbox", { name: /^힌트 / })).toHaveCount(6);
    await expect(host.getByRole("checkbox", { name: /이 문제의 공개를 승인/ })).toBeChecked();
    await capture(host, "admin-six-questions");
    await host.getByRole("button", { name: "문제 저장", exact: true }).click();
    await expect.poll(async () => (await dashboard()).rounds.length).toBe(1);
    const round = (await dashboard()).rounds[0];
    if (!round) throw new Error("Missing reviewed round");
    expect(round.question_keys).toHaveLength(6);
    expect(round.approved).toBe(true);
    await page.getByRole("link", { name: "행사장", exact: true }).click();
    expect((await command("phase", { phase: "RECAP" })).error).toBeNull();
    expect((await command("phase", { phase: "WHO_AM_I" })).error).toBeNull();
    expect((await command("start_person", { round_id: round.id })).error).toBeNull();
    for (let n = 0; n < 6; n++) {
      expect((await command("hint")).error).toBeNull();
      await expect(page.locator(".hint")).toHaveCount(n + 1);
      await expect(page.locator(".hint").nth(n)).toContainText(data.questions[n]?.prompt ?? "");
      await expect(page.locator(".hint").nth(n)).toContainText(round.hints[n] ?? "");
    }
    await capture(page, "employee-six-hints");
    await sql`update public.event_public_state set phase='COMPLETED',payload='{}',revision=revision+1 where id`;
    await expect(page).toHaveURL(/#\/afterparty$/);
    await capture(page, "afterparty");
    await page.getByRole("link", { name: "혜성식품 인물 카드", exact: true }).click();
    await expect(page.getByText(/공개된 인물 카드가 아직 없습니다/)).toBeVisible();
    await capture(page, "cards-empty");

    const refreshed = host.waitForResponse(
      (r) => r.url().endsWith("/portal") && r.request().postDataJSON()?.action === "dashboard",
    );
    await host.getByRole("button", { name: "새로고침", exact: true }).click();
    await refreshed;
    await host.getByRole("button", { name: "인물 카드", exact: true }).click();
    for (const name of [first.name, me.self.name]) {
      const panel = host
        .locator("section.panel")
        .filter({ has: host.getByRole("heading", { name: new RegExp(`^${name} ·`) }) });
      await panel.getByRole("button", { name: "공개 가능한 답변 모두 선택" }).click();
      await panel.getByRole("button", { name: "인물 카드 공개 검수 저장" }).click();
      await expect(panel.getByText("공개 승인 · 답변 6개")).toBeVisible();
    }
    await expect(host.getByText("설문 등록 2명 · 공개 승인 2명 · 검수 대기 0명")).toBeVisible();
    await capture(host, "admin-approved");
    await expect(page.locator(".person-card-button")).toHaveCount(2);
    await page.getByLabel("직원 이름 검색").fill(first.name);
    await sql`update public.employee_directory set department='수정된 과장' where id=${first.id}`;
    await expect(page.locator(".person-card-button")).toContainText("수정된 과장", { timeout: 15000 });
    await page.locator(".person-card-button").click();
    await expect(page.locator(".taste-answer")).toHaveCount(6);
    await capture(page, "cards-position");
    await page.getByRole("dialog").getByRole("button", { name: "닫기", exact: true }).click();
    await page.getByLabel("직원 이름 검색").fill("");
    await expect(page.locator(".person-card-button")).toHaveCount(2);
    await page.locator(".person-card-button").nth(1).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "닫기", exact: true }).click();
    await sql`update private.employees set department=${first.department} where id=${first.id}`;
    for (const tab of ["사원 관리", "설문·추천", "취향 통계"]) {
      await host.getByRole("button", { name: tab, exact: true }).click();
      if (tab === "설문·추천") await host.locator("summary").first().click();
      await capture(
        host,
        `admin-${tab === "사원 관리" ? "people" : tab === "설문·추천" ? "data" : "tastes"}`,
      );
    }
  } finally {
    await sql`update private.employees set department=${first.department} where id=${first.id}`;
    await context.close();
  }
});
