import { useEffect, useState } from "react";
import { type ForestPost, forestKinds } from "../../../supabase/functions/_shared/forest";
import { Button } from "../ui";
import { NoteDialog } from "./NoteDialog";
import { ornament, storiesPerTree } from "./ornaments";
import { TreeScene } from "./TreeScene";
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
  const ornaments = notes.map((note, index) => ({ ...ornament(index, notes.length), note }));
  useEffect(() => {
    setSelected((current) => (current ? (notes.find((note) => note.id === current.id) ?? null) : null));
  }, [notes]);
  return (
    <>
      <section className="message-tree" aria-label="마음이 달린 크리스마스 트리">
        <div className="tree-caption">
          <span className="overline">OUR WISHING TREE</span>
          <span>{total}개의 이야기</span>
        </div>
        <div className={notes.length > 12 ? "tree-stage tree-stage-full" : "tree-stage"}>
          <TreeScene paused={paused} />
          {ornaments.map((art, index) => {
            const { note } = art;
            const number = String(page * storiesPerTree + index + 1).padStart(2, "0");
            return (
              <button
                type="button"
                key={note.id}
                className="tree-ornament"
                style={{
                  left: `${art.x}%`,
                  top: `${art.y}%`,
                }}
                aria-label={`이야기 ${number} 열기 · ${art.label} · ${forestKinds[note.kind]}`}
                onClick={() => setSelected(note)}
              >
                <svg
                  className="ornament-twig"
                  viewBox="0 0 38 36"
                  aria-hidden="true"
                  focusable="false"
                  style={{ transform: art.x > 50 ? "scaleX(-1)" : undefined }}
                >
                  <g transform={`translate(0 ${28 - art.cord})`}>
                    <path className="sprig-stem" d="M36 -8 Q19 5 2 1" />
                    <path
                      className="sprig-needles"
                      d="M26 -2l4 -7 M23 0l8 1 M16 1l6 -6 M13 2l6 3 M6 2l5 -4"
                    />
                  </g>
                  <path className="ornament-cord" d={`M2 ${29 - art.cord} Q0 25 2 33`} />
                </svg>
                <span
                  className="ornament-art"
                  aria-hidden="true"
                  style={{
                    backgroundPosition: art.sprite,
                    filter: `hue-rotate(${art.hue}deg)`,
                    rotate: `${art.tilt}deg`,
                    transform: `scale(${art.size})`,
                  }}
                />
                <span className="ornament-number" aria-hidden="true">
                  {number}
                </span>
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
            양말이나 선물을 눌러 이야기를 열어보세요.
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
