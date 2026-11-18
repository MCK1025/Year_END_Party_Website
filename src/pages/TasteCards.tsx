import { UserCircleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useCards } from "../components/afterparty/CardData";
import { PersonCardDialog } from "../components/afterparty/PersonCardDialog";
import { Button, Field, Note } from "../components/ui";

export function TasteCards() {
  const { cards, error, retry } = useCards();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const shown =
    cards?.filter((c) => c.name.replaceAll(" ", "").includes(query.trim().replaceAll(" ", ""))) ?? [];
  const card = shown.find((c) => c.id === selected);
  return (
    <div className="stack">
      <header className="page-heading">
        <p className="overline">A little more about us</p>
        <h1>혜성식품 인물 카드</h1>
        <p className="muted">궁금한 동료를 눌러 이야기를 만나보세요.</p>
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
      ) : !shown.length ? (
        <Note>
          {query.trim()
            ? "이름에 맞는 공개 카드가 없습니다."
            : "공개된 인물 카드가 아직 없습니다. 설문을 작성하고 공개 검수를 마친 동료의 카드가 여기에 표시됩니다."}
        </Note>
      ) : (
        <ul className="person-card-grid" aria-label="혜성식품 동료들">
          {shown.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                className="person-card-button"
                aria-haspopup="dialog"
                onClick={() => setSelected(person.id)}
              >
                <UserCircleIcon size={32} aria-hidden="true" />
                <strong>{person.name}</strong>
                <span>{person.department}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {card && !error && <PersonCardDialog card={card} close={() => setSelected(null)} />}
    </div>
  );
}
