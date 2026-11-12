import { useState } from "react";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { Button, Field, Note, Panel } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { decodeEmployeeCsv, type EmployeeRow, parseEmployees } from "../lib/csv";
import { useTask } from "../lib/useTask";
import { AddEmployee } from "./AddEmployee";
import { useAdmin } from "./context";
import { EmployeeEditor } from "./EmployeeEditor";

export function PeoplePanel() {
  const { data, refresh } = useAdmin();
  const task = useTask();
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  async function read(file: File) {
    setRows([]);
    if (file.size > 100000) throw new ApiError("CSV는 100KB 이하로 준비해주세요.");
    setRows(parseEmployees(decodeEmployeeCsv(new Uint8Array(await file.arrayBuffer()))));
  }
  return (
    <div className="stack">
      <div className="grid-two">
        <AddEmployee />
        <Panel title="직원 명단 가져오기">
          <p className="small">
            UTF-8 또는 엑셀 CSV(ANSI/CP949)를 지원합니다. employee_no,name,department,date_of_birth 순서로
            준비해주세요. 기존 사번은 정보를 수정하고, 새 사번만 추가합니다. 명단에 없는 기존 직원을 자동으로
            삭제하지 않습니다.
          </p>
          <a href={`${import.meta.env.BASE_URL}templates/employees.csv`} download>
            CSV 템플릿 다운로드
          </a>
          <Field
            label="직원 CSV 파일"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void task.run(() => read(f), "미리보기를 확인한 뒤 등록해주세요.");
            }}
          />
          {rows.length > 0 && (
            <>
              <p>{rows.length}명 · 업로드 미리보기</p>
              {rows.map((r) => (
                <p className="small" key={r.employee_no}>
                  {r.employee_no} · {r.name} · {r.department} · {r.date_of_birth}
                </p>
              ))}
              <Button
                busy={task.busy}
                onClick={() =>
                  void task.run(async () => {
                    await api({ action: "import", payload: { employees: rows } }, okSchema);
                    setRows([]);
                    await refresh();
                  }, "직원 명단을 반영했습니다.")
                }
              >
                이 명단으로 등록·수정
              </Button>
            </>
          )}
          {task.notice && <Note error={task.failed}>{task.notice}</Note>}
        </Panel>
      </div>
      <Panel title={`직원 ${data.employees.length}명`}>
        {data.employees.map((e) => (
          <EmployeeEditor key={e.id} employee={e} />
        ))}
      </Panel>
    </div>
  );
}
