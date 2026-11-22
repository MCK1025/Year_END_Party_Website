import { type ReactNode, useState } from "react";
import { okSchema } from "../../../supabase/functions/_shared/contracts";
import type { Detail } from "../../../supabase/functions/_shared/recap";
import { AlbumViewer } from "../../components/recap/AlbumViewer";
import { albumOf, type Moment } from "../../components/recap/model";
import { Button, Check, Confirm, Field, Note, Panel, Select, TextArea } from "../../components/ui";
import { api } from "../../lib/api";
import { useTask } from "../../lib/useTask";
import { PhotoField } from "./PhotoField";

function DetailDisclosure({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="recap-details-editor" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{label}</summary>
      {open && children}
    </details>
  );
}

export function MomentEditor({
  moment,
  rows,
  saved,
  markDirty,
}: {
  readonly moment?: Moment | undefined;
  readonly rows: readonly Moment[];
  readonly saved: (id: string | null) => Promise<void>;
  readonly markDirty: () => void;
}) {
  const [original] = useState(moment);
  const [id] = useState(() => moment?.id ?? crypto.randomUUID());
  const [title, setTitle] = useState(moment?.caption ?? "");
  const [book, setBook] = useState(() => albumOf(moment));
  const [order, setOrder] = useState(
    moment?.sort_order ?? Math.min(100, Math.max(-1, ...rows.map((r) => r.sort_order)) + 1),
  );
  const [published, setPublished] = useState(moment?.published ?? true);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState(0);
  const task = useTask();
  const library = new Map<string, string>();
  for (const r of rows) {
    const a = albumOf(r);
    if (a.cover_path) library.set(a.cover_path, `${r.caption} · 대표`);
    a.slides.forEach((s, i) => {
      if (s.asset_path) library.set(s.asset_path, `${r.caption} · 상세 ${i + 1}`);
    });
  }
  if (book.cover_path) library.set(book.cover_path, "현재 대표 사진");
  book.slides.forEach((s, i) => {
    if (s.asset_path) library.set(s.asset_path, `현재 상세 ${i + 1}`);
  });
  function patchSlide(slideId: string, fields: Partial<Detail>) {
    setBook((b) => ({ ...b, slides: b.slides.map((s) => (s.id === slideId ? { ...s, ...fields } : s)) }));
    markDirty();
  }
  function shift(i: number, by: 1 | -1) {
    setBook((b) => {
      const slides = [...b.slides];
      const [slide] = slides.splice(i, 1);
      if (slide) slides.splice(i + by, 0, slide);
      return { ...b, slides };
    });
    markDirty();
  }
  const draft = { id, caption: title, sort_order: order, published, asset_path: null, album: book };
  return (
    <Panel title={original ? "Moment 수정" : "새로운 Moment"}>
      <form
        className="stack recap-editor"
        onChange={markDirty}
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            await api(
              { action: "recap", payload: { ...draft, expected_version: original?.album_version ?? null } },
              okSchema,
            );
            await saved(original ? id : null);
          });
        }}
      >
        <fieldset className="stack" disabled={task.busy}>
          <Field
            label="Moment 제목"
            value={title}
            required
            maxLength={500}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextArea
            label="짧은 소개 (선택)"
            value={book.introduction}
            onChange={(e) => setBook({ ...book, introduction: e.target.value })}
          />
          <Field
            label="Moment 표시 순서"
            type="number"
            min={0}
            max={100}
            required
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
          />
          <PhotoField
            label="대표 사진"
            path={book.cover_path}
            library={library}
            run={task.run}
            change={(cover_path) => {
              setBook((b) => ({ ...b, cover_path }));
              markDirty();
            }}
            style={{ objectFit: book.fit, objectPosition: `${book.x}% ${book.y}%` }}
          />
          <Select
            label="대표 사진 표시"
            value={book.fit}
            onChange={(fit) => setBook({ ...book, fit: fit === "cover" ? "cover" : "contain" })}
          >
            <option value="contain">전체 보기</option>
            <option value="cover">화면 채우기</option>
          </Select>
          {book.fit === "cover" && (
            <div className="grid-two">
              {(["x", "y"] as const).map((axis) => (
                <Field
                  key={axis}
                  label={axis === "x" ? "사진 가로 위치" : "사진 세로 위치"}
                  type="range"
                  min={0}
                  max={100}
                  value={book[axis]}
                  onChange={(e) => setBook({ ...book, [axis]: Number(e.target.value) })}
                />
              ))}
            </div>
          )}
          {book.slides.map((s, i) => (
            <DetailDisclosure key={s.id} label={`상세 ${i + 1}${s.title ? ` · ${s.title}` : ""}`}>
              <div className="stack-sm">
                <PhotoField
                  label={`상세 ${i + 1} 사진`}
                  path={s.asset_path}
                  change={(asset_path) => patchSlide(s.id, { asset_path })}
                  run={task.run}
                  library={library}
                />
                <Field
                  label="상세 제목 (선택)"
                  maxLength={160}
                  value={s.title}
                  onChange={(e) => patchSlide(s.id, { title: e.target.value })}
                />
                <TextArea
                  label="상세 설명 (선택)"
                  value={s.description}
                  onChange={(e) => patchSlide(s.id, { description: e.target.value })}
                />
                <Field
                  label="날짜 (선택)"
                  type="date"
                  value={s.date}
                  onChange={(e) => patchSlide(s.id, { date: e.target.value })}
                />
                <div className="actions">
                  <Button variant="secondary" disabled={i === 0} onClick={() => shift(i, -1)}>
                    앞으로
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={i === book.slides.length - 1}
                    onClick={() => shift(i, 1)}
                  >
                    뒤로
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setBook({ ...book, slides: book.slides.filter((d) => d.id !== s.id) });
                      markDirty();
                    }}
                  >
                    상세 장면 제거
                  </Button>
                </div>
              </div>
            </DetailDisclosure>
          ))}
          <Button
            variant="secondary"
            onClick={() => {
              setBook({
                ...book,
                slides: [
                  ...book.slides,
                  { id: crypto.randomUUID(), title: "", description: "", date: "", asset_path: null },
                ],
              });
              markDirty();
            }}
          >
            상세 장면 추가
          </Button>
          <Check checked={published} onChange={setPublished}>
            회고 단계에서 이 Moment를 공개합니다.
          </Check>
          <div className="actions">
            <Button type="submit" busy={task.busy}>
              Moment 저장
            </Button>
            <Button variant="secondary" onClick={() => setPreview((v) => v + 1)}>
              편집 중인 Moment 미리보기
            </Button>
            {original && (
              <Button variant="danger" onClick={() => setDeleting(true)}>
                Moment 삭제
              </Button>
            )}
          </div>
        </fieldset>
      </form>
      {task.notice && <Note error={task.failed}>{task.notice}</Note>}
      {preview > 0 && (
        <div className="recap-admin-preview">
          <Button variant="secondary" onClick={() => setPreview(0)}>
            미리보기 닫기
          </Button>
          <AlbumViewer key={preview} rows={[draft]} preview />
        </div>
      )}
      {deleting && (
        <Confirm
          title="이 Moment를 삭제할까요?"
          onClose={() => setDeleting(false)}
          action={() =>
            task.run(async () => {
              await api({ action: "delete_recap", payload: { id } }, okSchema);
              await saved(null);
            })
          }
        >
          대표 페이지와 상세 장면 {book.slides.length}장을 함께 삭제합니다.
        </Confirm>
      )}
    </Panel>
  );
}
