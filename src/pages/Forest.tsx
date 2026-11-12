import { useCallback, useEffect, useState } from "react";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import { type ForestPost, forestKinds, forestListSchema } from "../../supabase/functions/_shared/forest";
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
  const [mine, setMine] = useState<ForestPost[]>([]);
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState({ all: false, mine: false });
  const [editing, setEditing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<ForestPost | null>(null);
  const task = useTask();
  const refresh = useCallback(async () => {
    const [all, own] = await Promise.all([
      api({ action: "forest_list", payload: {} }, forestListSchema),
      admin ? Promise.resolve([]) : api({ action: "forest_mine", payload: {} }, forestListSchema),
    ]);
    setPosts(all);
    setMine(own);
    setMore({ all: all.length === 20, mine: own.length === 20 });
    setError("");
    return own.length;
  }, [admin]);
  useEffect(() => {
    let live = true;
    void refresh()
      .then((count) => {
        if (live && count > 0) setTab("mine");
      })
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
  const shown = tab === "mine" ? mine : posts;
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
            직원들과 관리자에게 작성자는 표시되지 않습니다. 다른 기기에서도 내 글을 관리하도록 비공개 소유자
            연결을 보관합니다. 본문에는 본인이나 동료를 알아볼 만한 정보를 적지 말아주세요.
          </p>
          {locked ? (
            <Note>행사가 시작되어 작성과 수정이 마감되었습니다. 보낸 글은 계속 확인 가능합니다.</Note>
          ) : (
            <ForestForm
              locked={locked}
              saved={async () => {
                await refresh();
                setTab("mine");
              }}
            />
          )}
        </Panel>
      )}
      {admin && (
        <Note>
          이 화면과 조회 응답에는 작성자 정보가 표시되지 않습니다. 개인정보나 비방이 담긴 글은 삭제해주세요.
        </Note>
      )}
      {task.notice && <Note error={task.failed}>{task.notice}</Note>}
      <div className="actions">
        <h2>{tab === "mine" ? "내가 보낸 마음" : "숲에 도착한 마음"}</h2>
        <Button
          variant="secondary"
          busy={task.busy}
          onClick={() =>
            void task.run(async () => {
              await refresh();
            }, "새 글을 확인했습니다.")
          }
        >
          새 글 확인
        </Button>
      </div>
      {!admin && (
        <div className="actions">
          <Button
            variant={tab === "all" ? "primary" : "secondary"}
            aria-pressed={tab === "all"}
            onClick={() => {
              setTab("all");
              setEditing(null);
            }}
          >
            모두의 마음
          </Button>
          <Button
            variant={tab === "mine" ? "primary" : "secondary"}
            aria-pressed={tab === "mine"}
            onClick={() => {
              setTab("mine");
              setEditing(null);
            }}
          >
            내가 보낸 마음
          </Button>
        </div>
      )}
      {error && <Note error>{error}</Note>}
      {loading ? (
        <Note>숲의 이야기를 불러오는 중입니다.</Note>
      ) : shown.length === 0 && !error ? (
        <Panel>
          <p className="empty">
            {tab === "mine" ? "아직 보낸 마음이 없습니다." : "아직 조용한 숲이에요. 첫 마음을 남겨주세요."}
          </p>
        </Panel>
      ) : null}
      {tab === "mine" && mine.length > 0 && (
        <Note>이미 마음을 남기셨습니다. 아래에서 보낸 글을 확인해보세요.</Note>
      )}
      {shown.map((post) => (
        <Panel key={post.id}>
          <p className="overline">
            {tab === "mine" ? "내가 보낸 마음" : "익명"} · {forestKinds[post.kind]} ·{" "}
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
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{post.body}</p>
              {!admin && tab === "mine" && !locked && (
                <Button variant="secondary" onClick={() => setEditing(post.id)}>
                  내 글 수정하기
                </Button>
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
      {more[tab] && (
        <Button
          variant="secondary"
          busy={task.busy}
          onClick={() =>
            void task.run(async () => {
              const last = shown.at(-1);
              if (!last) return;
              const older = await api(
                { action: tab === "mine" ? "forest_mine" : "forest_list", payload: { before: last.id } },
                forestListSchema,
              );
              if (tab === "mine") setMine((current) => [...current, ...older]);
              else setPosts((current) => [...current, ...older]);
              setMore((current) => ({ ...current, [tab]: older.length === 20 }));
            }, "이전 마음을 더 불러왔습니다.")
          }
        >
          이전 마음 더 보기
        </Button>
      )}
      {deleting && (
        <Confirm
          title="이 익명 글을 삭제할까요?"
          onClose={() => setDeleting(null)}
          action={() =>
            task.run(async () => {
              await api({ action: "forest_delete", payload: { id: deleting.id } }, okSchema);
              await refresh();
            }, "글을 삭제했습니다.")
          }
        >
          <p>삭제한 글은 복구되지 않습니다.</p>
        </Confirm>
      )}
    </div>
  );
}
