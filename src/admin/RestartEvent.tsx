import { useState } from "react";
import { stateSchema } from "../../supabase/functions/_shared/contracts";
import { Button, Confirm, Note } from "../components/ui";
import { api } from "../lib/api";
import { useTask } from "../lib/useTask";
import { useAdmin } from "./context";

export function RestartEvent({ disabled }: { readonly disabled: boolean }) {
  const { data, refresh } = useAdmin();
  const task = useTask();
  const [revision, setRevision] = useState<number | null>(null);
  return (
    <div className="stack-sm">
      <Button
        variant="secondary"
        disabled={disabled}
        busy={task.busy}
        onClick={() => setRevision(data.state.revision)}
      >
        처음부터 다시 진행
      </Button>
      <p className="small">직원 화면을 대기실로 돌려 전체 순서를 다시 진행합니다.</p>
      {task.notice && <Note error={task.failed}>{task.notice}</Note>}
      {revision !== null && (
        <Confirm
          title="행사를 처음부터 다시 진행할까요?"
          onClose={() => setRevision(null)}
          action={() =>
            task.run(async () => {
              await api(
                { action: "command", payload: { command: "restart_event", revision, rehearsal: false } },
                stateSchema,
              );
              await refresh();
            }, "대기실로 돌아왔습니다. 다음 순서부터 다시 진행해주세요.")
          }
        >
          모든 직원 화면이 대기실로 돌아가며 공개 중인 콘텐츠가 닫힙니다. 저장된 설문 답변과 추천, 이야기
          원본과 공개 검수는 보존합니다. 응답 허용 설정도 유지합니다. 직원 화면에 영향을 주지 않는 연습은
          리허설 메뉴를 이용해주세요.
        </Confirm>
      )}
    </div>
  );
}
