import { useState } from "react";
import type { EventState, PortalRequest } from "../../supabase/functions/_shared/contracts";
import { Button, Select } from "../components/ui";
import { useAdmin } from "./context";

export type CommandInput = Omit<
  Extract<PortalRequest, { action: "command" }>["payload"],
  "revision" | "rehearsal"
>;
export type PendingCommand = { readonly label: string; readonly command: CommandInput };
export function GameControls({
  state,
  rehearsal,
  busy,
  run,
  confirm,
}: {
  readonly state: EventState;
  readonly rehearsal: boolean;
  readonly busy: boolean;
  readonly run: (command: CommandInput) => void;
  readonly confirm: (pending: PendingCommand) => void;
}) {
  const { data } = useAdmin();
  const [person, setPerson] = useState("");
  const [taste, setTaste] = useState("");
  switch (state.phase) {
    case "WHO_AM_I":
      return (
        <>
          <Select label="출제할 인물" value={person} onChange={setPerson}>
            <option value="">승인된 인물을 선택해주세요</option>
            {data.rounds
              .filter((r) => r.approved && r.eligible)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {data.employees.find((e) => e.id === r.employee_id)?.name} · 순서 {r.sort_order}
                </option>
              ))}
          </Select>
          <Button
            disabled={!person || busy || state.paused}
            onClick={() => run({ command: "start_person", round_id: person })}
          >
            이 인물로 시작
          </Button>
          <div className="actions">
            <Button
              disabled={!state.payload.round_id || busy || state.paused || Boolean(state.payload.person)}
              onClick={() => run({ command: "hint" })}
            >
              다음 힌트 공개
            </Button>
            <Button
              variant="secondary"
              disabled={!state.payload.hints?.length || busy || state.paused || Boolean(state.payload.person)}
              onClick={() => confirm({ label: "정답을 공개할까요?", command: { command: "reveal" } })}
            >
              정답 공개
            </Button>
          </div>
          <div className="actions">
            <Button
              variant="secondary"
              disabled={!state.payload.round_id || busy || state.paused}
              onClick={() =>
                confirm({ label: "현재 문제를 다시 시작할까요?", command: { command: "restart_person" } })
              }
            >
              현재 인물 다시 시작
            </Button>
            {!rehearsal && (
              <Button
                variant="secondary"
                disabled={!state.payload.person || busy || state.paused}
                onClick={() => run({ command: "next_person" })}
              >
                다음 인물
              </Button>
            )}
          </div>
        </>
      );
    case "TASTES":
      return (
        <>
          <Select label="공개할 취향" value={taste} onChange={setTaste}>
            <option value="">승인된 통계를 선택해주세요</option>
            {data.tastes
              .filter((t) => t.approved)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.prompt}
                </option>
              ))}
          </Select>
          <Button
            disabled={!taste || busy || state.paused}
            onClick={() => run({ command: "taste_question", taste_id: taste })}
          >
            질문 먼저 공개
          </Button>
          <Button
            disabled={!state.payload.taste_id || busy || state.paused}
            onClick={() =>
              confirm({ label: "취향 통계를 공개할까요?", command: { command: "taste_reveal" } })
            }
          >
            결과 공개
          </Button>
        </>
      );
    case "PRE_SURVEY":
    case "WAITING":
    case "RECAP":
    case "AWARDS":
    case "END":
      return null;
    default:
      return state.phase satisfies never;
  }
}
