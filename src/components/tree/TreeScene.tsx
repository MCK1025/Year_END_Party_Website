import { useEffect, useRef, useState } from "react";
import type { GraphicsSession } from "../../graphics/types";
import { PaperFir } from "./PaperFir";

export function TreeScene({
  paused,
  onStatic,
}: {
  readonly paused: boolean;
  readonly onStatic: (value: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pauseRequested = useRef(paused);
  const session = useRef<GraphicsSession | null>(null);
  const [status, setStatus] = useState<"loading" | "webgl" | "fallback">("loading");
  useEffect(() => onStatic(status === "fallback"), [onStatic, status]);
  useEffect(() => {
    let live = true;
    void import("../../graphics/christmas")
      .then(async ({ createChristmasScene }) => {
        if (!live || !canvas.current) return;
        try {
          const created = createChristmasScene(
            canvas.current,
            () => {
              if (live) setStatus("fallback");
              session.current?.dispose();
              session.current = null;
            },
            pauseRequested.current,
          );
          session.current = created;
          await created.ready;
          if (live && session.current === created) setStatus("webgl");
        } catch {
          // WebGL is optional: the accessible note controls and SVG fir remain available.
          if (live) {
            session.current?.dispose();
            session.current = null;
            setStatus("fallback");
          }
        }
      })
      .catch(() => {
        if (live) setStatus("fallback");
      });
    return () => {
      live = false;
      session.current?.dispose();
      session.current = null;
    };
  }, []);
  useEffect(() => {
    pauseRequested.current = paused;
    session.current?.setPaused(paused);
  }, [paused]);
  return (
    <div className="tree-scene" aria-hidden="true" data-renderer={status}>
      <PaperFir staticEffects={status !== "webgl"} />
      <canvas ref={canvas} className={status === "webgl" ? "tree-canvas" : "tree-canvas is-fallback"} />
    </div>
  );
}
