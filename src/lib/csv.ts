import Papa from "papaparse";
import { z } from "zod";
import { employeeCsvSchema } from "../../supabase/functions/_shared/contracts";
import { ApiError } from "./api";
export type EmployeeRow = z.infer<typeof employeeCsvSchema>;
export function decodeEmployeeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
  }
  const utf8Bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  if (!utf8Bom) {
    try {
      return new TextDecoder("euc-kr", { fatal: true }).decode(bytes);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
    }
  }
  throw new ApiError(
    "CSV 인코딩을 읽을 수 없습니다. 엑셀에서 CSV UTF-8 형식으로 저장한 뒤 다시 선택해주세요.",
  );
}
export function parseEmployees(text: string): EmployeeRow[] {
  const parsed = Papa.parse<unknown>(text.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  if (parsed.errors.length || parsed.meta.fields?.join(",") !== "employee_no,name,department,date_of_birth")
    throw new ApiError("CSV 열과 형식을 확인해주세요.");
  if (parsed.data.length === 0)
    throw new ApiError("CSV에 직원 데이터가 없습니다. 열 제목 아래에 직원 정보를 입력해주세요.");
  const rows = z.array(employeeCsvSchema).min(1).max(100).parse(parsed.data);
  if (new Set(rows.map((r) => r.employee_no)).size !== rows.length)
    throw new ApiError("사원 번호가 중복되었습니다.");
  return rows;
}
export function safeCell(value: string): string {
  return /^[\s]*[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
}
