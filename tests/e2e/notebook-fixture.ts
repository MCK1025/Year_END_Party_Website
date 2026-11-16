import type { Page } from "@playwright/test";

const id = "11111111-1111-4111-8111-111111111111";
const person = { id, name: "가상 직원", department: "시험", active: true };
export async function fixture(
  page: Page,
  updates: { revision: number; paused: boolean; hints?: string[] } = { revision: 1, paused: false },
  options: { extraQuestions?: number; choice?: boolean; phase?: "WAITING" | "END"; logoPath?: string } = {},
) {
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
              ...(options.choice
                ? [
                    {
                      id: "time",
                      prompt: "함께한 시간",
                      choices: ["점심시간", "퇴근길"],
                      sort_order: 2,
                      active: true,
                    },
                  ]
                : []),
              ...Array.from({ length: options.extraQuestions ?? 0 }, (_, i) => ({
                id: `entry_${i}`,
                prompt: `기억 ${i + 1}`,
                choices: [],
                sort_order: i + 3,
                active: true,
              })),
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
              logo_path: options.logoPath ?? null,
            },
            state: {
              phase: options.phase ?? "WHO_AM_I",
              revision: updates.revision,
              paused: updates.paused,
              payload: {
                round_id: id,
                round_index: 1,
                hints: updates.hints ?? ["어릴 때는 별을 세는 사람이 되고 싶었어요."],
              },
            },
          }
        : action === "forest_mine"
          ? [{ id: 1, kind: "thanks", body: "올 한 해도 함께해 주셔서 고맙습니다.", day: "2026-11-14" }]
          : { ok: true };
    return route.fulfill({ json });
  });
}
