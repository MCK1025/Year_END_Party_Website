import { type RefObject, useEffect, useRef } from "react";
import symbolUrl from "../../assets/brand/invitation-symbol.png";
import type { createInvitationScene } from "../../graphics/invitation";
import { invitationAnchor } from "../../graphics/invitation-layout";
import { type InvitationPhase, invitationMotion } from "../../lib/invitation";
import { debuggingMotion, errorKind, geometry, type MotionTrace } from "../../lib/motionDebug";

type Props = {
  readonly letter: RefObject<HTMLElement | null>;
  readonly departing: boolean;
  readonly phase: (next: InvitationPhase) => void;
  readonly failed: (reason: string) => void;
  readonly complete: () => void;
  readonly trace: MotionTrace;
};
export function InvitationScene({ letter, departing, phase, failed, complete, trace }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const session = useRef<ReturnType<typeof createInvitationScene> | null>(null);
  useEffect(() => {
    const surface = canvas.current,
      content = letter.current;
    if (!surface || !content) return;
    let owned: ReturnType<typeof createInvitationScene> | null = null;
    const release = () => {
      owned?.dispose();
      if (session.current === owned) session.current = null;
      owned = null;
    };
    let live = true,
      stage = "IMPORT",
      active = false,
      first = false,
      ready = false,
      eligible = false;
    const bounds = surface.getBoundingClientRect();
    let inView =
      bounds.bottom > 0 && bounds.top < innerHeight && bounds.right > 0 && bounds.left < innerWidth;
    const preparationView =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(([entry]) => {
            if (!live || !entry) return;
            inView = entry.isIntersecting;
            if (!inView) trace("OFFSCREEN");
            watch();
          })
        : undefined;
    let remaining: number = invitationMotion.preparationTimeout;
    let since = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    function fail(reason: string, error?: unknown) {
      if (!live) return;
      live = false;
      clearTimeout(timer);
      trace(reason, { stage, errorType: errorKind(error) });
      preparationView?.disconnect();
      release();
      failed(reason);
    }
    // The preparation budget accrues only in the foreground. After start, count only drawable time.
    function watch() {
      const now = performance.now();
      if (eligible) remaining -= now - since;
      since = now;
      clearTimeout(timer);
      eligible = live && !document.hidden && !first && (ready ? active : inView);
      if (eligible)
        timer = setTimeout(
          () => fail(ready ? "FIRST_FRAME_TIMEOUT" : "PREPARATION_TIMEOUT"),
          Math.max(0, remaining),
        );
    }
    const visibility = () => {
      trace(document.hidden ? "DOCUMENT_HIDDEN" : "DOCUMENT_VISIBLE");
      watch();
    };
    preparationView?.observe(surface);
    document.addEventListener("visibilitychange", visibility);
    watch();
    trace("IMPORT_START");
    void import("../../graphics/invitation")
      .then(async (mod) => {
        if (!live) {
          trace("LATE_IMPORT_IGNORED");
          return;
        }
        trace("IMPORT_END");
        stage = "INIT";
        trace("INIT_START");
        try {
          const symbol = new Image();
          symbol.src = symbolUrl;
          await symbol.decode();
          if (!live) return;
          const created = mod.createInvitationScene(
            surface,
            symbol,
            () => invitationAnchor(surface.getBoundingClientRect(), content.getBoundingClientRect()),
            {
              phase(next) {
                if (!live) return;
                phase(next);
                if (next === "reading") session.current?.setPaused(true);
              },
              activity(reason) {
                if (!live) return;
                active = reason === "ACTIVE";
                trace(reason, debuggingMotion ? geometry(surface) : {});
                watch();
              },
              compile() {
                stage = "SHADER";
                trace("SHADER_START");
              },
              firstFrame() {
                if (!live) return;
                first = true;
                clearTimeout(timer);
                trace("FIRST_RENDER_RETURNED", debuggingMotion ? geometry(surface) : {});
                if (debuggingMotion) {
                  const s = getComputedStyle(surface);
                  if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0)
                    trace("CSS_HIDDEN");
                }
              },
              complete() {
                if (live) complete();
              },
              failed: fail,
            },
          );
          owned = created;
          session.current = created;
          trace("INIT_END");
          await created.ready;
          if (!live) {
            trace("LATE_READY_IGNORED");
            return;
          }
          if (!document.hidden && (!surface.clientWidth || !surface.clientHeight)) {
            fail("ZERO_SIZE");
            return;
          }
          trace("SHADER_READY");
          preparationView?.disconnect();
          ready = true;
          eligible = false;
          remaining = invitationMotion.preparationTimeout;
          stage = "FIRST_FRAME";
          watch();
          trace("START_REQUESTED");
          created.start();
        } catch (error) {
          fail(stage === "INIT" ? "WEBGL_INIT_FAILED" : "SHADER_PREPARATION_FAILED", error);
        }
      })
      .catch((error) => fail("IMPORT_FAILED", error));
    return () => {
      live = false;
      clearTimeout(timer);
      preparationView?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      release();
      trace("SCENE_DISPOSED");
    };
  }, [letter, phase, failed, complete, trace]);
  useEffect(() => {
    if (departing) session.current?.depart();
  }, [departing]);
  return (
    <div aria-hidden="true">
      <canvas className="invite-canvas" ref={canvas} />
    </div>
  );
}
