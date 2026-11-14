import { useCallback, useEffect, useState } from "react";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { type ForestPost, forestKinds, forestListSchema } from "../../supabase/functions/_shared/forest";
import { useBookDraft } from "../components/book/drafts";
import { ForestForm } from "../components/ForestForm";
import { Button, Confirm, Note, Panel } from "../components/ui";
import { api, message } from "../lib/api";
import { useTask } from "../lib/useTask";
import { useGuest } from "./Participant";

export function Forest({ admin = false }: { readonly admin?: boolean }) {
  return admin ? <ForestBoard admin locked={false} /> : <EmployeeForest />;
}
function EmployeeForest() {
  const { data } = useGuest();
  return <ForestBoard admin={false} locked={data.state.editing_locked || !!data.settings.started_at} />;
}
function ForestBoard({ admin, locked }: { readonly admin: boolean; readonly locked: boolean }) {
  const [posts, setPosts] = useState<ForestPost[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [editing, setEditing] = useBookDraft("forestEditing", null);
  const [deleting, setDeleting] = useState<ForestPost | null>(null);
  const task = useTask();
  const action = admin ? "forest_list" : "forest_mine";
  const refresh = useCallback(async () => {
    const result = await api({ action, payload: {} }, forestListSchema);
    setPosts(result);
    setMore(result.length === 20);
    setError("");
  }, [action]);
  useEffect(() => {
    let live = true;
    void refresh()
      .catch((e: unknown) => {
        if (live) setError(message(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [refresh]);
  return (
    <div className="stack">
      <header className="page-heading">
        <p className="overline">Our quiet forest · 이름 없이 전하는 마음</p>
        <h1>혜성식품 대나무숲</h1>
        <p className="muted">바라는 마음도, 고마운 마음도, 조금 아쉬웠던 마음도.</p>
      </header>
      {!admin && (
        <Panel title="여기서는, 이름을 내려놓아요.">
          <p className="small">
            이곳에서는 내가 보낸 글만 확인합니다. 관리자가 승인하면 행사 마음 트리에 익명으로 공개됩니다. 다른
            기기에서도 내 글을 관리하도록 비공개 소유자 연결을 보관하며, 직원들과 관리자 화면에는 작성자를
            표시하지 않습니다.
          </p>
          <p className="small">본문에는 본인이나 동료를 알아볼 만한 정보를 적지 말아주세요.</p>
          {locked ? (
            <Note>행사가 시작되어 작성·수정·삭제가 마감되었습니다. 보낸 글은 계속 확인 가능합니다.</Note>
          ) : (
            <ForestForm locked={locked} saved={refresh} />
          )}
        </Panel>
      )}
      {admin && (
        <Note>
          작성자는 표시되지 않습니다. 개인정보나 비방이 담긴 글을 삭제한 뒤, 마음 트리 메뉴에서 검수한 전체
          글을 공개해주세요.
        </Note>
      )}
      {task.notice && <Note error={task.failed}>{task.notice}</Note>}
      <div className="actions">
        <h2>{admin ? "숲에 도착한 마음" : "내가 보낸 마음"}</h2>
        <Button
          variant="secondary"
          busy={task.busy}
          onClick={() => void task.run(refresh, "글을 확인했습니다.")}
        >
          다시 확인
        </Button>
      </div>
      {error && <Note error>{error}</Note>}
      {loading ? (
        <Note>숲의 이야기를 불러오는 중입니다.</Note>
      ) : posts.length === 0 && !error ? (
        <Panel>
          <p className="empty">{admin ? "아직 도착한 마음이 없습니다." : "아직 보낸 마음이 없습니다."}</p>
        </Panel>
      ) : null}
      {!admin && posts.length > 0 && <Note>이미 마음을 남기셨습니다. 아래에서 보낸 글을 확인해보세요.</Note>}
      {posts.map((post) => (
        <Panel key={post.id}>
          <p className="overline">
            {admin ? "익명" : "내가 보낸 마음"} · {forestKinds[post.kind]} ·{" "}
            <span className="keep-phrase">{post.day}</span>
          </p>
          {editing === post.id && !locked ? (
            <ForestForm
              post={post}
              locked={locked}
              saved={async () => {
                await refresh();
                setEditing(null);
              }}
              cancel={() => setEditing(null)}
            />
          ) : (
            <>
              <p className="story-text" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {post.body}
              </p>
              {!admin && !locked && (
                <div className="actions">
                  <Button variant="secondary" onClick={() => setEditing(post.id)}>
                    내 글 수정하기
                  </Button>
                  <Button variant="danger" onClick={() => setDeleting(post)}>
                    내 글 삭제하기
                  </Button>
                </div>
              )}
            </>
          )}
          {admin && (
            <Button variant="danger" onClick={() => setDeleting(post)}>
              글 삭제
            </Button>
          )}
        </Panel>
      ))}
      {more && (
        <Button
          variant="secondary"
          busy={task.busy}
          onClick={() =>
            void task.run(async () => {
              const last = posts.at(-1);
              if (!last) return;
              const older = await api({ action, payload: { before: last.id } }, forestListSchema);
              setPosts((current) => [...current, ...older]);
              setMore(older.length === 20);
            })
          }
        >
          이전 마음 더 보기
        </Button>
      )}
      {deleting && (
        <Confirm
          title={admin ? "이 익명 글을 삭제할까요?" : "내가 보낸 이 글을 삭제할까요?"}
          onClose={() => setDeleting(null)}
          action={() =>
            task.run(async () => {
              await api({ action: "forest_delete", payload: { id: deleting.id } }, okSchema);
              setEditing(null);
              await refresh();
            }, "글을 삭제했습니다.")
          }
        >
          <p>삭제한 글은 복구되지 않습니다. 새 글 작성 횟수는 복원되지 않습니다.</p>
        </Confirm>
      )}
    </div>
  );
}
