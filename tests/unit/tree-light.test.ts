import { expect, it } from "vitest";
import { lampLevel, lamps, snowSeeds } from "../../src/graphics/treeModel";

it("keeps six lamps lit and varies each of the other twelve over smooth independent ramps", () => {
  expect(lamps.filter((l) => l.steady)).toHaveLength(6);
  for (const lamp of lamps) {
    const samples = [0, 0.5, 1, 1.5, 2, 3, 4].map((t) => lampLevel(lamp, t));
    if (lamp.steady) {
      expect(new Set(samples).size).toBe(1);
      continue;
    }
    expect(new Set(samples).size).toBeGreaterThan(2);
    for (const d of [lamp.rise, lamp.fall]) {
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(2);
    }
    const boundary = 10 * (lamp.rise + lamp.fall) - lamp.offset;
    expect(lampLevel(lamp, boundary)).toBeCloseTo(0.2, 6);
    expect(lampLevel(lamp, boundary + lamp.rise)).toBeCloseTo(1, 6);
    expect(Math.abs(lampLevel(lamp, boundary + 0.0001) - lampLevel(lamp, boundary - 0.0001))).toBeLessThan(
      0.00001,
    );
    for (const v of samples) {
      expect(v).toBeGreaterThanOrEqual(0.2);
      expect(v).toBeLessThanOrEqual(1);
    }
  }
  expect(new Set(lamps.filter((l) => !l.steady).map((l) => lampLevel(l, 2))).size).toBe(12);
});
it("repeats the seeded snow field with independently sized and paced layers", () => {
  const flakes = snowSeeds();
  expect(flakes).toEqual(snowSeeds(2026));
  expect(flakes).not.toEqual(snowSeeds(2027));
  expect(flakes.slice(0, 96).filter((f) => f.kind === 3)).toHaveLength(4);
  expect(flakes.filter((f) => f.kind === 3)).toHaveLength(5);
  expect(Math.max(...flakes.filter((f) => f.kind === 0).map((f) => f.speed))).toBeLessThan(
    Math.min(...flakes.filter((f) => f.kind === 1).map((f) => f.speed)),
  );
});
