import { useEffect, useRef, useState } from "react";
import { forestTreeSchema } from "../../../supabase/functions/_shared/forest";
import { api, message } from "../../lib/api";
import { Button, Note } from "../ui";
import { MessageTree } from "./MessageTree";
import { storiesPerTree } from "./ornaments";

const firstPage: readonly (number | undefined)[] = [undefined];
export function TreeCollection({ revision }: { readonly revision: number }) {
  const [loaded, setLoaded] = useState<
    (ReturnType<typeof forestTreeSchema.parse> & { revision: number; before: number | undefined }) | null
  >(null);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({ revision, cursors: firstPage });
  const cursors = pagination.revision === revision ? pagination.cursors : firstPage;
  const generation = useRef(0);
  const before = cursors.at(-1);
  const data = loaded && loaded.revision === revision && loaded.before === before ? loaded : null;
  useEffect(() => {
    const request = ++generation.current;
    setError("");
    async function loadTree() {
      let cursor = before;
      const notes: ReturnType<typeof forestTreeSchema.parse>["notes"] = [];
      while (true) {
        const batch = await api(
          { action: "forest_tree", payload: cursor === undefined ? {} : { before: cursor } },
          forestTreeSchema,
        );
        if (generation.current !== request) return null;
        notes.push(...batch.notes.slice(0, storiesPerTree - notes.length));
        if (notes.length === storiesPerTree || batch.notes.length < 12 || notes.length >= batch.total)
          return { notes, total: batch.total };
        cursor = batch.notes.at(-1)?.id;
      }
    }
    void loadTree()
      .then((result) => {
        if (result && generation.current === request) setLoaded({ ...result, revision, before });
      })
      .catch((e: unknown) => {
        if (generation.current === request) setError(message(e));
      });
    return () => {
      generation.current++;
    };
  }, [before, revision]);
  return (
    <div className="stack">
      <MessageTree notes={data?.notes ?? []} total={data?.total ?? null} page={cursors.length - 1} />
      {error ? (
        <Note error>{error}</Note>
      ) : (
        data && (
          <>
            {data.notes.length === 0 && cursors.length > 1 && (
              <Note>이 가지의 글이 삭제되었습니다. 이전 가지로 돌아가주세요.</Note>
            )}
            <div className="actions tree-pagination">
              {cursors.length > 1 && (
                <Button
                  variant="secondary"
                  onClick={() => setPagination({ revision, cursors: cursors.slice(0, -1) })}
                >
                  이전 이야기들
                </Button>
              )}
              {cursors.length * storiesPerTree < data.total && data.notes.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => setPagination({ revision, cursors: [...cursors, data.notes.at(-1)?.id] })}
                >
                  다음 이야기들
                </Button>
              )}
              {data.total > storiesPerTree && (
                <p className="small">
                  {cursors.length} / {Math.ceil(data.total / storiesPerTree)}번째 가지
                </p>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}
