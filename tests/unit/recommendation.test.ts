import { expect, it } from "vitest";
import { requestSchema } from "../../supabase/functions/_shared/requests";

it("requires ten trimmed Unicode characters for a recommendation reason", () => {
  const parse = (reason: string) =>
    requestSchema.safeParse({
      action: "nominate",
      payload: { nominee_id: "00000000-0000-4000-8000-000000000001", reason },
    });
  expect(parse("123456789").success).toBe(false);
  expect(parse("     12345     ").success).toBe(false);
  expect(parse("😀".repeat(9)).success).toBe(false);
  expect(parse("1234567890").success).toBe(true);
  expect(parse("함께해서 더 든든합니다.").success).toBe(true);
});
