import { z } from "zod";
import {
  nominationSchema,
  personSchema,
  surveySchema,
  winnerSchema,
} from "../../supabase/functions/_shared/contracts";
import { api } from "./api";
import { safeCell } from "./csv";
import { downloadCsv } from "./download";

const schema = z.object({
  employees: z.array(personSchema.omit({ active: true }).extend({ employee_no: z.string() })).nullable(),
  surveys: z.array(surveySchema),
  nominations: z.array(nominationSchema),
  winners: z.array(winnerSchema),
});
export async function exportData(format: "csv" | "xlsx") {
  const data = await api({ action: "export", payload: {} }, schema);
  const people = data.employees ?? [];
  const surveys = data.surveys.map((s) => {
    const e = people.find((p) => p.id === s.employee_id);
    return {
      employee_no: e?.employee_no ?? "",
      name: e?.name ?? "",
      department: e?.department ?? "",
      ...s.answers,
      consent: s.consent,
      excluded: s.excluded.join(","),
      updated_at: s.updated_at,
    };
  });
  const nominations = data.nominations.map((n) => ({
    voter: people.find((p) => p.id === n.voter_id)?.name ?? "",
    voter_no: people.find((p) => p.id === n.voter_id)?.employee_no ?? "",
    nominee: people.find((p) => p.id === n.nominee_id)?.name ?? "",
    nominee_no: people.find((p) => p.id === n.nominee_id)?.employee_no ?? "",
    reason: n.reason,
    updated_at: n.updated_at,
  }));
  const winners = data.winners.map((w) => ({
    name: w.name,
    department: w.department,
    votes: w.votes,
    approved_reasons: w.reasons.join(" / "),
  }));
  if (format === "csv") {
    downloadCsv(surveys, "설문결과-개인정보.csv");
    downloadCsv(nominations, "추천원본-개인정보.csv");
    downloadCsv(winners, "시상결과.csv");
    return;
  }
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const sheets = (
    [
      ["설문", surveys],
      ["추천원본", nominations],
      ["시상", winners],
    ] as const
  ).map(([name, rows]) => {
    const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    const records: readonly Readonly<Record<string, string | number | boolean>>[] = rows;
    return {
      name,
      data: [
        keys,
        ...records.map((row) =>
          keys.map((key) => {
            const value = row[key] ?? "";
            return typeof value === "string" ? safeCell(value) : value;
          }),
        ),
      ],
    };
  });
  await writeXlsxFile(sheets).toFile("2026-행사결과-개인정보.xlsx");
}
