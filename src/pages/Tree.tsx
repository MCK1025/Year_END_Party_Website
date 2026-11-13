import { TreeCollection } from "../components/tree/TreeCollection";
import { Note } from "../components/ui";
import { useGuest } from "./Participant";

export function Tree() {
  const { data } = useGuest();
  if (!data.state.tree_open) return <Note>마음 트리는 관리자가 승인한 뒤 열립니다.</Note>;
  return (
    <div className="stack">
      <header className="page-heading">
        <p className="overline">A season of little wishes</p>
        <h1>
          마음이 모여,
          <br />
          우리의 겨울이 됩니다.
        </h1>
        <p className="muted">이름 대신 마음을 달았어요. 하나씩, 천천히 읽어주세요.</p>
      </header>
      {data.state.paused && <Note>진행은 잠시 쉬어갑니다. 쪽지는 계속 읽어도 좋아요.</Note>}
      <TreeCollection key={data.state.revision} />
    </div>
  );
}
