import { useState } from "react";
import { employeeCsvSchema, okSchema } from "../../supabase/functions/_shared/contracts";
import { Button, Field, Note, Panel } from "../components/ui";
import { api } from "../lib/api";
import { useTask } from "../lib/useTask";
import { useAdmin } from "./context";

const empty = { employee_no: "", name: "", department: "", date_of_birth: "" };
export function AddEmployee() {
  const [form, setForm] = useState(empty);
  const { refresh } = useAdmin();
  const task = useTask();
  return (
    <Panel title="직원 한 명 추가">
      <p className="small">
        로그인에는 생년월일 6자리를 사용합니다. 사번과 생년월일 6자리가 중복된 활성 직원은 등록되지 않습니다.
      </p>
      <form
        className="stack-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            await api({ action: "create_employee", payload: employeeCsvSchema.parse(form) }, okSchema);
            setForm(empty);
            await refresh();
          }, "새 직원을 추가했습니다. 비밀번호는 생년월일 6자리입니다.");
        }}
      >
        <Field
          label="새 직원 사번"
          value={form.employee_no}
          onChange={(e) => setForm({ ...form, employee_no: e.target.value })}
          maxLength={100}
          required
        />
        <Field
          label="새 직원 이름"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          maxLength={60}
          required
        />
        <Field
          label="새 직원 부서"
          value={form.department}
          onChange={(e) => setForm({ ...form, department: e.target.value })}
          maxLength={100}
          required
        />
        <Field
          label="새 직원 생년월일"
          type="date"
          value={form.date_of_birth}
          onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
          required
        />
        <Button type="submit" busy={task.busy}>
          직원 추가
        </Button>
        {task.notice && <Note error={task.failed}>{task.notice}</Note>}
      </form>
    </Panel>
  );
}
