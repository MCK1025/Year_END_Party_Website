import { useCallback, useEffect, useState } from "react";
import { okSchema } from "../../supabase/functions/_shared/contracts";
import {
  type ForestPost,
  forestKindSchema,
  forestKinds,
  forestListSchema,
} from "../../supabase/functions/_shared/forest";
import { Button, Confirm, Note, Panel, Select, TextArea } from "../components/ui";
import { api, message } from "../lib/api";
import { useTask } from "../lib/useTask";

export function Forest({ admin = false }: { readonly admin?: boolean }) {
  const [posts, setPosts] = useState<ForestPost[]>([]);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<ForestPost["kind"]>("wish");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [deleting, setDeleting] = useState<ForestPost | null>(null);
  const task = useTask();
  const refresh = useCallback(async () => {
    const data = await api({ action: "forest_list", payload: {} }, forestListSchema);
    setPosts(data);
    setMore(data.length === 20);
    setError("");
  }, []);
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
            글에는 이름·소속·직원 계정을 저장하지 않습니다. 관리자도 작성자 정보가 없는 글만 봅니다. 본문에
            본인이나 동료의 이름 등 신원을 드러내는 정보는 적지 말아주세요.
          </p>
          <form
            className="stack-sm"
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(async () => {
                await api({ action: "forest_post", payload: { kind, body } }, okSchema);
                setBody("");
                await refresh();
              }, "이름 없이, 마음이 도착했습니다.");
            }}
          >
            <Select
              label="어떤 마음인가요?"
              value={kind}
              onChange={(value) => setKind(forestKindSchema.parse(value))}
            >
              {Object.entries(forestKinds).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </Select>
            <TextArea
              label="혜성식품에게 전하고 싶은 말"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              maxLength={2000}
            />
            <p className="small">
              {body.length} / 2,000자 · <span className="keep-phrase">하루 10회까지 남길 수 있어요.</span>{" "}
              글은 직원들과 함께 읽으며, 타인을 비방하거나 개인정보가 담긴 글은 관리자가 삭제합니다.
            </p>
            <Button type="submit" busy={task.busy} disabled={!body.trim()}>
              익명으로 마음 남기기
            </Button>
          </form>
        </Panel>
      )}
      {admin && (
        <Note>작성자 정보는 수집하지 않습니다. 개인정보나 비방이 담긴 글은 관리자가 삭제합니다.</Note>
      )}
      {task.notice && <Note error={task.failed}>{task.notice}</Note>}
      <div className="actions">
        <h2>숲에 도착한 마음</h2>
        <Button
          variant="secondary"
          busy={task.busy}
          onClick={() => void task.run(refresh, "새 글을 확인했습니다.")}
        >
          새 글 확인
        </Button>
      </div>
      {error && <Note error>{error}</Note>}
      {loading ? (
        <Note>숲의 이야기를 불러오는 중입니다.</Note>
      ) : posts.length === 0 && !error ? (
        <Panel>
          <p className="empty">아직 조용한 숲이에요. 첫 마음을 남겨주세요.</p>
        </Panel>
      ) : null}
      {posts.map((post) => (
        <Panel key={post.id}>
          <p className="overline">
            익명 · {forestKinds[post.kind]} · {post.day}
          </p>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{post.body}</p>
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
              const older = await api(
                { action: "forest_list", payload: { before: last.id } },
                forestListSchema,
              );
              setPosts((current) => [...current, ...older]);
              setMore(older.length === 20);
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
