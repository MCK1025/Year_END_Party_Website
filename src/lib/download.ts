import Papa from "papaparse";
import { safeCell } from "./csv";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadCsv(
  rows: readonly Readonly<Record<string, string | number | boolean>>[],
  filename: string,
) {
  const safe = rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "string" ? safeCell(v) : v])),
  );
  downloadBlob(new Blob(["\uFEFF", Papa.unparse(safe)], { type: "text/csv;charset=utf-8" }), filename);
}
