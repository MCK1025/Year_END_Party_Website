import { expect, it } from "vitest";
import { albumOf, albumPages, type Moment } from "../../src/components/recap/model";

const legacy: Moment = {
  id: "original",
  caption: "기존 사진 설명",
  published: true,
  asset_path: "original.png",
  sort_order: 5,
};
it("keeps the original photo and caption on a detail page and leaves its cover unassigned", () => {
  const pages = albumPages([legacy]);
  expect(pages.map((p) => p.photo)).toEqual([null, "original.png"]);
  expect(pages[1]?.detail?.description).toBe(legacy.caption);
});
it("places a chapter's own cover before its ordered details, including chapters with zero details", () => {
  const a = { ...legacy, album: { ...albumOf(legacy), cover_path: "cover.png" } };
  const b = { ...legacy, id: "another", sort_order: 1, asset_path: null };
  expect(albumPages([a, b]).map((p) => [p.number, p.photo])).toEqual([
    [1, null],
    [2, "cover.png"],
    [2, "original.png"],
  ]);
  expect(albumPages([])).toEqual([]);
});
