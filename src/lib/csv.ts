import Papa from "papaparse";
import { z } from "zod";
import { employeeCsvSchema } from "../../supabase/functions/_shared/contracts";
import { ApiError } from "./api";
export type EmployeeRow = z.infer<typeof employeeCsvSchema>;
export function parseEmployees(text: string): EmployeeRow[] {
  const parsed = Papa.parse<unknown>(text.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  if (parsed.errors.length || parsed.meta.fields?.join(",") !== "employee_no,name,department,date_of_birth")
    throw new ApiError("CSV 열과 형식을 확인해주세요.");
  const rows = z.array(employeeCsvSchema).min(1).max(100).parse(parsed.data);
  if (new Set(rows.map((r) => r.employee_no)).size !== rows.length)
    throw new ApiError("사원 번호가 중복되었습니다.");
  return rows;
}
export function safeCell(value: string): string {
  return /^[\s]*[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
}
