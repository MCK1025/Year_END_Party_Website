import { Link } from "react-router-dom";
import { TreeCollection } from "../components/tree/TreeCollection";
import { Note } from "../components/ui";
import { useGuest } from "./Participant";

export function Tree() {
  const { data } = useGuest();
  return (
    <div className="stack">
      {data.state.phase === "COMPLETED" && (
        <Link className="button secondary" to="/afterparty" state={{ bookFrom: "/tree" }}>
          자유 관람 홈으로
        </Link>
      )}
      <header className="page-heading">
        <span aria-hidden="true" className="paper-sticker sticker-tree-snowman" />
        <p className="overline">A season of little wishes</p>
        <h1>마음이 모여, 우리의 겨울이 됩니다.</h1>
        <p className="muted">이름 대신 마음을 달았어요. 하나씩, 천천히 읽어주세요.</p>
      </header>
      {data.state.paused && <Note>진행은 잠시 쉬어갑니다. 이야기는 계속 읽어도 좋아요.</Note>}
      {data.state.tree_open ? (
        <TreeCollection revision={data.state.revision} />
      ) : (
        <Note>공개 트리는 관리자가 승인한 뒤 열립니다.</Note>
      )}
    </div>
  );
}
