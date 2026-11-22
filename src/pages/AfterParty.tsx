import { CardsIcon, TreeEvergreenIcon } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { WaitingStory } from "../components/waiting/WaitingStory";

export function AfterParty() {
  return (
    <div className="stack">
      <nav className="afterparty-links" aria-label="자유 관람 콘텐츠">
        <Link className="button secondary afterparty-link" to="/tree" state={{ bookFrom: "/afterparty" }}>
          <TreeEvergreenIcon size={24} aria-hidden="true" />
          <span>이야기 트리</span>
        </Link>
        <Link className="button secondary afterparty-link" to="/cards" state={{ bookFrom: "/afterparty" }}>
          <CardsIcon size={24} aria-hidden="true" />
          <span>혜성식품 인물 카드</span>
        </Link>
      </nav>
      <header className="page-heading">
        <h1>2026년, 한 걸음 더 가까워진 우리</h1>
      </header>
      <WaitingStory book />
    </div>
  );
}
