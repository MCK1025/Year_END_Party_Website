import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { Button, Field, Note, Panel, Select, TextArea } from "../components/ui";
import { api } from "../lib/api";
import { useTask } from "../lib/useTask";
import { useGuest } from "./Participant";

export function Nominate() {
  const { data, refresh } = useGuest();
  const task = useTask();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(data.nomination?.nominee_id ?? "");
  const [reason, setReason] = useState(data.nomination?.reason ?? "");
  const people = data.directory.filter(
    (e) => e.id !== data.self.id && (`${e.name} ${e.department}`.includes(search) || e.id === selected),
  );
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
      {!data.settings.nomination_open && <Note>추천이 마감되었습니다.</Note>}
      <Panel>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              await api({ action: "nominate", payload: { nominee_id: selected, reason } }, okSchema);
              await refresh();
              navigate("/event");
            });
          }}
        >
          <Field
            label="이름·부서로 찾기"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="어떤 동료가 떠오르나요?"
          />
          <Select
            label="추천할 동료"
            value={selected}
            onChange={setSelected}
            disabled={!data.settings.nomination_open}
          >
            <option value="">동료를 선택해주세요</option>
            {people.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.department}
              </option>
            ))}
          </Select>
          <TextArea
            label="고마운 이유 한 줄 (선택)"
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            disabled={!data.settings.nomination_open}
          />
          <p className="small">
            한 사람당 최종 추천 한 표가 반영됩니다. 마감 전까지 바꿀 수 있으며, 이유는 검수 후 익명으로 소개할
            수 있습니다.
          </p>
          {task.notice && <Note error={task.failed}>{task.notice}</Note>}
          <Button type="submit" busy={task.busy} disabled={!selected || !data.settings.nomination_open}>
            마음을 전하고 행사장으로
          </Button>
        </form>
      </Panel>
    </div>
  );
}
