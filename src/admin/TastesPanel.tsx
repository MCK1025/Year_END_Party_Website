import { useState } from "react";
import { type Dashboard, okSchema } from "../../supabase/functions/_shared/contracts";
import { Button, Check, Field, Note, Panel, Select } from "../components/ui";
import { api } from "../lib/api";
import { useTask } from "../lib/useTask";
import { useAdmin } from "./context";

function TasteEditor({ taste }: { readonly taste?: Dashboard["tastes"][number] }) {
  const { data, refresh } = useAdmin();
  const task = useTask();
  const [question, setQuestion] = useState(taste?.question_id ?? "food");
  const [prompt, setPrompt] = useState(taste?.prompt ?? "우리 회사, 오늘 가장 먹고 싶은 음식은?");
  const [approved, setApproved] = useState(taste?.approved ?? false);
  const [results, setResults] = useState(
    (taste?.results ?? []).map((r) => ({ ...r, key: crypto.randomUUID() })),
  );
  return (
    <Panel title={taste ? taste.prompt : "새로운 취향 질문"}>
      <form
        className="stack-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            await api(
              {
                action: "taste",
                payload: {
                  ...(taste ? { id: taste.id } : {}),
                  question_id: question,
                  prompt,
                  results: taste ? results : null,
                  approved,
                },
              },
              okSchema,
            );
            await refresh();
          });
        }}
      >
        <Select
          label="집계할 설문"
          value={question}
          onChange={(id) => {
            setQuestion(id);
            setApproved(false);
          }}
        >
          <option value="">질문 선택</option>
          {data.questions
            .filter((q) => q.active)
            .map((q) => (
              <option value={q.id} key={q.id}>
                {q.prompt}
              </option>
            ))}
        </Select>
        <Field
          label="직원에게 보여줄 질문"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={200}
          required
        />
        {taste && (
          <>
            <p className="small">
              자동 집계 결과를 확인하고, 유사한 자유 입력은 합쳐주세요. 공개에 동의한 활성 직원의 답변만
              집계합니다.
            </p>
            {results.map((r, i) => (
              <div className="grid-two" key={r.key}>
                <Field
                  label={`항목 ${i + 1}`}
                  value={r.label}
                  onChange={(e) => {
                    setResults(results.map((v, n) => (n === i ? { ...v, label: e.target.value } : v)));
                    setApproved(false);
                  }}
                  required
                />
                <div className="actions">
                  <Field
                    label="인원"
                    type="number"
                    value={r.count}
                    min={0}
                    max={100}
                    onChange={(e) => {
                      setResults(
                        results.map((v, n) => (n === i ? { ...v, count: Number(e.target.value) } : v)),
                      );
                      setApproved(false);
                    }}
                  />
                  <Button
                    variant="secondary"
                    aria-label={`항목 ${i + 1} 삭제`}
                    onClick={() => {
                      setResults(results.filter((_, n) => n !== i));
                      setApproved(false);
                    }}
                  >
                    제외
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="secondary"
              onClick={() => {
                setResults([...results, { label: "", count: 0, key: crypto.randomUUID() }]);
                setApproved(false);
              }}
            >
              항목 추가
            </Button>
            <Button
              variant="secondary"
              busy={task.busy}
              onClick={() =>
                void task.run(async () => {
                  await api(
                    {
                      action: "taste",
                      payload: {
                        id: taste.id,
                        question_id: question,
                        prompt,
                        results: null,
                        approved: false,
                      },
                    },
                    okSchema,
                  );
                  await refresh();
                }, "최신 답변으로 다시 집계했습니다.")
              }
            >
              최신 답변으로 다시 집계
            </Button>
          </>
        )}
        {taste && (
          <Check checked={approved} onChange={setApproved}>
            집계와 표기를 확인했습니다. 공개를 승인합니다.
          </Check>
        )}
        <Button type="submit" busy={task.busy}>
          {taste ? "검수 결과 저장" : "응답 자동 집계하기"}
        </Button>
        {task.notice && <Note error={task.failed}>{task.notice}</Note>}
      </form>
    </Panel>
  );
}
export function TastesPanel() {
  const { data } = useAdmin();
  return (
    <div className="grid-two">
      <TasteEditor />
      {data.tastes.map((t) => (
        <TasteEditor key={`${t.id}-${JSON.stringify(t.results)}-${t.approved}`} taste={t} />
      ))}
    </div>
  );
}
