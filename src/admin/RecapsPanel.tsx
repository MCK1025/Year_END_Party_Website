import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlbumViewer } from "../components/recap/AlbumViewer";
import { orderedMoments } from "../components/recap/model";
import { Button, Note, Panel, Select } from "../components/ui";
import { useAdmin } from "./context";
import { MomentEditor } from "./recap/MomentEditor";

export function RecapsPanel() {
  const { data, refresh } = useAdmin();
  const [selected, setSelected] = useState("");
  const [generation, reset] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [params, setParams] = useSearchParams();
  const preview = params.get("preview") === "album";
  const [replay, setReplay] = useState(0);
  const [notice, setNotice] = useState("");
  const moments = orderedMoments(data.recaps);
  const publicMoments = moments.filter((m) => m.published);
  function showPreview(open: boolean) {
    const next = new URLSearchParams(params);
    if (open) next.set("preview", "album");
    else next.delete("preview");
    setParams(next, { replace: true, preventScrollReset: true });
  }
  function switchTo(id: string) {
    if (dirty && !window.confirm("저장하지 않은 편집 내용을 닫을까요?")) return;
    setDirty(false);
    setNotice("");
    setSelected(id);
    reset((v) => v + 1);
  }
  return (
    <div className="stack">
      <link rel="stylesheet" href={`${import.meta.env.BASE_URL}fonts/gamja-flower/font.css`} />
      <Panel title="1년 회고 앨범">
        <div className="stack-sm">
          <Select label="편집할 Moment" value={selected} onChange={switchTo}>
            <option value="">새 Moment 추가</option>
            {moments.map((m, i) => (
              <option key={m.id} value={m.id}>
                {String(i + 1).padStart(2, "0")} · {m.caption}
                {m.published ? "" : " (비공개)"}
              </option>
            ))}
          </Select>
          <div className="actions">
            <Button
              variant="secondary"
              onClick={() => (preview ? setReplay((v) => v + 1) : showPreview(true))}
            >
              {preview ? "오프닝 다시 보기" : "저장된 전체 회고 미리보기"}
            </Button>
            {preview && (
              <Button variant="secondary" onClick={() => showPreview(false)}>
                미리보기 닫기
              </Button>
            )}
            {dirty && (
              <Button variant="secondary" onClick={() => switchTo(selected)}>
                편집 취소
              </Button>
            )}
          </div>
          {preview && (
            <div className="recap-admin-preview">
              <AlbumViewer key={replay} rows={publicMoments} />
            </div>
          )}
        </div>
      </Panel>
      {notice && <Note>{notice}</Note>}
      <MomentEditor
        key={`${selected}:${generation}`}
        moment={moments.find((m) => m.id === selected)}
        rows={moments}
        markDirty={() => setDirty(true)}
        saved={async (id) => {
          await refresh();
          setSelected(id ?? "");
          reset((v) => v + 1);
          setDirty(false);
          setNotice("회고 앨범에 반영했습니다.");
        }}
      />
    </div>
  );
}
