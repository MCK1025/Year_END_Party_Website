import { useEffect, useRef, useState } from "react";
import type { createStoryGraphics } from "../../graphics/waitingStory";
import type { StoryScene } from "./story";
import type { useStoryPlayback } from "./useStoryPlayback";

export function StoryLight({
  clock,
  paused,
  scene,
  seek,
}: {
  clock: ReturnType<typeof useStoryPlayback>;
  paused: boolean;
  scene: StoryScene;
  seek: number | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const session = useRef<ReturnType<typeof createStoryGraphics> | null>(null);
  const stopped = useRef(paused);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let live = true;
    const release = () => {
      session.current?.dispose();
      session.current = null;
    };
    const fail = () => {
      if (live) {
        setFailed(true);
        release();
      }
    };
    void import("../../graphics/waitingStory")
      .then(async ({ createStoryGraphics }) => {
        if (!live) return;
        const graphics = createStoryGraphics(
          el,
          () => {
            const c = clock.current;
            const t = c.offset + (c.running ? performance.now() - c.since : 0);
            return { scene: c.scene, fraction: Math.min(1, t / c.scene.duration) };
          },
          fail,
        );
        session.current = graphics;
        await graphics.ready;
        if (live && session.current === graphics) {
          graphics.refresh(stopped.current);
          setReady(true);
        }
      })
      .catch(fail);
    return () => {
      live = false;
      release();
    };
  }, [clock]);
  useEffect(() => {
    stopped.current = paused || seek !== null || !scene.surface;
    session.current?.refresh(stopped.current);
  }, [paused, scene, seek]);
  if (failed) return null;
  return (
    <span aria-hidden="true">
      <canvas className="work-story-light" data-story-overlay="" data-ready={ready} ref={canvas} />
    </span>
  );
}
