import { motionMedia, motionPolicy, observeMotion } from "../../lib/motion";
import { traceMotion } from "../../lib/motionDebug";

/** Turn the incoming, already authorized HTML, including its live images and canvas. */
export function turnReadingPage(
  paper: HTMLElement,
  forward: boolean,
  still: boolean,
  duration = 540,
  underlay?: HTMLElement,
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
  const rect = paper.getBoundingClientRect();
  const middle = Math.max(0, (Math.max(0, rect.top) + Math.min(innerHeight, rect.bottom)) / 2 - rect.top);
  const hinge = `${forward ? "100%" : "0%"} ${middle}px`;
  // With a facing sheet, sweep the new page away from the reader so its top and bottom stay in the spread.
  const angle = (forward ? 73 : -73) * (underlay ? -1 : 1);
  const edge = forward ? -1 : 1;
  let animation: Animation;
  try {
    animation = paper.animate(
      [
        {
          transformOrigin: hinge,
          transform: `perspective(1400px) rotateY(${angle}deg)`,
          boxShadow: `inset ${edge * 20}px 0 30px -14px rgba(55,40,23,.24), ${edge * 6}px 2px 12px rgba(55,40,23,.15)`,
        },
        {
          transformOrigin: hinge,
          transform: "perspective(1400px) rotateY(0deg)",
          boxShadow: "inset 0 0 0 0 rgba(55,40,23,0), 0 0 0 rgba(55,40,23,0)",
        },
      ],
      {
        id: forward ? "browse-turn-next" : "browse-turn-previous",
        duration,
        easing: "cubic-bezier(.24,.62,.28,1)",
      },
    );
  } catch {
    trace("ANIMATION_START_FAILED", { mode: "none" });
    return;
  }
  if (underlay) paper.before(underlay);
  trace("DOM_CONTENT_TURN", { mode: "dom", forward });
  const cancel = () => {
    underlay?.remove();
    animation.cancel();
  };
  const stop = observeMotion(media, cancel);
  document.addEventListener("visibilitychange", cancel);
  const clean = () => {
    underlay?.remove();
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
