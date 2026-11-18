import { UserCircleIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useCards } from "../components/afterparty/CardData";
import { useBookView } from "../components/book/preferences";
import { Button, Field, Note } from "../components/ui";

export function TasteCards() {
  const { cards, error, retry } = useCards();
  const { still } = useBookView();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const shown =
    cards?.filter((c) => c.name.replaceAll(" ", "").includes(query.trim().replaceAll(" ", ""))) ?? [];
  const index = Math.max(
    0,
    shown.findIndex((c) => c.id === selected),
  );
  const card = shown[index];
  function move(delta: number) {
    const next = shown[index + delta];
    if (next) setSelected(next.id);
  }
  return (
    <div className="stack">
      <header className="page-heading">
        <p className="overline">A little more about us</p>
        <h1>혜성식품 인물 카드</h1>
        <p className="muted">한 장씩 넘기며 동료의 이야기를 만나보세요.</p>
      </header>
      <Link className="button secondary" to="/afterparty" state={{ bookFrom: "/cards" }}>
        자유 관람 홈으로
      </Link>
      <Field
        label="직원 이름 검색"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
        }}
      />
      {error ? (
        <>
          <Note error>{error}</Note>
          <Button onClick={retry}>다시 불러오기</Button>
        </>
      ) : !cards ? (
        <Note>공개된 인물 카드를 불러오고 있습니다.</Note>
      ) : !card ? (
        <Note>
          {query.trim()
            ? "이름에 맞는 공개 카드가 없습니다."
            : "공개된 인물 카드가 아직 없습니다. 설문을 작성하고 공개 검수를 마친 동료의 카드가 여기에 표시됩니다."}
        </Note>
      ) : (
        <>
          <div className="taste-card-nav">
            <Button variant="secondary" disabled={index === 0} onClick={() => move(-1)}>
              ← 이전 직원
            </Button>
            <span className="small" aria-live="polite">
              {index + 1} / {shown.length}
            </span>
            <Button variant="secondary" disabled={index === shown.length - 1} onClick={() => move(1)}>
              다음 직원 →
            </Button>
          </div>
          <article
            className="taste-card"
            key={card.id}
            data-still={still}
            onPointerDown={(event) => {
              if (!event.isPrimary || event.pointerType === "mouse") return;
              start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
            }}
            onPointerCancel={() => {
              start.current = null;
            }}
            onPointerUp={(event) => {
              const point = start.current;
              start.current = null;
              if (!point || point.id !== event.pointerId) return;
              const dx = event.clientX - point.x,
                dy = event.clientY - point.y;
              if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.8) move(dx < 0 ? 1 : -1);
            }}
          >
            <header className="taste-person">
              <UserCircleIcon size={40} aria-hidden="true" />
              <div>
                <h2>{card.name}</h2>
                <p className="small">{card.department}</p>
              </div>
            </header>
            <dl>
              {card.answers.map((answer) => (
                <div className="taste-answer" key={answer.id}>
                  <dt>{answer.question}</dt>
                  <dd>{answer.answer}</dd>
                </div>
              ))}
            </dl>
          </article>
        </>
      )}
    </div>
  );
}
