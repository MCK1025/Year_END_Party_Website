import { useState } from "react";
import { type Dashboard, okSchema } from "../../supabase/functions/_shared/contracts";
import { Button, Check, Field, Note, Panel, TextArea } from "../components/ui";
import { api } from "../lib/api";
import { useTask } from "../lib/useTask";
import { useAdmin } from "./context";

function ReasonReview({ nomination }: { readonly nomination: Dashboard["nominations"][number] }) {
  const { data, refresh } = useAdmin();
  const review = data.reviews.find((r) => r.voter_id === nomination.voter_id);
  const [text, setText] = useState(review?.public_text ?? nomination.reason);
  const [approved, setApproved] = useState(review?.approved ?? false);
  const task = useTask();
  return (
    <form
      className="stack-sm"
      onSubmit={(e) => {
        e.preventDefault();
        void task.run(async () => {
          await api(
            {
              action: "review_reason",
              payload: { voter_id: nomination.voter_id, public_text: text, approved },
            },
            okSchema,
          );
          await refresh();
        });
      }}
    >
      <TextArea
        label="익명으로 공개할 추천 이유"
        value={text}
        maxLength={300}
        onChange={(e) => setText(e.target.value)}
      />
      <Check checked={approved} onChange={setApproved}>
        추천자를 알아볼 수 있는 내용이 없는지 검수했습니다.
      </Check>
      <Button type="submit" busy={task.busy}>
        공개 검수 저장
      </Button>
      {task.notice && <Note error={task.failed}>{task.notice}</Note>}
    </form>
  );
}
export function DataPanel() {
  const { data } = useAdmin();
  const [search, setSearch] = useState("");
  const active = data.employees.filter((e) => e.active);
  const complete = active.filter((e) => data.surveys.some((s) => s.employee_id === e.id));
  const voted = active.filter((e) => data.nominations.some((n) => n.voter_id === e.id));
  const counts = active
    .map((e) => ({
      ...e,
      count: data.nominations.filter((n) => n.nominee_id === e.id && active.some((a) => a.id === n.voter_id))
        .length,
    }))
    .sort((a, b) => b.count - a.count);
  return (
    <div className="stack">
      <div className="grid-two">
        <Panel title="제출 현황">
          <p>
            활성 직원 {active.length}명 · 설문 {complete.length}명 · 미작성 {active.length - complete.length}
            명 · 추천 {voted.length}명
          </p>
          <p className="small">
            설문 미작성:{" "}
            {active
              .filter((e) => !complete.includes(e))
              .map((e) => e.name)
              .join(", ") || "없음"}
          </p>
        </Panel>
        <Panel title="추천 집계 (운영자 전용)">
          {counts.map((e) => (
            <p key={e.id}>
              {e.name} · {e.department} <strong>{e.count}표</strong>
            </p>
          ))}
          <p className="small">최다 득표 동률은 공동 수상입니다. 0표면 수상자를 공개하지 않습니다.</p>
        </Panel>
      </div>
      <Panel title="직원별 원본 조회">
        <Field label="이름·부서 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
        {data.employees
          .filter((e) => `${e.name} ${e.department}`.includes(search))
          .map((e) => {
            const survey = data.surveys.find((s) => s.employee_id === e.id);
            const nomination = data.nominations.find((n) => n.voter_id === e.id);
            return (
              <details className="data-row" key={e.id}>
                <summary>
                  {e.name} · {e.department}{" "}
                  <span className="pill">
                    설문 {survey ? "완료" : "미작성"} / 추천 {nomination ? "완료" : "미작성"}
                  </span>
                </summary>
                {survey ? (
                  <div className="stack-sm">
                    <p className="small">
                      게임 활용 {survey.consent ? "동의" : "비동의"} ·{" "}
                      {new Date(survey.updated_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                    </p>
                    {data.questions.map((q) => (
                      <div key={q.id}>
                        <strong>{q.prompt}</strong>
                        <p>
                          {survey.answers[q.id] ?? "미작성"}{" "}
                          {survey.excluded.includes(q.id) && <span className="pill">공개 제외</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty">저장된 설문이 없습니다.</p>
                )}
                {nomination && (
                  <div className="stack-sm">
                    <p>추천한 동료: {data.employees.find((x) => x.id === nomination.nominee_id)?.name}</p>
                    <p>원본 이유: {nomination.reason || "미작성"}</p>
                    <ReasonReview key={nomination.updated_at} nomination={nomination} />
                  </div>
                )}
              </details>
            );
          })}
      </Panel>
    </div>
  );
}
