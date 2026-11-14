import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { admin, call, command, dashboard, env, eventDate, signAdmin } from "../integration/helpers";
import { openLogin } from "./invitation-helper";

const sql = postgres(env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
test.beforeAll(async () => {
  await signAdmin();
  await sql`update private.settings set started_at=null,enabled=true,survey_open=true,nomination_open=true`;
  await command("waiting");
  await eventDate(false);
  await sql`delete from private.login_attempts`;
  await sql`delete from public.nominations`;
});
test.afterAll(async () => {
  await sql.end();
});

test("guest saves a story, then sees organizer reveals live through the ending", async ({
  page,
  browser,
}) => {
  // Given: a genuine mobile browser, a separate organizer session, five synthetic employees.
  await openLogin(page);
  await page.getByLabel("비밀번호", { exact: true }).fill("900101");
  await page.getByRole("button", { name: "우리의 자리로" }).click();
  await expect(page.getByRole("link", { name: "나의 이야기" })).toBeVisible();
  await page.getByRole("link", { name: "나의 이야기" }).click();
  await page.getByLabel("오늘 가장 먹고 싶은 음식은?").selectOption("고기");
  await page.getByLabel("퇴근 뒤, 나를 가장 나답게 만드는 취미는?").selectOption("운동");
  await page.getByLabel("최근 즐겨보는 유튜브 채널은?").fill("가상 산책 채널");
  await page.getByLabel("어릴 적 나의 꿈은?").fill("우주를 걷는 사람");
  await page.getByLabel("동료들이 아직 모르는 나의 반전은?").fill("새벽에 빵을 굽습니다");
  await page.getByLabel("올해, 오래 기억하고 싶은 순간은?").fill("함께 끝낸 첫 프로젝트");
  await page.getByLabel("내 답변을 인물 힌트와 익명 취향 통계에 활용하는 데 동의합니다.").check();
  await page.getByRole("button", { name: "이야기 저장하고 다음으로" }).click();
  await expect(page.getByLabel("추천할 동료")).toBeVisible();
  const d = await dashboard();
  const colleague = d.employees.find((e) => e.employee_no === "TEST-002");
  const self = d.employees.find((e) => e.employee_no === "TEST-001");
  if (!colleague || !self) throw new Error("Missing local fixtures");
  await page.getByLabel("추천할 동료").selectOption(colleague.id);
  await page.getByLabel("고마운 이유 (10자 이상)").fill("늘 먼저 손을 내밀어 준 동료");
  await page.getByRole("button", { name: "마음을 전하고 행사장으로" }).click();
  await expect(page.getByText("당신의 이야기가 잘 도착했습니다.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("설문 저장 완료 · 동료 추천 저장 완료")).toBeVisible();
  // When: organizer publishes real content via the same server used by the admin UI.
  await call(
    admin,
    {
      action: "recap",
      payload: { caption: "함께 완성한, 우리의 첫 장면", asset_path: null, published: true, sort_order: 1 },
    },
    okSchema,
  );
  await call(
    admin,
    {
      action: "round",
      payload: {
        employee_id: self.id,
        question_keys: ["dream", "surprise", "moment"],
        hints: ["우주를 걷는 사람", "새벽에 빵을 굽습니다", "함께 끝낸 첫 프로젝트"],
        approved: true,
        sort_order: 1,
      },
    },
    okSchema,
  );
  const organizer = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await organizer.goto("/#/admin");
  await organizer.getByLabel("관리자 이메일").fill(env.ADMIN_EMAIL);
  await organizer.getByLabel("비밀번호", { exact: true }).fill(env.ADMIN_PASSWORD);
  await organizer.getByRole("button", { name: "운영 화면으로" }).click();
  await expect(organizer.getByRole("heading", { name: "우리의 저녁을 준비합니다." })).toBeVisible();
  await organizer.getByRole("button", { name: "행사 시작 · 응답 마감" }).click();
  await organizer.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
  await organizer.getByRole("button", { name: "다음 순서 · 1년의 장면들" }).click();
  await organizer.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.getByText("함께 완성한, 우리의 첫 장면").first()).toBeVisible({ timeout: 10000 });
  await organizer.getByRole("button", { name: "다음 순서 · 이 사람, 누구일까요?" }).click();
  await organizer.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
  const ready = await dashboard();
  const round = ready.rounds.find((r) => r.employee_id === self.id && r.hints[0] === "우주를 걷는 사람");
  if (!round) throw new Error("Round not saved");
  await organizer.getByLabel("출제할 인물").selectOption(round.id);
  await organizer.getByRole("button", { name: "이 인물로 시작" }).click();
  await organizer.getByRole("button", { name: "다음 힌트 공개" }).click();
  // Then: real Realtime visibility, no future hints, refresh recovery, real ending.
  await expect(page.getByText("우주를 걷는 사람", { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("새벽에 빵을 굽습니다", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("우주를 걷는 사람", { exact: true })).toBeVisible();
  await organizer.getByRole("button", { name: "다음 힌트 공개" }).click();
  await expect(page.getByText("새벽에 빵을 굽습니다", { exact: true })).toBeVisible({ timeout: 10000 });
  await organizer.getByRole("button", { name: "정답 공개", exact: true }).click();
  await organizer.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.getByRole("heading", { name: "가상직원 하나" })).toBeVisible({ timeout: 10000 });
  await command("phase", { phase: "TASTES" });
  await call(
    admin,
    {
      action: "taste",
      payload: { question_id: "food", prompt: "우리의 저녁 취향은?", results: null, approved: true },
    },
    okSchema,
  );
  await command("taste_question", { taste_id: (await dashboard()).tastes.at(-1)?.id });
  await expect(page.getByRole("heading", { name: "우리의 저녁 취향은?" })).toBeVisible({ timeout: 10000 });
  await command("taste_reveal");
  await expect(page.getByText("고기", { exact: true })).toBeVisible({ timeout: 10000 });
  const beforeAwards = await dashboard();
  await call(
    admin,
    { action: "settings", payload: { ...beforeAwards.settings, nomination_open: false } },
    okSchema,
  );
  await command("phase", { phase: "AWARDS" });
  await expect(page.getByRole("heading", { name: "가상직원 둘" })).toBeVisible({ timeout: 10000 });
  await command("phase", { phase: "END" });
  await expect(page.getByRole("heading", { name: "다음 한 걸음도, 함께." })).toBeVisible({ timeout: 10000 });
  await organizer.close();
});
