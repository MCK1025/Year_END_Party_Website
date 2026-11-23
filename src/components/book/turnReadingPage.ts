import { motionMedia, motionPolicy, observeMotion } from "../../lib/motion";
import { traceMotion } from "../../lib/motionDebug";
import { notebookFold } from "./notebookFold";

/** Restore flat geometry before measuring a page that contains, or sits inside, a moving sheet. */
export function settleReadingTurns(surface: HTMLElement, subtree = false) {
  for (const turn of surface.getAnimations?.({ subtree }) ?? [])
    if (turn.id === "browse-turn-previous" || turn.id === "browse-turn-next") turn.cancel();
}

/** Open the outgoing sheet on Next. On Back, lay the destination down over the stationary old page. */
export function turnReadingPage(
  paper: HTMLElement,
  forward: boolean,
  still: boolean,
  departingPage?: HTMLElement,
) {
  const trace = traceMotion("book");
  const media = motionMedia();
  const policy = motionPolicy(media?.matches, still);
  if (policy !== "ALLOWED" || document.hidden || typeof paper.animate !== "function") {
    trace(policy !== "ALLOWED" ? policy : document.hidden ? "DOCUMENT_HIDDEN" : "WAAPI_UNAVAILABLE", {
      mode: "none",
    });
    return;
  }
  if (departingPage) {
    // The destination can restore a different scroll position on browser Back.
    if (paper.classList.contains("book-surface"))
      departingPage.style.top = `${Math.max(0, -paper.getBoundingClientRect().top)}px`;
    // Each spread isolates its layers, so the underlay stays above the spread's own background.
    departingPage.style.zIndex = forward ? "2" : "-1";
    paper.after(departingPage);
  }
  const openingSheet = forward ? departingPage : undefined;
  const face = openingSheet ?? paper;
  const rect = face.getBoundingClientRect();
  const middle = Math.max(0, (Math.max(0, rect.top) + Math.min(innerHeight, rect.bottom)) / 2 - rect.top);
  const hinge = `0% ${middle}px`;
  const folded = {
    backfaceVisibility: "hidden",
    transformOrigin: hinge,
    transform: notebookFold.leftHinge,
    boxShadow: "inset 20px 0 30px -14px rgba(55,40,23,.24), 6px 2px 12px rgba(55,40,23,.15)",
  };
  const flat = {
    backfaceVisibility: "hidden",
    transformOrigin: hinge,
    transform: notebookFold.flat,
    boxShadow: "inset 0 0 0 0 rgba(55,40,23,0), 0 0 0 rgba(55,40,23,0)",
  };
  let animation: Animation;
  try {
    animation = face.animate(openingSheet ? [flat, folded] : [folded, flat], {
      id: forward ? "browse-turn-next" : "browse-turn-previous",
      duration: notebookFold.duration,
      fill: openingSheet ? "forwards" : "none",
      easing: notebookFold.easing,
    });
  } catch {
    departingPage?.remove();
    trace("ANIMATION_START_FAILED", { mode: "none" });
    return;
  }
  trace("DOM_CONTENT_TURN", { mode: "dom", forward });
  const cancel = () => {
    departingPage?.remove();
    animation.cancel();
  };
  const stop = observeMotion(media, cancel);
  document.addEventListener("visibilitychange", cancel);
  const clean = () => {
    departingPage?.remove();
    stop();
    document.removeEventListener("visibilitychange", cancel);
  };
  void animation.finished.then(
    () => {
      clean();
      trace("TURN_COMPLETED", { mode: "dom" });
    },
    () => {
      clean();
      trace("ANIMATION_CANCELLED", { mode: "dom" });
    },
  );
  return cancel;
}
