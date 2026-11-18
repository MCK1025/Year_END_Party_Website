import { Note, Panel } from "../components/ui";
import { CardReview } from "./CardReview";
import { useAdmin } from "./context";

export function PersonCardsPanel() {
  const { data } = useAdmin();
  const registered = data.employees.filter(
    (e) => e.active && data.surveys.some((s) => s.employee_id === e.id),
  );
  const reviewed = registered.filter((e) => data.card_reviews.some((r) => r.employee_id === e.id));
  return (
    <div className="stack">
      <Panel title="혜성식품 인물 카드">
        <p>
          설문 등록 {registered.length}명 · 공개 승인 {reviewed.length}명 · 검수 대기{" "}
          {registered.length - reviewed.length}명
        </p>
        <p className="small">
          설문을 저장한 직원이 여기에 등록됩니다. 답변을 선택하고 공개 검수를 저장하면 행사 종료 후 직원
          화면에 표시됩니다.
        </p>
      </Panel>
      {registered.length === 0 && <Note>아직 등록된 설문이 없습니다.</Note>}
      {registered.map((person) => {
        const survey = data.surveys.find((s) => s.employee_id === person.id);
        if (!survey) return null;
        const review = data.card_reviews.find((r) => r.employee_id === person.id);
        return (
          <Panel key={person.id} title={`${person.name} · ${person.department}`}>
            <p className="small">
              {review ? `공개 승인 · 답변 ${review.question_keys.length}개` : "미공개 · 검수가 필요합니다."}
            </p>
            <CardReview
              key={`${survey.updated_at}-${JSON.stringify(review?.question_keys)}`}
              survey={survey}
            />
          </Panel>
        );
      })}
    </div>
  );
}
