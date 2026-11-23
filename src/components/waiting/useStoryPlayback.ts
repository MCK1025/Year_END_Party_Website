import { type RefObject, useLayoutEffect, useRef } from "react";
import type { StoryScene } from "./story";

export function useStoryPlayback(
  root: RefObject<HTMLElement | null>,
  scene: StoryScene,
  playing: boolean,
  staticView: boolean,
  seek: number | null,
  advance: () => void,
) {
  const clock = useRef({ scene, offset: 0, since: 0, running: false });
  useLayoutEffect(() => {
    const state = clock.current;
    if (state.scene !== scene || staticView) {
      state.offset = 0;
      state.scene = scene;
    }
    if (seek !== null) state.offset = seek * scene.duration;
    state.since = performance.now();
    state.running = playing;
    const animations: Animation[] = [];
    function animate(selector: string, frames: Keyframe[]) {
      const el = root.current?.querySelector(selector);
      if (staticView || !el?.animate) return;
      const a = el.animate(frames, { duration: scene.duration, fill: "both" });
      a.pause();
      a.currentTime = state.offset;
      if (playing) a.play();
      animations.push(a);
    }
    animate(".work-story-art", [
      { transform: `scale(${scene.scale[0]})` },
      { transform: `scale(${scene.scale[1]})` },
    ]);
    const fade = Math.min(0.4, 400 / scene.duration);
    animate(".work-story-plate", [
      { opacity: 0.6 },
      { opacity: 1, offset: fade },
      { opacity: 1, offset: 1 - fade },
      { opacity: 0.6 },
    ]);
    animate(".work-story-finale-message", [
      { opacity: 0 },
      { opacity: 0, offset: 0.09 },
      { opacity: 1, offset: 0.18 },
      { opacity: 1 },
    ]);
    animate(".work-story-masero", [
      { opacity: 0 },
      { opacity: 0, offset: 0.22 },
      { opacity: 1, offset: 0.29 },
      { opacity: 1, offset: 0.52 },
      { opacity: 0, offset: 0.59 },
      { opacity: 0 },
    ]);
    animate(".work-story-company", [
      { opacity: 0 },
      { opacity: 0, offset: 0.59 },
      { opacity: 1, offset: 0.66 },
      { opacity: 1 },
    ]);
    const timer = playing
      ? window.setTimeout(advance, Math.max(0, scene.duration - state.offset))
      : undefined;
    return () => {
      clearTimeout(timer);
      if (state.running)
        state.offset = Math.min(scene.duration, state.offset + performance.now() - state.since);
      state.running = false;
      for (const a of animations) a.cancel();
    };
  }, [root, scene, playing, staticView, seek, advance]);
  return clock;
}
