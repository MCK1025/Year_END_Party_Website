import { CardsIcon, TreeEvergreenIcon } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

export function AfterParty() {
  return (
    <div className="stack">
      <header className="page-heading">
        <p className="overline">Our stories, together</p>
        <h1>2026년, 한 걸음 더 가까워진 우리</h1>
        <p className="muted">함께한 이야기와 서로의 새로운 모습을 천천히 둘러보세요.</p>
      </header>
      <div className="afterparty-links">
        <Link className="afterparty-link" to="/tree" state={{ bookFrom: "/afterparty" }}>
          <TreeEvergreenIcon size={36} aria-hidden="true" />
          <h2>우리들의 이야기 트리</h2>
          <p>우리가 남긴 따뜻한 이야기</p>
          <span className="small">이야기 보러 가기 →</span>
        </Link>
        <Link className="afterparty-link" to="/cards" state={{ bookFrom: "/afterparty" }}>
          <CardsIcon size={36} aria-hidden="true" />
          <h2>우리들의 취향 카드</h2>
          <p>우리가 몰랐던 동료들의 모습</p>
          <span className="small">동료 만나러 가기 →</span>
        </Link>
      </div>
    </div>
  );
}
