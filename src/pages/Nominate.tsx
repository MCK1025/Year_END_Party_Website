import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { Button, Note, Panel, Select, TextArea } from "../components/ui";
import { api } from "../lib/api";
import { useTask } from "../lib/useTask";
import { useGuest } from "./Participant";

export function Nominate() {
  const { data, refresh } = useGuest();
  const task = useTask();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(data.nomination?.nominee_id ?? "");
  const [reason, setReason] = useState(data.nomination?.reason ?? "");
  const people = data.directory.filter((e) => e.id !== data.self.id);
  const open = data.settings.nomination_open && !data.state.editing_locked && !data.settings.started_at;
  const submitted = data.nomination;
  const nominee = people.find((e) => e.id === submitted?.nominee_id);
  const reasonLength = Array.from(reason.trim()).length;
  return (
    <div className="stack">
      <header className="page-heading">
        <p className="overline">A quiet thank you</p>
        <h1>
          올해, 고마웠던
          <br />한 사람.
        </h1>
        <p className="muted">든든했던 순간을 떠올려 한 명의 동료를 추천해주세요.</p>
      </header>
      {!open && <Note>추천이 마감되었습니다. 제출한 내용은 확인만 가능합니다.</Note>}
      {submitted && !editing ? (
        <Panel title="이미 추천하였습니다.">
          <p>{nominee ? `${nominee.name} · ${nominee.department}` : "추천한 동료"}</p>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {submitted.reason || "추천 이유를 남기지 않았습니다."}
          </p>
          {open && (
            <Button
              variant="secondary"
              onClick={() => {
                setSelected(submitted.nominee_id);
                setReason(submitted.reason);
                setEditing(true);
              }}
            >
              추천 수정하기
            </Button>
          )}
          {task.notice && <Note error={task.failed}>{task.notice}</Note>}
        </Panel>
      ) : (
        <Panel>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(
                async () => {
                  await api({ action: "nominate", payload: { nominee_id: selected, reason } }, okSchema);
                  await refresh();
                  setEditing(false);
                  if (!submitted) navigate("/event");
                },
                submitted ? "추천을 수정했습니다." : "추천을 저장했습니다.",
              );
            }}
          >
            <Select label="추천할 동료" value={selected} onChange={setSelected} disabled={!open || task.busy}>
              <option value="">동료를 선택해주세요</option>
              {people.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.department}
                </option>
              ))}
            </Select>
            <TextArea
              label="고마운 이유 (10자 이상)"
              value={reason}
              required
              minLength={10}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              disabled={!open || task.busy}
            />
            <p className="small" aria-live="polite">
              {reasonLength} / 300자 · 추천 이유를 10자 이상 작성해주세요.
            </p>
            <p className="small">
              한 사람당 최종 추천 한 표가 반영됩니다. 마감 전까지 바꿀 수 있으며, 이유는 검수 후 익명으로
              소개할 수 있습니다.
            </p>
            {task.notice && <Note error={task.failed}>{task.notice}</Note>}
            <Button type="submit" busy={task.busy} disabled={!selected || !open || reasonLength < 10}>
              {submitted ? "추천 수정 저장" : "마음을 전하고 행사장으로"}
            </Button>
            {submitted && (
              <Button variant="secondary" disabled={task.busy} onClick={() => setEditing(false)}>
                수정 취소
              </Button>
            )}
          </form>
        </Panel>
      )}
    </div>
  );
}
