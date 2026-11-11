import { describe, expect, it } from "vitest";
import { decodeEmployeeCsv, parseEmployees } from "../../src/lib/csv";

const header = "employee_no,name,department,date_of_birth\r\n";
const korean = [176, 161, 187, 243, 193, 247, 191, 248, 44, 177, 226, 200, 185, 198, 192];
describe("employee CSV byte decoding", () => {
  it("reads Excel CP949 without losing Korean employee fields", () => {
    // Given: synthetic CP949 bytes; no real employee data is used.
    const bytes = Uint8Array.from([
      ...new TextEncoder().encode(`${header}TEST-CP949,`),
      ...korean,
      ...new TextEncoder().encode(",1990-01-01\r\n"),
    ]);
    // When
    const rows = parseEmployees(decodeEmployeeCsv(bytes));
    // Then
    expect(rows).toEqual([
      { employee_no: "TEST-CP949", name: "가상직원", department: "기획팀", date_of_birth: "1990-01-01" },
    ]);
  });
  it.each([false, true])("keeps UTF-8 intact with BOM: %s", (bom) => {
    // Given
    const text = `${header}TEST-UTF8,가상직원,기획팀,1990-01-01`;
    const bytes = new TextEncoder().encode(`${bom ? "\uFEFF" : ""}${text}`);
    // When / Then
    expect(decodeEmployeeCsv(bytes)).toBe(text);
  });
  it.each([{ bytes: [255] }, { bytes: [239, 187, 191, 255] }])(
    "rejects corrupt bytes without replacement characters: $bytes",
    ({ bytes }) => {
      // Given / When / Then
      expect(() => decodeEmployeeCsv(Uint8Array.from(bytes))).toThrow(/CSV 인코딩/);
    },
  );
  it("rejects a header-only template with an actionable empty-data error", () => {
    // Given / When / Then
    expect(() => parseEmployees(header)).toThrow(/직원 데이터/);
  });
});
