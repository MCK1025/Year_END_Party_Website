import { useEffect, useState } from "react";
import { z } from "zod";
import { recapSchema } from "../../supabase/functions/_shared/contracts";
import { api, message } from "../lib/api";
import { AlbumViewer } from "./recap/AlbumViewer";
import type { Moment } from "./recap/model";
import { Button, Note } from "./ui";

export function RecapCards({
  revision,
  storageKey,
  embedded = false,
}: {
  readonly revision: number;
  readonly storageKey: string;
  readonly embedded?: boolean;
}) {
  const [loaded, setLoaded] = useState<{ rows: Moment[]; revision: number } | null>(null);
  const [error, setError] = useState("");
  const [attempt, retry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry reloads the same published revision after a failed read.
  useEffect(() => {
    let live = true;
    setError("");
    api({ action: "recaps", payload: {} }, z.array(recapSchema)).then(
      (rows) => {
        if (live) setLoaded({ rows, revision });
      },
      (reason) => {
        if (live) {
          setLoaded(null);
          setError(message(reason));
        }
      },
    );
    return () => {
      live = false;
    };
  }, [revision, attempt]);
  if (error)
    return (
      <div className="stack">
        <Note error>{error}</Note>
        <Button onClick={() => retry((v) => v + 1)}>회고 다시 불러오기</Button>
      </div>
    );
  return (
    <>
      {loaded?.revision !== revision && <Note>회고를 불러오는 중…</Note>}
      {loaded && (
        <div hidden={loaded.revision !== revision}>
          {loaded.rows.length ? (
            <AlbumViewer key={storageKey} rows={loaded.rows} storageKey={storageKey} embedded={embedded} />
          ) : (
            <Note>
              {embedded ? "공개된 회고 장면이 아직 없습니다." : "첫 번째 Moment를 준비하고 있습니다."}
            </Note>
          )}
        </div>
      )}
    </>
  );
}
