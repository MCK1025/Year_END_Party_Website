import { expect, test } from "@playwright/test";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { admin, call, command, dashboard, env, eventDate, signAdmin } from "../integration/helpers";

test.beforeAll(async () => {
  await signAdmin();
  await eventDate(false);
});
test("rejects an old confirmation after another organizer advances the round", async ({ page }) => {
  // Given: a confirmation opened against a specific published revision.
  await command("waiting");
  const data = await dashboard();
  const survey = data.surveys.find((s) => s.consent && s.excluded.length === 0);
  if (!survey) throw new Error("Run integration fixtures first");
  const previous = data.rounds.find((r) => r.sort_order === 88);
  await call(
    admin,
    {
      action: "round",
      payload: {
        ...(previous ? { id: previous.id } : {}),
        employee_id: survey.employee_id,
        question_keys: ["dream", "surprise"],
        hints: ["CAS-HINT-1", "CAS-HINT-2"],
        approved: true,
        sort_order: 88,
      },
    },
    okSchema,
  );
  const round = (await dashboard()).rounds.find((r) => r.sort_order === 88);
  if (!round) throw new Error("Confirmation fixture failed");
  await command("phase", { phase: "RECAP" });
  await command("phase", { phase: "WHO_AM_I" });
  await command("start_person", { round_id: round.id });
  await command("hint");
  await page.goto("/#/admin");
  await page.getByLabel("관리자 이메일").fill(env.ADMIN_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "운영 화면으로" }).click();
  await page.getByRole("button", { name: "정답 공개", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await command("hint");
  const changed = await dashboard();
  await expect(page.locator(".overline").filter({ hasText: `REV ${changed.state.revision}` })).toBeVisible({
    timeout: 25000,
  });
  // When: confirm the original dialog after the background dashboard refresh.
  await page.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
  // Then: the old revision is rejected rather than revealing the new state.
  await expect(page.getByRole("alert")).toContainText("다른 조작이 반영되었습니다");
  expect((await dashboard()).state.payload.person).toBeNull();
  await command("waiting");
});
