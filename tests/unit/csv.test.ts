import { describe, expect, it } from "vitest";
import { parseEmployees, safeCell } from "../../src/lib/csv";

describe("employee import boundary", () => {
  it("parses quoted Korean names and BOM when CSV is valid", () => {
    // Given
    const text = '\uFEFFemployee_no,name,department,date_of_birth\r\nTEST-01,"가상,직원",기획팀,1990-01-01';
    // When
    const result = parseEmployees(text);
    // Then
    expect(result).toEqual([
      { employee_no: "TEST-01", name: "가상,직원", department: "기획팀", date_of_birth: "1990-01-01" },
    ]);
  });
  it("rejects duplicates when the same employee appears twice", () => {
    // Given
    const text = "employee_no,name,department,date_of_birth\nT01,가상,팀,1990-01-01\nT01,가상2,팀,1990-01-01";
    // When / Then
    expect(() => parseEmployees(text)).toThrow();
  });
  it("rejects invalid calendar days when DOB cannot exist", () => {
    // Given
    const text = "employee_no,name,department,date_of_birth\nT01,가상,팀,1990-02-30";
    // When / Then
    expect(() => parseEmployees(text)).toThrow();
  });
  it.each(['=HYPERLINK("evil")', "+SUM(1,2)", "-1+2", "@cmd", "\t=cmd", " \r=cmd"])(
    "neutralizes spreadsheet formula when input is %s",
    (input) => {
      // Given / When
      const result = safeCell(input);
      // Then
      expect(result).toBe(`'${input}`);
    },
  );
});
