import { describe, expect, it } from "vitest";
import { responseWindow } from "../../src/lib/responseWindow";

describe("rescheduled response window", () => {
  const now = Date.parse("2026-11-18T13:30:00Z");
  it.each([
    [false, null, true],
    [false, "2026-11-18T13:00:00Z", true],
    [true, null, false],
    [true, "invalid", false],
    [true, "2026-11-18T22:29:59+09:00", false],
    [true, "2026-11-18T22:30:00+09:00", false],
    [true, "2026-11-18T22:30:01+09:00", true],
  ])("started=%s start=%s allows edits=%s", (started, start, expected) => {
    // Given / When / Then: history only allows a strictly future response window.
    expect(responseWindow({ started, start }, now)).toBe(expected);
  });
});
