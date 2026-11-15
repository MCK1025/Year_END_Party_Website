import { expect, it } from "vitest";
import { activeSeconds, motionPolicy, safeRoute } from "../../src/lib/motion";

it("keeps the page-only preference separate from OS policy", () => {
  expect(motionPolicy(false)).toBe("ALLOWED");
  expect(motionPolicy(false, true)).toBe("USER_PAGE_EFFECTS_DISABLED");
  expect(motionPolicy(true, true)).toBe("SYSTEM_REDUCED_MOTION");
  expect(motionPolicy(undefined)).toBe("PREFERENCE_UNKNOWN");
});
it("uses active wall time for the envelope and bounded deltas for snow", () => {
  const frames = Array.from({ length: 5 }, () => 200);
  expect(frames.reduce((s, d) => s + activeSeconds(d, true), 0)).toBe(1);
  expect(frames.reduce((s, d) => s + activeSeconds(d, false), 0)).toBe(0.25);
});
it("only reports known routes, never arbitrary route metadata", () => {
  expect(safeRoute("/survey")).toBe("/survey");
  for (const value of ["/survey?token=secret", "/forest/123", null, {}])
    expect(safeRoute(value)).toBe("other");
});
