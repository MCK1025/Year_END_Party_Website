import { useState } from "react";
import { type EventState, type Phase, stateSchema } from "../../supabase/functions/_shared/contracts";
import { commandSchema } from "../../supabase/functions/_shared/requests";
import { EventView, phaseNames } from "../components/EventView";
import { Button, Confirm, Note, Panel } from "../components/ui";
import { api } from "../lib/api";
import { useTask } from "../lib/useTask";
import { useAdmin } from "./context";
import { type CommandInput, GameControls, type PendingCommand } from "./GameControls";

const next: Partial<Record<Phase, Phase>> = {
  PRE_SURVEY: "RECAP",
  WAITING: "RECAP",
  RECAP: "WHO_AM_I",
  WHO_AM_I: "TASTES",
  TASTES: "AWARDS",
  AWARDS: "END",
};
const initial: EventState = { phase: "WHO_AM_I", payload: {}, paused: false, revision: 0 };
export function ProgressPanel({ rehearsal = false }: { readonly rehearsal?: boolean }) {
  const { data, refresh } = useAdmin();
  const task = useTask();
  const state = rehearsal ? (data.rehearsal ?? initial) : data.state;
  const [pending, setPending] = useState<(PendingCommand & { readonly revision: number }) | null>(null);
  const following = next[state.phase];
  const confirm = (value: PendingCommand) => setPending({ ...value, revision: state.revision });
  async function send(partial: CommandInput, revision = state.revision) {
    await api(
      {
        action: "command",
        payload: commandSchema.parse({ ...partial, revision, rehearsal }),
      },
      stateSchema,
    );
    await refresh();
  }
  const run = (partial: CommandInput) => {
    void task.run(() => send(partial), "진행 상태를 반영했습니다.");
  };
  return (
    <div className="stack">
      {rehearsal ? (
        <Note>
          운영자 전용 연습입니다. 직원 화면과 공식 집계에는 반영되지 않습니다. 승인된 한 인물로 연습해주세요.
        </Note>
      ) : (
        <div className="stat-grid">
          {[
            ["참여 직원", data.employees.filter((e) => e.active).length],
            ["설문 제출", data.surveys.length],
            ["추천 완료", data.nominations.length],
            ["최근 접속", data.employees.filter((e) => e.online).length],
          ].map(([label, value]) => (
            <div className="stat" key={label}>
              <span className="small">{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="grid-two">
        <Panel title={rehearsal ? "한 사람 리허설" : "지금, 우리의 순서"}>
          <p className="overline">
            {phaseNames[state.phase]} · REV {state.revision}
          </p>
          <p>
            {state.paused ? "일시 정지 중" : "진행 중"} · 공개된 힌트 {state.payload.hints?.length ?? 0}개
          </p>
          <p className="small">
            마지막 조작:{" "}
            {state.updated_at
              ? new Date(state.updated_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul" })
              : "아직 없음"}
          </p>
          <div className="actions">
            <Button
              variant="secondary"
              busy={task.busy}
              onClick={() => run({ command: state.paused ? "resume" : "pause" })}
            >
              {state.paused ? "진행 재개" : "잠시 정지"}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                confirm({
                  label: rehearsal ? "연습을 초기화할까요?" : "대기실로 돌아갈까요?",
                  command: { command: "waiting" },
                })
              }
            >
              대기·초기화
            </Button>
          </div>
          {!rehearsal && following && (
            <Button
              disabled={task.busy || state.paused}
              onClick={() =>
                confirm({
                  label: `${phaseNames[following]} 단계를 공개할까요?`,
                  command: { command: "phase", phase: following },
                })
              }
            >
              다음 순서 · {phaseNames[following]}
            </Button>
          )}
          <GameControls state={state} rehearsal={rehearsal} busy={task.busy} run={run} confirm={confirm} />
          {!rehearsal && (
            <Button
              variant="secondary"
              disabled={task.busy}
              onClick={() => confirm({ label: "직전 진행으로 되돌릴까요?", command: { command: "undo" } })}
            >
              직전 진행 되돌리기
            </Button>
          )}
          {task.notice && <Note error={task.failed}>{task.notice}</Note>}
        </Panel>
        <Panel title="직원 화면 미리보기">
          <div className="progress-preview">
            <EventView state={state} />
          </div>
        </Panel>
      </div>
      {!rehearsal && (
        <Panel title="최근 운영 기록">
          {data.logs.slice(0, 8).map((l) => (
            <p className="small" key={l.id}>
              {new Date(l.created_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul" })} · {l.action}
            </p>
          ))}
        </Panel>
      )}
      {pending && (
        <Confirm
          title={pending.label}
          onClose={() => setPending(null)}
          action={() => task.run(() => send(pending.command, pending.revision), "진행 상태를 반영했습니다.")}
        >
          공개된 정보는 직원 휴대폰에 바로 표시됩니다. 이미 본 내용은 되돌려도 기억에서 지울 수 없습니다.
        </Confirm>
      )}
    </div>
  );
}
