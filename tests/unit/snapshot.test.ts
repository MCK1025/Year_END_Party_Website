import { expect, it } from "vitest";
import { latestState } from "../../src/lib/snapshot";
import type { EventState } from "../../supabase/functions/_shared/contracts";

it("retains newer revocation when an earlier bootstrap request finishes late", () => {
  // Given
  const current: EventState = {
    phase: "WHO_AM_I",
    payload: {},
    revision: 2,
    editing_locked: false,
    tree_open: false,
    paused: false,
  };
  const delayed: EventState = {
    phase: "WHO_AM_I",
    payload: { hints: ["withdrawn"] },
    revision: 1,
    editing_locked: false,
    tree_open: false,
    paused: false,
  };
  // When
  const result = latestState(current, delayed);
  // Then
  expect(result).toEqual(current);
});
it("accepts current or newer persistent state when reconnecting", () => {
  // Given
  const incoming: EventState = {
    phase: "END",
    payload: { message: "감사합니다" },
    revision: 3,
    editing_locked: false,
    tree_open: false,
    paused: false,
  };
  // When / Then
  expect(latestState(undefined, incoming)).toEqual(incoming);
});
