import { expect, it } from "vitest";
import { resultSchema } from "../../supabase/functions/_shared/contracts";

it("accepts full-length consented survey text when used as an aggregate label", () => {
  // Given: a valid survey answer can contain 500 characters.
  const answer = "가".repeat(500);
  // When: it crosses the aggregate response boundary.
  const result = resultSchema.safeParse({ label: answer, count: 1 });
  // Then: automatic aggregation cannot lock organizers out of the dashboard.
  expect(result.success).toBe(true);
});
