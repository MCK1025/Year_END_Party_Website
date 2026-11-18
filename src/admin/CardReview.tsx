import { useState } from "react";
import { type Dashboard, okSchema } from "../../supabase/functions/_shared/contracts";
import { Button, Check, Note } from "../components/ui";
import { api } from "../lib/api";
import { useTask } from "../lib/useTask";
import { useAdmin } from "./context";

export function CardReview({ survey }: { readonly survey: Dashboard["surveys"][number] }) {
  const { data, refresh } = useAdmin();
  const task = useTask();
  const [keys, setKeys] = useState(
    data.card_reviews.find((r) => r.employee_id === survey.employee_id)?.question_keys ?? [],
  );
  const eligible = data.questions.filter(
    (q) => q.active && !survey.excluded.includes(q.id) && survey.answers[q.id]?.trim(),
  );
  return (
    <form
      className="stack-sm"
      onSubmit={(event) => {
        event.preventDefault();
        void task.run(async () => {
          await api(
            {
              action: "review_card",
              payload: {
                employee_id: survey.employee_id,
                question_keys: keys,
                revision: data.state.revision,
              },
            },
            okSchema,
          );
          await refresh();
        }, "취향 카드 공개 항목을 저장했습니다.");
      }}
    >
      <h3>자유 관람 취향 카드</h3>
      <p className="small">
        이름·소속과 함께 공개할 원문 답변을 선택해주세요. 모든 선택을 해제하면 공개를 취소합니다.
      </p>
      {!survey.consent && <Note>공개 활용에 동의하지 않은 답변입니다.</Note>}
      {eligible.map((q) => (
        <Check
          key={q.id}
          checked={keys.includes(q.id)}
          disabled={!survey.consent || task.busy}
          onChange={(selected) => setKeys(selected ? [...keys, q.id] : keys.filter((k) => k !== q.id))}
        >
          {q.prompt}
          <br />
          {survey.answers[q.id]}
        </Check>
      ))}
      <Button type="submit" busy={task.busy} disabled={!survey.consent}>
        취향 카드 공개 검수 저장
      </Button>
      {task.notice && <Note error={task.failed}>{task.notice}</Note>}
    </form>
  );
}
