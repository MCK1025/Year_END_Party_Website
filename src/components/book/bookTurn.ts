import type { GraphicsSession } from "../../graphics/types";
import { motionMedia, observeMotion } from "../../lib/motion";
import { debuggingMotion, geometry, type MotionTrace } from "../../lib/motionDebug";
import { notebookFold } from "./notebookFold";
import { mirrorPaper, visiblePaper } from "./pageMirror";

export function freezeTurn(
  paper: HTMLElement,
  forward: boolean,
  trace: MotionTrace,
  onFinish: (reason: string) => void,
) {
  const display = getComputedStyle(paper);
  if (display.display === "none" || display.visibility === "hidden") {
    trace("CSS_HIDDEN", { mode: "none" });
    return null;
  }
  const slice = visiblePaper(paper);
  if (!slice.width || !slice.height) {
    trace("ZERO_SIZE", { mode: "none" });
    return null;
  }
  const frame = paper.parentElement;
  const source = mirrorPaper(paper, slice);
  if (!frame || !source) {
    trace("SNAPSHOT_UNSUPPORTED", { mode: "none" });
    return null;
  }
  const stage = document.createElement("div");
  stage.className = "curl-stage";
  stage.inert = true;
  stage.setAttribute("aria-hidden", "true");
  stage.dataset.turn = forward ? "forward" : "backward";
  Object.assign(stage.style, {
    top: `${slice.offset}px`,
    width: `${slice.width}px`,
    height: `${slice.height}px`,
  });
  frame.style.height = `${frame.getBoundingClientRect().height}px`;
  stage.append(source.clip);
  frame.append(stage);
  trace("SOURCE_VISUAL_SHOWN", { width: slice.width, height: slice.height });
  const life = new AbortController();
  let work: AbortController | undefined,
    session: GraphicsSession | undefined,
    clock: Animation | undefined,
    timer = 0;
  let face = source,
    canvas: HTMLCanvasElement | undefined;
  let started = false,
    settled = false,
    committed = false;
  const width = innerWidth;
  function releaseGPU() {
    work?.abort();
    session?.dispose();
    session = undefined;
    canvas?.remove();
    canvas = undefined;
  }
  function end(reason: string) {
    if (settled) return;
    settled = true;
    life.abort();
    clearTimeout(timer);
    stopPolicy();
    releaseGPU();
    clock?.cancel();
    stage.remove();
    frame?.style.removeProperty("height");
    paper.style.removeProperty("transform");
    paper.style.removeProperty("min-height");
    paper.inert = false;
    trace(reason, { mode: stage.dataset.mode ?? "none" });
    trace("CLEANUP_COMPLETED");
    onFinish(reason);
  }
  const stopPolicy = observeMotion(motionMedia(), () => end("POLICY_CHANGED"));
  const options = { signal: life.signal };
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) end("DOCUMENT_HIDDEN");
    },
    options,
  );
  paper.addEventListener("input", () => end("CONTENT_CHANGED"), options);
  const resize = () => {
    if (debuggingMotion) trace("RESIZE", geometry(stage));
    if (Math.abs(innerWidth - width) > Math.max(64, width * 0.15)) end("VIEWPORT_GEOMETRY_CHANGED");
  };
  window.addEventListener("resize", resize, options);
  window.visualViewport?.addEventListener("resize", resize, options);
  timer = window.setTimeout(() => end("TARGET_NOT_READY"), 1600);
  function progress() {
    const time = typeof clock?.currentTime === "number" ? clock.currentTime : 0;
    const t = Math.max(0, Math.min(1, time / notebookFold.duration));
    const p = t * t * (3 - 2 * t);
    return forward ? p : 1 - p;
  }
  function start(mode: "webgl" | "dom") {
    if (settled || started) return;
    started = true;
    clearTimeout(timer);
    stage.dataset.mode = mode;
    trace(mode === "webgl" ? "FIRST_CURL_FRAME" : "DOM_CONTENT_TURN", { mode });
    const frames =
      mode === "dom"
        ? [
            { transform: forward ? notebookFold.flat : notebookFold.leftHinge },
            { transform: forward ? notebookFold.leftHinge : notebookFold.flat },
          ]
        : [{ offset: 0 }, { offset: 1 }];
    try {
      clock = face.clip.animate(frames, {
        id: "paper-curl",
        duration: notebookFold.duration,
        easing: mode === "dom" ? notebookFold.easing : "linear",
        fill: "both",
      });
      void clock.finished.then(
        () => end("TURN_COMPLETED"),
        () => end("ANIMATION_CANCELLED"),
      );
    } catch {
      end("ANIMATION_START_FAILED");
      return;
    }
    if (debuggingMotion) {
      const probe = window.setTimeout(() => {
        const visual = canvas ?? face.clip;
        trace("DISPLAY_SAMPLE", {
          ...geometry(visual),
          playState: clock?.playState ?? "unknown",
          currentTime: typeof clock?.currentTime === "number" ? Math.round(clock.currentTime) : null,
        });
      }, 110);
      life.signal.addEventListener("abort", () => clearTimeout(probe), { once: true });
    }
    timer = window.setTimeout(() => end("WATCHDOG_TIMEOUT"), 1450);
  }
  function fallback(reason: string) {
    if (settled) return;
    releaseGPU();
    trace(reason);
    if (started) {
      end("GRAPHICS_INTERRUPTED");
      return;
    }
    face.clip.style.opacity = "";
    if (!window.CSS?.supports("transform", "rotateY(12deg)") || typeof face.clip.animate !== "function") {
      end("DOM_3D_UNAVAILABLE");
      return;
    }
    start("dom");
  }
  function commit() {
    if (settled || committed) return;
    committed = true;
    clearTimeout(timer);
    paper.inert = true;
    // Keep the visible slice at the same physical height when leaving the bottom of a long form.
    paper.style.transform = `translateY(${slice.offset}px)`;
    paper.style.minHeight = `${slice.height}px`;
    trace("TARGET_COMMITTED");
    if (paper.querySelector('[aria-busy="true"]')) {
      end("TARGET_NOT_READY");
      return;
    }
    if (!forward) {
      const target = mirrorPaper(paper, { ...slice, offset: 0 });
      if (!target) {
        end("TARGET_NOT_READY");
        return;
      }
      face = target;
      stage.append(target.clip);
      face.clip.style.transform = notebookFold.leftHinge;
    }
    if (typeof face.clip.animate !== "function") {
      end("WAAPI_UNAVAILABLE");
      return;
    }
    if (!face.raster) {
      fallback("SNAPSHOT_UNSUPPORTED");
      return;
    }
    work = new AbortController();
    const signal = work.signal;
    timer = window.setTimeout(() => fallback("CAPTURE_TIMEOUT"), 720);
    void Promise.all([import("./rasterPaper"), import("../../graphics/pageCurl")])
      .then(async ([raster, gpu]) => {
        if (signal.aborted) return;
        const image = await raster.rasterPaper(face.clip, signal);
        if (signal.aborted) return;
        trace("CONTENT_SNAPSHOT_READY", { width: image.width, height: image.height });
        canvas = document.createElement("canvas");
        stage.append(canvas);
        session = gpu.createPageCurl(
          canvas,
          image,
          progress,
          () => {
            if (signal.aborted) return;
            face.clip.style.opacity = "0";
            start("webgl");
          },
          () => fallback("GRAPHICS_FAILED"),
        );
        await session.ready;
      })
      .catch(() => {
        if (!signal.aborted) fallback("CAPTURE_OR_GRAPHICS_FAILED");
      });
  }
  return { commit, end, top: slice.top };
}
