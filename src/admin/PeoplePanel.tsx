import { useState } from "react";
import { type Dashboard, issuedSchema } from "../../supabase/functions/_shared/contracts";
import { Button, Check, Confirm, Field, Note, Panel } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { type EmployeeRow, parseEmployees } from "../lib/csv";
import { downloadCsv } from "../lib/download";
import { useTask } from "../lib/useTask";
import { useAdmin } from "./context";

type Employee = Dashboard["employees"][number];
function EmployeeEditor({
  employee,
  reset,
}: {
  readonly employee: Employee;
  readonly reset: (employee: Employee) => void;
}) {
  const { refresh } = useAdmin();
  const task = useTask();
  const [name, setName] = useState(employee.name);
  const [department, setDepartment] = useState(employee.department);
  const [active, setActive] = useState(employee.active);
  return (
    <details className="data-row">
      <summary>
        {employee.name} · {employee.department}{" "}
        <span className="pill">
          {employee.employee_no} / {employee.active ? "활성" : "비활성"}
        </span>
      </summary>
      <form
        className="stack-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            await api(
              { action: "employee", payload: { id: employee.id, name, department, active } },
              issuedSchema,
            );
            await refresh();
          });
        }}
      >
        <Field label="이름" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        <Field
          label="부서"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          required
          maxLength={100}
        />
        <Check checked={active} onChange={setActive}>
          행사 참여 활성화
        </Check>
        <div className="actions">
          <Button type="submit" busy={task.busy}>
            수정 저장
          </Button>
          <Button variant="secondary" onClick={() => reset(employee)}>
            코드 재발급
          </Button>
        </div>
        {task.notice && <Note error={task.failed}>{task.notice}</Note>}
      </form>
    </details>
  );
}
export function PeoplePanel() {
  const { data, refresh } = useAdmin();
  const task = useTask();
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [issued, setIssued] = useState<ReturnType<typeof issuedSchema.parse>["issued"]>([]);
  const [reset, setReset] = useState<Employee | null>(null);
  const [search, setSearch] = useState("");
  async function read(file: File) {
    if (file.size > 100000) throw new ApiError("CSV는 100KB 이하로 준비해주세요.");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    setRows(parseEmployees(text));
    setIssued([]);
  }
  return (
    <div className="stack">
      <div className="grid-two">
        <Panel title="직원 명단 가져오기">
          <p className="small">
            UTF-8 CSV · employee_no,name,department,date_of_birth 순서로 준비해주세요. 기존 사번은
            이름·부서·생년월일을 수정하고, 신규 직원에게만 새 코드를 발급합니다.
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
                    const result = await api(
                      { action: "import", payload: { employees: rows } },
                      issuedSchema,
                    );
                    setIssued(result.issued);
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
        <Panel title="이번에 발급한 개인코드">
          <p className="small">
            화면을 떠나면 코드 원문을 다시 조회할 수 없습니다. 각 직원에게 개별 전달하고, 배포가 끝난 파일은
            삭제해주세요.
          </p>
          {issued.length === 0 ? (
            <p className="empty">새로 발급한 코드가 없습니다.</p>
          ) : (
            <>
              {issued.map((i) => (
                <p key={i.employee_no}>
                  {i.name} · <code>{i.access_code}</code>
                </p>
              ))}
              <Button variant="secondary" onClick={() => downloadCsv(issued, "개인행사코드-개별전달.csv")}>
                발급 코드 파일 다운로드
              </Button>
            </>
          )}
        </Panel>
      </div>
      <Panel title={`직원 ${data.employees.length}명`}>
        <Field label="이름·부서·사번 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
        {data.employees
          .filter((e) => `${e.name} ${e.department} ${e.employee_no}`.includes(search))
          .map((e) => (
            <EmployeeEditor key={e.id} employee={e} reset={setReset} />
          ))}
      </Panel>
      {reset && (
        <Confirm
          title={`${reset.name} 님의 코드를 재발급할까요?`}
          onClose={() => setReset(null)}
          action={() =>
            task.run(async () => {
              const result = await api({ action: "reset_code", payload: { id: reset.id } }, issuedSchema);
              setIssued(result.issued);
              await refresh();
            }, "코드를 재발급했습니다.")
          }
        >
          기존 코드는 사용할 수 없게 되고, 연결된 모든 기기에서 다시 본인 확인해야 합니다.
        </Confirm>
      )}
    </div>
  );
}
