import { describe, expect, it, vi } from "vitest";
import { invitationAnchor } from "../../src/graphics/invitation-layout";
import { arrivalPhase, invitationCopy, progress } from "../../src/lib/invitation";

describe("invitation", () => {
  it("preserves the theme and reaches an unbounded reading state", () => {
    expect(invitationCopy.theme).toBe("한 걸음 더 가까워진, 그리고 가까워질 우리.");
    expect([0, 1.2, 1.5, 2.2, 3, 1000].map(arrivalPhase)).toEqual([
      "arriving",
      "settling",
      "opening",
      "opening",
      "reading",
      "reading",
    ]);
    expect(progress(-1, 0, 1)).toBe(0);
    expect(progress(2, 0, 1)).toBe(1);
  });
  it("maps DOM letter bounds into the fixed orthographic world", () => {
    const rect = (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      left: x,
      top: y,
      width,
      height,
      right: x + width,
      bottom: y + height,
      toJSON: () => ({}),
    });
    expect(invitationAnchor(rect(20, 50, 400, 600), rect(60, 100, 320, 400))).toEqual({
      x: 0,
      y: 0.5,
      width: 3.2,
      height: 4,
      viewportWidth: 4,
    });
  });
  it("continues with blocked storage without redirecting back", async () => {
    vi.resetModules();
    vi.stubGlobal("sessionStorage", {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    });
    const gate = await import("../../src/lib/invitation");
    expect(gate.hasEnteredInvitation()).toBe(false);
    gate.enterInvitation();
    expect(gate.hasEnteredInvitation()).toBe(true);
    vi.unstubAllGlobals();
  });
});
