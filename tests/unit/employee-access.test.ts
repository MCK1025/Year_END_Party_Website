import { describe, expect, it } from "vitest";
import { loginSchema } from "../../supabase/functions/_shared/contracts";
import { requestSchema } from "../../supabase/functions/_shared/requests";

describe("six-digit employee password boundary", () => {
  it("accepts a birth password with a leading zero without name or issued code", () => {
    // Given / When / Then
    expect(loginSchema.safeParse({ password: "010203" }).success).toBe(true);
  });
  it.each(["12345", "1234567", "abcdef", " 010203", "０１０２０３"])(
    "rejects malformed password %s",
    (password) => {
      // Given / When / Then
      expect(loginSchema.safeParse({ password }).success).toBe(false);
    },
  );
  it("accepts only administrator employee lifecycle commands with complete payloads", () => {
    // Given / When / Then
    expect(
      requestSchema.safeParse({
        action: "create_employee",
        payload: {
          employee_no: "TEST-NEW",
          name: "가상 신규",
          department: "가상팀",
          date_of_birth: "2001-02-03",
        },
      }).success,
    ).toBe(true);
    expect(
      requestSchema.safeParse({ action: "delete_employee", payload: { id: crypto.randomUUID() } }).success,
    ).toBe(true);
    expect(requestSchema.safeParse({ action: "create_employee", payload: {} }).success).toBe(false);
  });
});

describe("anonymous forest submission boundary", () => {
  it("rejects an author identity supplied alongside an anonymous message", () => {
    // Given / When / Then
    expect(
      requestSchema.safeParse({
        action: "forest_post",
        payload: { kind: "thanks", body: "가상 글", employee_id: crypto.randomUUID() },
      }).success,
    ).toBe(false);
  });
  it("accepts a message without an author identity", () => {
    // Given / When / Then
    expect(
      requestSchema.safeParse({
        action: "forest_post",
        payload: { kind: "thanks", body: "함께해 주셔서 고맙습니다." },
      }).success,
    ).toBe(true);
  });
  it.each(["", "   ", "가".repeat(2001)])("rejects empty or oversized messages", (body) => {
    // Given / When / Then
    expect(requestSchema.safeParse({ action: "forest_post", payload: { kind: "wish", body } }).success).toBe(
      false,
    );
  });
});
