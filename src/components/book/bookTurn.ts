import { motionMedia, observeMotion } from "../../lib/motion";
import { debuggingMotion, geometry, type MotionTrace } from "../../lib/motionDebug";

export function startTurn(leaf: HTMLElement, forward: boolean, trace: MotionTrace) {
  const width = innerWidth;
  const layout = () => {
    const style = getComputedStyle(leaf);
    return !leaf.offsetWidth || !leaf.offsetHeight
      ? style.display === "none"
        ? "CSS_HIDDEN"
        : "ZERO_SIZE"
      : style.visibility === "hidden"
        ? "CSS_HIDDEN"
        : null;
  };
  const hidden = layout();
  if (hidden) {
    trace(hidden, { mode: "none", ...geometry(leaf) });
    return () => {};
  }
  let animation: Animation | undefined;
  let ended = false;
  let simpleReason = "";
  if (!leaf.animate) simpleReason = "WAAPI_UNAVAILABLE";
  else if (!window.CSS?.supports("transform", "rotateY(12deg)")) simpleReason = "CSS_3D_UNAVAILABLE";
  else
    try {
      animation = leaf.animate(
        forward
          ? [
              { transform: "rotateY(0deg)", opacity: 1 },
              { transform: "rotateY(-91deg)", opacity: 0 },
            ]
          : [
              { transform: "rotateY(-91deg)", opacity: 0 },
              { transform: "rotateY(-12deg)", opacity: 0.85, offset: 0.72 },
              { transform: "rotateY(0deg)", opacity: 0 },
            ],
        { duration: 480, easing: "ease-in-out" },
      );
    } catch {
      simpleReason = "ANIMATION_START_FAILED";
    }
  leaf.dataset.turn = forward ? "forward" : "backward";
  if (simpleReason) leaf.classList.add("book-simple-turn");
  const mode = simpleReason ? "simple" : "3d";
  trace(simpleReason || "STARTED", { mode, direction: leaf.dataset.turn });
  if (debuggingMotion) trace("START_GEOMETRY", geometry(leaf));
  const timer = setTimeout(() => end("WATCHDOG_TIMEOUT"), 850);
  let probe = 0;
  if (debuggingMotion)
    probe = window.setTimeout(() => {
      const data = geometry(leaf);
      trace(data.opacity === 0 || layout() ? "NOT_VISIBLE_AT_SAMPLE" : "DISPLAY_SAMPLE", {
        ...data,
        playState: animation?.playState ?? "css",
        currentTime: typeof animation?.currentTime === "number" ? Math.round(animation.currentTime) : null,
      });
    }, 110);
  const resize = () => {
    if (debuggingMotion) trace("RESIZE", geometry(leaf));
    if (Math.abs(innerWidth - width) > Math.max(64, width * 0.15)) end("VIEWPORT_GEOMETRY_CHANGED");
  };
  const visibility = () => {
    if (document.hidden) end("DOCUMENT_HIDDEN");
  };
  const cssEnd = (e: AnimationEvent) => {
    if (e.target === leaf && e.animationName === "book-simple-turn") end("COMPLETED");
  };
  const stopMotion = observeMotion(motionMedia(), () => end("POLICY_CHANGED"));
  function end(reason: string) {
    if (ended) return;
    ended = true;
    trace(reason, { mode });
    clearTimeout(timer);
    clearTimeout(probe);
    stopMotion();
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", visibility);
    leaf.removeEventListener("animationend", cssEnd);
    animation?.cancel();
    leaf.classList.remove("book-simple-turn");
    delete leaf.dataset.turn;
  }
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", visibility);
  if (animation)
    void animation.finished.then(
      () => end("COMPLETED"),
      () => end("ANIMATION_CANCELLED"),
    );
  else leaf.addEventListener("animationend", cssEnd);
  return end;
}
