import type { Page } from "@playwright/test";
import { albumOf, type Moment } from "../../src/components/recap/model";
import { fixture } from "./notebook-fixture";

export const rows: Moment[] = [1, 2].map((n) => ({
  id: `11111111-1111-4111-8111-11111111111${n}`,
  caption: `테스트 장 ${n}`,
  sort_order: n,
  published: true,
  asset_path: null,
  album: {
    ...albumOf(),
    cover_path: n === 1 ? "cover.png" : null,
    slides:
      n === 1
        ? [1, 2].map((i) => ({
            id: `22222222-2222-4222-8222-22222222222${i}`,
            asset_path: `detail${i}.png`,
            description: `설명 ${i}`,
            title: `사진 ${i}`,
            date: "2026-01-01",
          }))
        : [],
  },
}));
export async function recapFixture(page: Page, phase: "RECAP" | "COMPLETED" = "RECAP") {
  const updates = { revision: 1, paused: false };
  const options: { phase: "RECAP" | "COMPLETED" | "END" } = { phase };
  await fixture(page, updates, options);
  let contents = rows;
  await page.route("**/functions/v1/portal", (r) =>
    r.request().postDataJSON().action === "recaps" ? r.fulfill({ json: contents }) : r.fallback(),
  );
  const requests: string[] = [];
  await page.route("**/storage/v1/object/sign/event-media/*", (r) => {
    const path = new URL(r.request().url()).pathname.split("/").pop() ?? "";
    requests.push(path);
    return r.fulfill({ json: { signedURL: `/object/sign/event-media/${path}?token=test` } });
  });
  await page.route("**/storage/v1/object/sign/event-media/*?token=test", (r) => {
    const sky = r.request().url().includes("detail1.png")
      ? "#ecc9ad"
      : r.request().url().includes("detail2.png")
        ? "#c6cde6"
        : "#a2c4b9";
    return r.fulfill({
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="${sky}"/><path d="M0 360 L280 125 L420 270 L510 200 L640 360" fill="#54776a"/><circle cx="500" cy="90" r="28" fill="#f2deab"/></svg>`,
    });
  });
  return {
    requests,
    refresh: async (next: Moment[] = contents) => {
      contents = next;
      updates.revision++;
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
    },
    end: async () => {
      options.phase = "END";
      updates.revision++;
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
    },
  };
}
