import { type RefObject, useEffect, useState } from "react";
import { motionPolicy } from "../../lib/motion";
import { usePlaybackEnvironment } from "../../lib/usePlaybackEnvironment";
import { Button } from "../ui";

const readingTime = 6000;

export function AlbumAutoplay({
  viewer,
  still,
  reading,
  storageKey,
  advance,
}: {
  viewer: RefObject<HTMLElement | null>;
  still: boolean;
  reading: boolean;
  storageKey: string;
  advance: () => void;
}) {
  const { visible, reduced } = usePlaybackEnvironment(viewer);
  const policy = motionPolicy(reduced, still);
  const pauseKey = `${storageKey}:paused`;
  const [choice, choose] = useState<ReturnType<typeof motionPolicy> | "paused">(() => {
    try {
      if (sessionStorage.getItem(pauseKey)) return "paused";
    } catch {
      /* Playback controls also work without storage. */
    }
    return "ALLOWED";
  });
  const playing = choice === policy;
  useEffect(() => {
    if (!playing || !visible || reading) return;
    const timer = window.setTimeout(() => {
      if (!document.hidden && viewer.current?.getClientRects().length) advance();
    }, readingTime);
    return () => window.clearTimeout(timer);
  }, [playing, visible, reading, viewer, advance]);

  function toggle() {
    choose(playing ? "paused" : policy);
    try {
      if (playing) sessionStorage.setItem(pauseKey, "1");
      else sessionStorage.removeItem(pauseKey);
    } catch {
      /* Keep the current tab's in-memory choice. */
    }
  }
  return (
    <Button
      variant="secondary"
      aria-label={playing ? "회고 자동 재생 일시 정지" : "회고 자동 재생 시작"}
      onClick={toggle}
    >
      {playing ? "일시 정지" : "자동 재생"}
    </Button>
  );
}
