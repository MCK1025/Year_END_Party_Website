import { okSchema } from "../../supabase/functions/_shared/contracts";
import { useBookDraft } from "../components/book/drafts";
import { useSavedNavigation } from "../components/book/useSavedNavigation";
import { Button, Check, Note, Panel, Select, TextArea } from "../components/ui";
import { api } from "../lib/api";
import { useTask } from "../lib/useTask";
import { useGuest } from "./Participant";

export function Survey() {
  const { data, refresh } = useGuest();
  const navigate = useSavedNavigation();
  const task = useTask();
  const [draftAnswers, setAnswers, forgetAnswers] = useBookDraft("answers", data.survey?.answers ?? {});
  const [draftConsent, setConsent, forgetConsent] = useBookDraft("consent", data.survey?.consent ?? false);
  const excluded = data.survey?.excluded ?? [];
  const open = data.settings.survey_open && !data.state.editing_locked && !data.settings.started_at;
  const answers = open ? draftAnswers : (data.survey?.answers ?? {});
  const consent = open ? draftConsent : (data.survey?.consent ?? false);
  return (
    <div className="stack">
      <header className="page-heading">
        <p className="overline">Prologue · 나를 소개하는 여섯 문장</p>
        <h1>
          아직 들려주지 않은
          <br />
          당신의 이야기.
        </h1>
        <p className="muted">짧아도 좋아요. 오늘 대화의 작은 실마리가 됩니다.</p>
      </header>
      {!open && <Note>설문이 마감되었습니다. 저장한 이야기는 그대로 남아 있습니다.</Note>}
      <form
        className="stack survey-entries"
        onSubmit={(event) => {
          event.preventDefault();
          void task.run(async () => {
            await api({ action: "save_survey", payload: { answers, consent, excluded } }, okSchema);
            await refresh();
            forgetAnswers();
            forgetConsent();
            navigate("/nominate");
          });
        }}
      >
        {data.questions.map((q, index) => (
          <Panel key={q.id}>
            <p className="overline">QUESTION {String(index + 1).padStart(2, "0")}</p>
            {q.choices.length ? (
              <>
                <Select
                  label={q.prompt}
                  value={
                    q.choices.includes(answers[q.id] ?? "")
                      ? (answers[q.id] ?? "")
                      : answers[q.id]
                        ? "기타"
                        : ""
                  }
                  onChange={(v) => setAnswers({ ...answers, [q.id]: v === "기타" ? "기타: " : v })}
                  disabled={!open || task.busy}
                >
                  <option value="">선택해주세요</option>
                  {q.choices.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
                {(answers[q.id]?.startsWith("기타") ||
                  Boolean(answers[q.id] && !q.choices.includes(answers[q.id] ?? ""))) && (
                  <TextArea
                    label="기타 답변"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    required
                    disabled={!open || task.busy}
                  />
                )}
              </>
            ) : (
              <TextArea
                label={q.prompt}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                required
                disabled={!open || task.busy}
              />
            )}
          </Panel>
        ))}
        <Panel title="공개 활용 동의">
          <p className="small">
            답변은 행사 운영과 동료 소개에만 사용합니다. 동의한 답변도 관리자의 검수를 거친 뒤 공개합니다.
            공개 활용 동의는 선택입니다. 행사 참여에는 영향이 없습니다.
          </p>
          <p className="small">
            개인정보 삭제 예정일: {data.settings.deletion_date ?? "관리자가 안내할 예정입니다."}
          </p>
          <Check checked={consent} onChange={setConsent} disabled={!open || task.busy}>
            내 답변을 인물 힌트와 익명 취향 통계에 활용하는 데 동의합니다.
          </Check>
        </Panel>
        {task.notice && <Note error={task.failed}>{task.notice}</Note>}
        <Button type="submit" busy={task.busy} disabled={!open || task.busy}>
          이야기 저장하고 다음으로
        </Button>
      </form>
    </div>
  );
}
