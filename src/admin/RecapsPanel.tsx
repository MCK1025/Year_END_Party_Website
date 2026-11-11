import { useState } from "react";
import { type Dashboard, okSchema } from "../../supabase/functions/_shared/contracts";
import { PrivateImage } from "../components/PrivateImage";
import { Button, Check, Confirm, Field, Note, Panel, TextArea } from "../components/ui";
import { api, upload } from "../lib/api";
import { useTask } from "../lib/useTask";
import { useAdmin } from "./context";

function RecapEditor({ card }: { readonly card?: Dashboard["recaps"][number] }) {
  const { refresh } = useAdmin();
  const task = useTask();
  const [caption, setCaption] = useState(card?.caption ?? "");
  const [published, setPublished] = useState(card?.published ?? false);
  const [order, setOrder] = useState(card?.sort_order ?? 0);
  const [path, setPath] = useState(card?.asset_path ?? null);
  const [confirm, setConfirm] = useState(false);
  return (
    <Panel title={card ? "기억의 장면 수정" : "새로운 장면"}>
      <form
        className="stack-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            await api(
              {
                action: "recap",
                payload: {
                  ...(card ? { id: card.id } : {}),
                  caption,
                  asset_path: path,
                  published,
                  sort_order: order,
                },
              },
              okSchema,
            );
            await refresh();
            if (!card) {
              setCaption("");
              setPath(null);
              setPublished(false);
            }
          });
        }}
      >
        {path && <PrivateImage path={path} alt={caption || "업로드한 회고 사진"} />}
        <Field
          label="사진 (JPG·PNG·WebP, 8MB 이하)"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f)
              void task.run(async () => setPath(await upload(f)), "사진을 올렸습니다. 장면을 저장해주세요.");
          }}
        />
        <TextArea
          label="이 장면에 남길 말"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          required
        />
        <Field
          label="표시 순서"
          type="number"
          min={0}
          max={100}
          value={order}
          onChange={(e) => setOrder(Number(e.target.value))}
        />
        <Check checked={published} onChange={setPublished}>
          사진 게시 동의와 내용을 확인했습니다. 회고 단계에서 공개합니다.
        </Check>
        <div className="actions">
          <Button type="submit" busy={task.busy}>
            장면 저장
          </Button>
          {card && (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              장면 삭제
            </Button>
          )}
        </div>
        {task.notice && <Note error={task.failed}>{task.notice}</Note>}
      </form>
      {confirm && card && (
        <Confirm
          title="이 장면을 삭제할까요?"
          onClose={() => setConfirm(false)}
          action={() =>
            task.run(async () => {
              await api({ action: "delete_recap", payload: { id: card.id } }, okSchema);
              await refresh();
            })
          }
        >
          직원 화면의 회고에서 제외합니다. 사진 원본은 행사 종료 후 파기 시 함께 삭제됩니다.
        </Confirm>
      )}
    </Panel>
  );
}
export function RecapsPanel() {
  const { data } = useAdmin();
  return (
    <div className="grid-two">
      <RecapEditor />
      {data.recaps.map((r) => (
        <RecapEditor key={r.id} card={r} />
      ))}
    </div>
  );
}
