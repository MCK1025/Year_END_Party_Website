import { useEffect, useRef, useState } from "react";
import { forestTreeSchema } from "../../../supabase/functions/_shared/forest";
import { api, message } from "../../lib/api";
import { Button, Note } from "../ui";
import { MessageTree } from "./MessageTree";
import { storiesPerTree } from "./ornaments";

export function TreeCollection() {
  const [data, setData] = useState<ReturnType<typeof forestTreeSchema.parse> | null>(null);
  const [error, setError] = useState("");
  const [cursors, setCursors] = useState<readonly (number | undefined)[]>([undefined]);
  const generation = useRef(0);
  const before = cursors.at(-1);
  useEffect(() => {
    const request = ++generation.current;
    setError("");
    setData(null);
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
        if (result && generation.current === request) setData(result);
      })
      .catch((e: unknown) => {
        if (generation.current === request) setError(message(e));
      });
    return () => {
      generation.current++;
    };
  }, [before]);
  return (
    <div className="stack">
      {error ? (
        <Note error>{error}</Note>
      ) : !data ? (
        <Note>가지마다 마음을 걸고 있습니다.</Note>
      ) : (
        <>
          <MessageTree notes={data.notes} total={data.total} page={cursors.length - 1} />
          {data.notes.length === 0 && cursors.length > 1 && (
            <Note>이 가지의 글이 삭제되었습니다. 이전 가지로 돌아가주세요.</Note>
          )}
          <div className="actions tree-pagination">
            {cursors.length > 1 && (
              <Button variant="secondary" onClick={() => setCursors((current) => current.slice(0, -1))}>
                이전 이야기들
              </Button>
            )}
            {cursors.length * storiesPerTree < data.total && data.notes.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => setCursors((current) => [...current, data.notes.at(-1)?.id])}
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
      )}
    </div>
  );
}
