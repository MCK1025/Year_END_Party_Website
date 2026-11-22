import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/api";
import { Button } from "../ui";

export function AlbumPhoto({
  path,
  alt,
  style,
}: {
  readonly path: string;
  readonly alt: string;
  readonly style?: CSSProperties;
}) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A retry requests a fresh signed URL for the same private object.
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const { data, error } = await supabase.storage.from("event-media").createSignedUrl(path, 60);
        if (!live) return;
        if (error || !data) setFailed(true);
        else {
          setUrl(data.signedUrl);
          setFailed(false);
        }
      } catch {
        if (live) setFailed(true);
      }
    }
    void load();
    return () => {
      live = false;
    };
  }, [path, attempt]);
  if (failed)
    return (
      <div className="album-placeholder">
        <span>사진을 불러오지 못했습니다.</span>
        <Button
          variant="secondary"
          onClick={() => {
            setFailed(false);
            setUrl("");
            setAttempt((v) => v + 1);
          }}
        >
          사진 다시 시도
        </Button>
      </div>
    );
  return url ? (
    <img src={url} alt={alt} style={style} onError={() => setFailed(true)} />
  ) : (
    <div className="album-placeholder" role="status">
      사진을 불러오는 중…
    </div>
  );
}
