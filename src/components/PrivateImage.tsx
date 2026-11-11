import { useEffect, useState } from "react";
import { supabase } from "../lib/api";

export function PrivateImage({
  path,
  alt,
  logo = false,
}: {
  readonly path: string;
  readonly alt: string;
  readonly logo?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    async function load() {
      const { data, error } = await supabase.storage.from("event-media").createSignedUrl(path, 60);
      if (live) {
        setUrl(data?.signedUrl ?? "");
        setFailed(Boolean(error));
      }
    }
    void load();
    const interval = setInterval(() => {
      void load();
    }, 45000);
    return () => {
      live = false;
      clearInterval(interval);
    };
  }, [path]);
  if (!url) return <p className="small">{failed ? "사진을 불러오지 못했습니다." : "사진을 불러오는 중…"}</p>;
  return (
    <img
      className={logo ? "company-logo" : "recap-photo"}
      src={url}
      width={logo ? 120 : 800}
      height={logo ? 64 : 600}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}
