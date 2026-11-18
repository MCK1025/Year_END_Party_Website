import { useState } from "react";
import { type Dashboard, okSchema } from "../../supabase/functions/_shared/contracts";
import { Button, Check, Confirm, Field, Note, Panel, Select, TextArea } from "../components/ui";
import { api } from "../lib/api";
import { useTask } from "../lib/useTask";
import { useAdmin } from "./context";

function RoundEditor({ round }: { readonly round?: Dashboard["rounds"][number] }) {
  const { data, refresh } = useAdmin();
  const task = useTask();
  const [employee, setEmployee] = useState(round?.employee_id ?? "");
  const [keys, setKeys] = useState(round?.question_keys ?? []);
  const [hints, setHints] = useState(round?.hints ?? []);
  const [approved, setApproved] = useState(true);
  const [order, setOrder] = useState(round?.sort_order ?? 0);
  const [confirm, setConfirm] = useState(false);
  const eligible = data.employees.filter((e) => e.active && data.surveys.some((s) => s.employee_id === e.id));
  const survey = data.surveys.find((s) => s.employee_id === employee);
  const questions = data.questions.filter(
    (q) => q.active && survey && !survey.excluded.includes(q.id) && survey.answers[q.id]?.trim(),
  );
  function toggle(key: string, checked: boolean) {
    if (checked && keys.length < 6) {
      setKeys([...keys, key]);
      setHints([...hints, survey?.answers[key] ?? ""]);
    }
    if (!checked) {
      const i = keys.indexOf(key);
      setKeys(keys.filter((k) => k !== key));
      setHints(hints.filter((_, n) => n !== i));
    }
  }
  return (
    <Panel title={round ? "인물 문제 수정" : "새 인물 문제"}>
      <form
        className="stack-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            await api(
              {
                action: "round",
                payload: {
                  ...(round ? { id: round.id } : {}),
                  employee_id: employee,
                  question_keys: keys,
                  hints,
                  approved,
                  sort_order: order,
                },
              },
              okSchema,
            );
            await refresh();
            if (!round) {
              setEmployee("");
              setKeys([]);
              setHints([]);
              setApproved(true);
            }
          });
        }}
      >
        {round && !round.eligible && <Note error>답변 또는 문항이 변경되었습니다. 다시 검수해주세요.</Note>}
        <Select
          label="설문을 등록한 직원"
          value={employee}
          onChange={(id) => {
            const nextSurvey = data.surveys.find((s) => s.employee_id === id);
            const selected = data.questions
              .filter(
                (q) =>
                  q.active &&
                  nextSurvey &&
                  !nextSurvey.excluded.includes(q.id) &&
                  nextSurvey.answers[q.id]?.trim(),
              )
              .slice(0, 6);
            setEmployee(id);
            setKeys(selected.map((q) => q.id));
            setHints(selected.map((q) => nextSurvey?.answers[q.id] ?? ""));
            setApproved(true);
          }}
        >
          <option value="">직원을 선택해주세요</option>
          {eligible.map((e) => (
            <option value={e.id} key={e.id}>
              {e.name} · {e.department}
            </option>
          ))}
        </Select>
        {employee && (
          <div>
            <p className="small">질문과 답변을 1~6개 선택하세요. 선택한 순서대로 함께 공개합니다.</p>
            {questions.map((q) => (
              <Check
                key={q.id}
                checked={keys.includes(q.id)}
                onChange={(v) => toggle(q.id, v)}
                disabled={keys.length >= 6 && !keys.includes(q.id)}
              >
                {q.prompt}
                <br />
                <span className="muted">{survey?.answers[q.id]}</span>
              </Check>
            ))}
          </div>
        )}
        {keys.map((key, i) => (
          <TextArea
            key={key}
            label={`힌트 ${i + 1} · ${data.questions.find((q) => q.id === key)?.prompt}`}
            value={hints[i] ?? ""}
            onChange={(e) => {
              setHints(hints.map((h, n) => (n === i ? e.target.value : h)));
            }}
            required
          />
        ))}
        <Field
          label="문제 순서"
          type="number"
          min={0}
          max={100}
          value={order}
          onChange={(e) => setOrder(Number(e.target.value))}
        />
        <Check checked={approved} onChange={setApproved}>
          답변과 힌트를 확인하고 저장할 때 이 문제의 공개를 승인합니다.
        </Check>
        <div className="actions">
          <Button type="submit" busy={task.busy} disabled={!employee || keys.length === 0}>
            문제 저장
          </Button>
          {round && (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              삭제
            </Button>
          )}
        </div>
        {task.notice && <Note error={task.failed}>{task.notice}</Note>}
      </form>
      {confirm && round && (
        <Confirm
          title="이 문제를 삭제할까요?"
          onClose={() => setConfirm(false)}
          action={() =>
            task.run(async () => {
              await api({ action: "delete_round", payload: { id: round.id } }, okSchema);
              await refresh();
            })
          }
        >
          저장된 힌트와 출제 순서가 삭제됩니다.
        </Confirm>
      )}
    </Panel>
  );
}
export function RoundsPanel() {
  const { data } = useAdmin();
  return (
    <div className="stack">
      <Note>
        원본 설문과 공개 제외 항목을 확인한 뒤 힌트를 작성해주세요. 답변이 수정되면 관련 문제의 승인이 자동
        해제됩니다.
      </Note>
      <div className="grid-two">
        <RoundEditor />
        {data.rounds.map((r) => (
          <RoundEditor key={`${r.id}-${r.approved}`} round={r} />
        ))}
      </div>
    </div>
  );
}
