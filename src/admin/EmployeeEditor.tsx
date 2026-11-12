import { useState } from "react";
import { type Dashboard, okSchema } from "../../supabase/functions/_shared/contracts";
import { Button, Check, Confirm, Field, Note } from "../components/ui";
import { api } from "../lib/api";
import { useTask } from "../lib/useTask";
import { useAdmin } from "./context";

export function EmployeeEditor({ employee }: { readonly employee: Dashboard["employees"][number] }) {
  const { refresh } = useAdmin();
  const task = useTask();
  const [name, setName] = useState(employee.name);
  const [department, setDepartment] = useState(employee.department);
  const [active, setActive] = useState(employee.active);
  const [deleting, setDeleting] = useState(false);
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
              okSchema,
            );
            await refresh();
          }, "직원 정보를 저장했습니다.");
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
          <Button variant="danger" disabled={task.busy} onClick={() => setDeleting(true)}>
            직원 삭제
          </Button>
        </div>
        {task.notice && <Note error={task.failed}>{task.notice}</Note>}
      </form>
      {deleting && (
        <Confirm
          title={`${employee.name} · ${employee.department} 직원을 삭제할까요?`}
          onClose={() => setDeleting(false)}
          action={() =>
            task.run(async () => {
              await api({ action: "delete_employee", payload: { id: employee.id } }, okSchema);
              await refresh();
            })
          }
        >
          <p>
            이 직원의 설문·추천·출제 정보와 로그인 연결이 영구 삭제됩니다. 익명 대나무숲 글은 작성자를
            연결하지 않아 그대로 남습니다.
          </p>
          <p>행사 화면은 대기실로 돌아가고, 기존 취향 통계는 초기화됩니다. 삭제는 영구적입니다.</p>
        </Confirm>
      )}
    </details>
  );
}
