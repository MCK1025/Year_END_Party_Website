import { useState } from "react";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { PrivateImage } from "../components/PrivateImage";
import { Button, Check, Confirm, Field, Note, Panel, TextArea } from "../components/ui";
import { api, upload } from "../lib/api";
import { exportData } from "../lib/exportData";
import { useTask } from "../lib/useTask";
import { useAdmin } from "./context";

export function SettingsPanel() {
  const { data, refresh } = useAdmin();
  const initial = data.settings;
  const locked = !!initial.started_at || data.state.editing_locked;
  const task = useTask();
  const [date, setDate] = useState(
    initial.event_start_at
      ? new Date(new Date(initial.event_start_at).getTime() + 9 * 3600000).toISOString().slice(0, 10)
      : "",
  );
  const [deletion, setDeletion] = useState(initial.deletion_date ?? "");
  const [survey, setSurvey] = useState(initial.survey_open);
  const [nomination, setNomination] = useState(initial.nomination_open);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [welcome, setWelcome] = useState(initial.welcome);
  const [ending, setEnding] = useState(initial.ending);
  const [confirm, setConfirm] = useState<"save" | "purge" | "csv" | "xlsx" | null>(null);
  const [phrase, setPhrase] = useState("");
  async function save() {
    await api(
      {
        action: "settings",
        payload: {
          event_start_at: date ? `${date}T18:00:00+09:00` : null,
          deletion_date: deletion || null,
          survey_open: !locked && survey,
          nomination_open: !locked && nomination,
          enabled,
          welcome,
          ending,
        },
      },
      okSchema,
    );
    await refresh();
  }
  return (
    <div className="stack">
      <div className="grid-two">
        <Panel title="행사 일정과 공개 범위">
          <form
            className="stack-sm"
            onSubmit={(e) => {
              e.preventDefault();
              setConfirm("save");
            }}
          >
            <Field
              label="행사일"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              hint="공개 시각은 행사일 오후 6시 (한국시간)입니다. 이후 순서는 직접 진행합니다."
            />
            <Field
              label="개인정보 삭제 예정일"
              type="date"
              value={deletion}
              onChange={(e) => setDeletion(e.target.value)}
            />
            {locked && <Note>행사가 시작되어 응답을 다시 열 수 없습니다.</Note>}
            <Check checked={!locked && survey} onChange={setSurvey} disabled={locked}>
              설문 수정 허용
            </Check>
            <Check checked={!locked && nomination} onChange={setNomination} disabled={locked}>
              동료 추천·변경 허용
            </Check>
            <Check checked={enabled} onChange={setEnabled}>
              직원 사이트 접속 허용
            </Check>
            <TextArea
              label="대기실 안내"
              value={welcome}
              onChange={(e) => setWelcome(e.target.value)}
              required
            />
            <TextArea
              label="마무리 메시지"
              value={ending}
              onChange={(e) => setEnding(e.target.value)}
              required
            />
            <Button type="submit" busy={task.busy}>
              설정 저장
            </Button>
          </form>
        </Panel>
        <div className="stack">
          <Panel title="우리 회사 로고">
            {data.settings.logo_path && <PrivateImage path={data.settings.logo_path} alt="회사 로고" logo />}
            <Field
              label="로고 이미지"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void task.run(async () => {
                    const path = await upload(file);
                    await api({ action: "logo", payload: { asset_path: path } }, okSchema);
                    await refresh();
                  }, "로고를 반영했습니다.");
              }}
            />
            <Button
              variant="secondary"
              onClick={() =>
                void task.run(async () => {
                  await api({ action: "logo", payload: { asset_path: null } }, okSchema);
                  await refresh();
                })
              }
            >
              로고 숨기기
            </Button>
          </Panel>
          <Panel title="결과 다운로드">
            <p className="small">
              실제 설문과 추천자 정보가 포함됩니다. 접근을 제한한 곳에 보관하고, 보관 목적이 끝나면
              삭제해주세요. 생년월일·행사코드는 포함하지 않습니다.
            </p>
            <div className="actions">
              <Button variant="secondary" busy={task.busy} onClick={() => setConfirm("csv")}>
                CSV 내려받기
              </Button>
              <Button variant="secondary" busy={task.busy} onClick={() => setConfirm("xlsx")}>
                엑셀 내려받기
              </Button>
            </div>
          </Panel>
        </div>
      </div>
      <Panel title="행사가 끝난 뒤">
        <p>
          전체 개인정보를 영구 삭제하면 사원 명단·답변·추천·사진·직원 인증 계정이 삭제됩니다. 운영자 계정은
          유지됩니다.
        </p>
        <Field
          label="삭제 확인 문구"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="개인정보 영구 삭제"
          autoComplete="off"
        />
        <Button
          variant="danger"
          disabled={phrase !== "개인정보 영구 삭제" || task.busy}
          onClick={() => setConfirm("purge")}
        >
          개인정보 영구 삭제
        </Button>
      </Panel>
      {task.notice && <Note error={task.failed}>{task.notice}</Note>}
      {confirm && (
        <Confirm
          title={
            confirm === "purge"
              ? "모든 직원 개인정보를 영구 삭제할까요?"
              : confirm === "save"
                ? "행사 설정을 변경할까요?"
                : "개인정보가 포함된 파일을 내려받을까요?"
          }
          onClose={() => setConfirm(null)}
          action={() =>
            task.run(
              async () => {
                switch (confirm) {
                  case "save":
                    await save();
                    break;
                  case "purge":
                    await api({ action: "purge", payload: { confirmation: "개인정보 영구 삭제" } }, okSchema);
                    await refresh();
                    break;
                  case "csv":
                  case "xlsx":
                    await exportData(confirm);
                    break;
                  default:
                    break;
                }
              },
              confirm === "purge" ? "개인정보를 삭제하고 접속을 중단했습니다." : "완료했습니다.",
            )
          }
        >
          {confirm === "purge"
            ? "되돌릴 수 없습니다. 필요한 결과를 먼저 내려받았는지 확인해주세요. 삭제 중 오류가 나면 공개는 중단된 상태로 유지되며 재실행할 수 있습니다."
            : confirm === "save"
              ? "행사일 변경 또는 접속 중단 시 화면은 대기 상태로 돌아갑니다. 마감하면 직원은 더 이상 수정할 수 없습니다."
              : "다운로드 이력이 기록됩니다. CSV는 설문·추천·시상 3개 파일입니다. 브라우저가 여러 파일 다운로드를 차단하면 엑셀을 선택해주세요."}
        </Confirm>
      )}
    </div>
  );
}
