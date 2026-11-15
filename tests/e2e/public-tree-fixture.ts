import type { Page } from "@playwright/test";

export async function publicTreeFixture(
  page: Page,
  total: number,
  updates: { revision: number; open?: boolean } = { revision: 2 },
) {
  const self = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "가상 직원",
    department: "시험",
    active: true,
  };
  await page.route("**/functions/v1/portal", async (route) => {
    const { action, payload } = route.request().postDataJSON();
    if (action === "bootstrap")
      return route.fulfill({
        json: {
          self,
          directory: [self],
          questions: [],
          survey: null,
          nomination: null,
          settings: {
            event_start_at: null,
            deletion_date: null,
            survey_open: false,
            nomination_open: false,
            welcome: "겨울 이야기",
            logo_path: null,
          },
          server_time: "2026-11-15T09:00:00Z",
          state: {
            phase: "WAITING",
            revision: updates.revision,
            paused: false,
            tree_open: updates.open ?? true,
            payload: {},
          },
        },
      });
    if (action === "forest_tree") {
      const start = Math.min(total, (payload.before ?? total + 1) - 1);
      return route.fulfill({
        json: {
          total,
          notes: Array.from({ length: Math.min(12, start) }, (_, i) => ({
            id: start - i,
            kind: "thanks",
            body: `가상의 겨울 이야기 ${start - i}`,
            day: "2026-11-15",
          })),
        },
      });
    }
    return route.fulfill({ json: { ok: true } });
  });
}
