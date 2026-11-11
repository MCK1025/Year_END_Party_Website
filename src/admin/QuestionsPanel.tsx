import { useState } from "react";
import { type Dashboard, okSchema } from "../../supabase/functions/_shared/contracts";
import { Button, Check, Field, Note, Panel } from "../components/ui";
import { api } from "../lib/api";
import { useTask } from "../lib/useTask";
import { useAdmin } from "./context";

function Question({ question }: { readonly question: Dashboard["questions"][number] }) {
  const { refresh } = useAdmin();
  const task = useTask();
  const [prompt, setPrompt] = useState(question.prompt);
  const [choices, setChoices] = useState(question.choices.join(","));
  const [active, setActive] = useState(question.active);
  return (
    <Panel title={`질문 ${question.sort_order}`}>
      <form
        className="stack-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            await api(
              {
                action: "question",
                payload: {
                  ...question,
                  prompt,
                  choices: choices
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                  active,
                },
              },
              okSchema,
            );
            await refresh();
          });
        }}
      >
        <Field
          label="질문 문구"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          required
          maxLength={200}
        />
        <Field
          label="선택 항목 (쉼표로 구분, 비워두면 자유 입력)"
          value={choices}
          onChange={(e) => setChoices(e.target.value)}
        />
        <Check checked={active} onChange={setActive}>
          이 질문을 설문에 표시
        </Check>
        <Button type="submit" busy={task.busy}>
          질문 저장
        </Button>
        {task.notice && <Note error={task.failed}>{task.notice}</Note>}
      </form>
    </Panel>
  );
}
export function QuestionsPanel() {
  const { data } = useAdmin();
  return (
    <div className="stack">
      <Note>질문을 수정하면 관련 게임·통계 승인이 해제됩니다. 직원 설문을 다시 확인한 뒤 검수해주세요.</Note>
      <div className="grid-two">
        {data.questions.map((q) => (
          <Question key={q.id} question={q} />
        ))}
      </div>
    </div>
  );
}
