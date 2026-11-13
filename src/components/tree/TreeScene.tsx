import { useEffect, useRef, useState } from "react";
import type { GraphicsSession } from "../../graphics/types";

export function TreeScene({ paused }: { readonly paused: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const session = useRef<GraphicsSession | null>(null);
  const [status, setStatus] = useState<"loading" | "webgl" | "fallback">("loading");
  useEffect(() => {
    let live = true;
    void import("../../graphics/christmas")
      .then(async ({ createChristmasScene }) => {
        if (!live || !canvas.current) return;
        try {
          const created = createChristmasScene(canvas.current, () => {
            if (live) setStatus("fallback");
            session.current?.dispose();
            session.current = null;
          });
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
    if (status === "webgl") session.current?.setPaused(paused);
  }, [paused, status]);
  return (
    <div className="tree-scene" aria-hidden="true" data-renderer={status}>
      {status !== "webgl" && (
        <svg viewBox="0 0 400 520" className="tree-fallback" focusable="false">
          <title>크리스마스 트리 장식</title>
          <path className="fir-trunk" d="M184 410h32v66h-32z" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              className={i % 2 ? "fir-leaf" : "fir-deep"}
              d={`M200 ${62 + i * 47} L${155 - i * 23} ${185 + i * 50} Q200 ${203 + i * 50} ${245 + i * 23} ${185 + i * 50} Z`}
            />
          ))}
          <path className="fir-star" d="m200 26 7 16 18 2-13 12 3 18-15-9-15 9 3-18-13-12 18-2z" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <circle className="fir-star" key={i} cx={125 + ((i * 47) % 150)} cy={170 + i * 34} r="3" />
          ))}
        </svg>
      )}
      <canvas ref={canvas} className={status === "webgl" ? "tree-canvas" : "tree-canvas is-fallback"} />
    </div>
  );
}
