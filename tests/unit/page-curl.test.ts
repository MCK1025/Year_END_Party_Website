import { expect, it } from "vitest";
import { curlColumns } from "../../src/graphics/pageCurlShape";

it("pins the binding and keeps text UV order on the flat front and unfolded reverse", () => {
  const start = curlColumns(0, 52),
    end = curlColumns(1, 52);
  expect(start[0]?.x).toBe(0);
  expect(start.at(-1)?.x).toBeCloseTo(1);
  expect(end.at(-1)?.x).toBeCloseTo(-1);
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    const cols = curlColumns(p, 52);
    expect(cols[0]).toMatchObject({ x: 0, z: 0 });
    for (let i = 1; i < cols.length; i++) {
      const a = cols[i - 1],
        b = cols[i];
      if (!a || !b) throw Error("column missing");
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(1 / 52, 6);
    }
  }
  const middle = curlColumns(0.5, 52);
  expect(middle[14]?.z).not.toBeCloseTo(((middle.at(-1)?.z ?? 0) * 14) / 52, 2);
});
