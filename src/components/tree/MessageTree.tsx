import { useEffect, useState } from "react";
import { type ForestPost, forestKinds } from "../../../supabase/functions/_shared/forest";
import { Button } from "../ui";
import { NoteDialog } from "./NoteDialog";
import { TreeScene } from "./TreeScene";

const positions = [
  [50, 25],
  [35, 38],
  [65, 38],
  [24, 51],
  [50, 51],
  [76, 51],
  [20, 65],
  [46, 65],
  [72, 65],
  [27, 79],
  [53, 79],
  [79, 79],
] as const;
export function MessageTree({
  notes,
  total,
  page = 0,
}: {
  readonly notes: readonly ForestPost[];
  readonly total: number;
  readonly page?: number;
}) {
  const [selected, setSelected] = useState<ForestPost | null>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    setSelected((current) => (current ? (notes.find((note) => note.id === current.id) ?? null) : null));
  }, [notes]);
  return (
    <>
      <section className="message-tree" aria-label="마음이 달린 크리스마스 트리">
        <div className="tree-caption">
          <span className="overline">OUR WISHING TREE</span>
          <span>{total}개의 마음</span>
        </div>
        <div className="tree-stage">
          <TreeScene paused={paused} />
          {notes.map((note, index) => {
            const position = positions[index];
            if (!position) return null;
            return (
              <button
                type="button"
                key={note.id}
                className={`tree-note ${note.kind}`}
                style={{
                  left: `${position[0]}%`,
                  top: `${position[1]}%`,
                  rotate: `${index % 2 ? -6 : 5}deg`,
                }}
                aria-label={`쪽지 ${String(page * 12 + index + 1).padStart(2, "0")} 열기 · ${forestKinds[note.kind]}`}
                onClick={() => setSelected(note)}
              >
                <span className="note-pin" aria-hidden="true" />
                <span className="note-number">{String(page * 12 + index + 1).padStart(2, "0")}</span>
                <span className="note-fold" aria-hidden="true" />
              </button>
            );
          })}
          {notes.length === 0 && (
            <p className="tree-empty">
              올해의 마음이
              <br />이 가지에 머물 거예요.
            </p>
          )}
          <p className="tree-year" aria-hidden="true">
            2026
          </p>
        </div>
        <div className="tree-instruction">
          <p>
            가지에 매달린 쪽지를 눌러보세요.
            <br />
            작은 마음 하나가, 조금 더 가까이.
          </p>
          <Button variant="secondary" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>
            {paused ? "효과 재생" : "효과 멈추기"}
          </Button>
        </div>
      </section>
      {selected && <NoteDialog note={selected} close={() => setSelected(null)} />}
    </>
  );
}
