import { motionMedia, motionPolicy, observeMotion } from "../../lib/motion";
import { traceMotion } from "../../lib/motionDebug";
import { notebookFold } from "./notebookFold";

/** Open the outgoing sheet on Next. On Back, lay the destination down over the stationary old page. */
export function turnReadingPage(
  paper: HTMLElement,
  forward: boolean,
  still: boolean,
  options: { sheet: HTMLElement | undefined } | { duration: number },
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
  const notebook = "sheet" in options;
  const departingPage = notebook ? options.sheet : undefined;
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
  const leftHinge = notebook || !forward;
  const hinge = `${leftHinge ? "0%" : "100%"} ${middle}px`;
  const edge = leftHinge ? 1 : -1;
  const folded = {
    backfaceVisibility: "hidden",
    transformOrigin: hinge,
    transform: notebook ? notebookFold.leftHinge : `perspective(1400px) rotateY(${-edge * 73}deg)`,
    boxShadow: `inset ${edge * 20}px 0 30px -14px rgba(55,40,23,.24), ${edge * 6}px 2px 12px rgba(55,40,23,.15)`,
  };
  const flat = {
    backfaceVisibility: "hidden",
    transformOrigin: hinge,
    transform: notebook ? notebookFold.flat : "perspective(1400px) rotateY(0deg)",
    boxShadow: "inset 0 0 0 0 rgba(55,40,23,0), 0 0 0 rgba(55,40,23,0)",
  };
  let animation: Animation;
  try {
    animation = face.animate(openingSheet ? [flat, folded] : [folded, flat], {
      id: forward ? "browse-turn-next" : "browse-turn-previous",
      duration: notebook ? notebookFold.duration : options.duration,
      fill: openingSheet ? "forwards" : "none",
      easing: notebook ? notebookFold.easing : "cubic-bezier(.24,.62,.28,1)",
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
