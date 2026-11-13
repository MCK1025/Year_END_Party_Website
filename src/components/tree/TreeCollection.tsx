import { useEffect, useRef, useState } from "react";
import { forestTreeSchema } from "../../../supabase/functions/_shared/forest";
import { api, message } from "../../lib/api";
import { Button, Note } from "../ui";
import { MessageTree } from "./MessageTree";

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
    void api({ action: "forest_tree", payload: before === undefined ? {} : { before } }, forestTreeSchema)
      .then((result) => {
        if (generation.current === request) setData(result);
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
                이전 쪽지들
              </Button>
            )}
            {cursors.length * 12 < data.total && data.notes.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => setCursors((current) => [...current, data.notes.at(-1)?.id])}
              >
                다음 쪽지들
              </Button>
            )}
            {data.total > 12 && (
              <p className="small">
                {cursors.length} / {Math.ceil(data.total / 12)}번째 가지
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
