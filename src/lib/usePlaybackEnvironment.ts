import { type RefObject, useEffect, useState } from "react";
import { motionMedia, observeMotion } from "./motion";

export function usePlaybackEnvironment(stage: RefObject<HTMLElement | null>) {
  const [reduced, setReduced] = useState(() => motionMedia()?.matches ?? true);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const media = motionMedia();
    const stop = observeMotion(media, () => setReduced(media?.matches ?? true));
    const el = stage.current;
    if (!el) return stop;
    let onscreen = false;
    const sync = () => setVisible(onscreen && !document.hidden);
    const check = () => {
      const box = el.getBoundingClientRect();
      onscreen = box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
      sync();
    };
    const observer =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(([entry]) => {
            onscreen = entry?.isIntersecting ?? false;
            sync();
          })
        : null;
    check();
    observer?.observe(el);
    if (!observer) {
      window.addEventListener("scroll", check, { passive: true });
      window.addEventListener("resize", check);
    }
    document.addEventListener("visibilitychange", sync);
    return () => {
      stop();
      observer?.disconnect();
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [stage]);
  return { visible, reduced };
}
