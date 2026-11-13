import { useState } from "react";
import { stateSchema } from "../../supabase/functions/_shared/contracts";
import { TreeCollection } from "../components/tree/TreeCollection";
import { Button, Check, Confirm, Note, Panel } from "../components/ui";
import { api } from "../lib/api";
import { useTask } from "../lib/useTask";
import { useAdmin } from "./context";

export function TreePanel() {
  const { data, refresh } = useAdmin();
  const task = useTask();
  const [reviewed, setReviewed] = useState(false);
  const [pending, setPending] = useState<{
    readonly command: "tree_open" | "tree_close";
    readonly revision: number;
  } | null>(null);
  const open = data.state.tree_open;
  return (
    <div className="stack">
      <Panel title="이름 없이, 함께 읽는 마음">
        <p>
          대나무숲의 전체 글을 검수한 뒤 트리를 공개합니다. 직원들은 각자 쪽지를 눌러 확대하고, 바깥을 누르면
          트리로 돌아갑니다.
        </p>
        <p className="small">
          개인정보나 비방 글은 대나무숲 메뉴에서 먼저 삭제해주세요. 아래 트리는 운영자 전용 미리보기입니다.
        </p>
        <Note>{open ? "직원에게 마음 트리를 공개하고 있습니다." : "아직 직원에게 공개되지 않았습니다."}</Note>
        {!open && (
          <Check checked={reviewed} onChange={setReviewed}>
            전체 글의 개인정보·비방 내용을 검수했습니다.
          </Check>
        )}
        {!data.settings.started_at && (
          <Note>
            먼저 실시간 진행 메뉴에서 행사를 시작해주세요. 트리는 행사일 오후 6시 이후 공개 가능합니다.
          </Note>
        )}
        <Button
          disabled={task.busy || (!open && (!reviewed || !data.settings.started_at))}
          onClick={() =>
            setPending({ command: open ? "tree_close" : "tree_open", revision: data.state.revision })
          }
        >
          {open ? "트리 공개 종료" : "검수한 전체 글로 트리 공개"}
        </Button>
        {task.notice && <Note error={task.failed}>{task.notice}</Note>}
      </Panel>
      <TreeCollection key={data.state.revision} />
      {pending && (
        <Confirm
          title={
            pending.command === "tree_open" ? "마음 트리를 모두에게 공개할까요?" : "트리 공개를 종료할까요?"
          }
          onClose={() => setPending(null)}
          action={() =>
            task.run(async () => {
              await api(
                { action: "command", payload: { ...pending, rehearsal: false, reviewed: true } },
                stateSchema,
              );
              await refresh();
            }, "트리 공개 상태를 반영했습니다.")
          }
        >
          <p>
            {pending.command === "tree_open"
              ? "현재 전체 글이 익명으로 직원에게 공개되며, 직원 휴대폰은 마음 트리로 이동합니다. 이미 읽은 내용은 회수할 수 없습니다."
              : "직원 화면은 기존 행사 진행으로 돌아가며, 전체 쪽지 조회가 종료됩니다."}
          </p>
        </Confirm>
      )}
    </div>
  );
}
