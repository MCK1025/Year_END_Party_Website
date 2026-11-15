import { OrthographicCamera, Scene, WebGLRenderer } from "three";
import { activeSeconds, motionMedia, observeMotion } from "../lib/motion";
import type { EffectFactory, GraphicsSession } from "./types";

export type GraphicsFailure = "WEBGL_CONTEXT_LOST" | "RENDER_ERROR" | "SHADER_PREPARATION_FAILED";
type Playback = {
  readonly firstFrame: () => void;
  readonly activity: (reason: string) => void;
  readonly compile: () => void;
  readonly ephemeralCanvas?: boolean;
};
export function createGraphicsSession(
  canvas: HTMLCanvasElement,
  factories: readonly EffectFactory[],
  failed: (reason: GraphicsFailure) => void,
  worldHeight = 6,
  playback?: Playback,
): GraphicsSession {
  const motion = motionMedia();
  if (typeof ResizeObserver !== "function" || typeof IntersectionObserver !== "function")
    throw new Error("Observers unavailable");
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  let shaderFailed = false;
  if (playback)
    renderer.debug.onShaderError = () => {
      shaderFailed = true;
    };
  const scene = new Scene(),
    camera = new OrthographicCamera(
      -worldHeight / 2,
      worldHeight / 2,
      worldHeight / 2,
      -worldHeight / 2,
      0.1,
      30,
    );
  camera.position.z = 10;
  const effects: ReturnType<EffectFactory>[] = [];
  try {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    for (const factory of factories) effects.push(factory({ scene, camera }));
    for (const effect of effects) effect.update(0);
  } catch (error) {
    for (const effect of effects) effect.dispose();
    if (playback?.ephemeralCanvas) renderer.forceContextLoss();
    renderer.dispose();
    throw error;
  }
  let paused = false,
    visible = false,
    stopped = false,
    disposed = false,
    compiled = false,
    rendered = false;
  let elapsed = 0,
    previous: number | null = null,
    activity = "";
  function fail(reason: GraphicsFailure) {
    if (stopped || disposed) return;
    stopped = true;
    renderer.setAnimationLoop(null);
    failed(reason);
  }
  function draw() {
    renderer.render(scene, camera);
    if (shaderFailed) fail("SHADER_PREPARATION_FAILED");
  }
  function animate(time: number) {
    if (disposed || stopped) return;
    try {
      elapsed += previous === null ? 0 : activeSeconds(time - previous, Boolean(playback));
      previous = time;
      for (const effect of effects) effect.update(elapsed);
      draw();
      if (!stopped && !rendered) {
        rendered = true;
        playback?.firstFrame();
      }
    } catch {
      fail("RENDER_ERROR");
    }
  }
  function sync() {
    if (disposed || stopped) return;
    const reason = document.hidden
      ? "DOCUMENT_HIDDEN"
      : !canvas.clientWidth || !canvas.clientHeight
        ? "ZERO_SIZE"
        : !visible
          ? "OFFSCREEN"
          : motion?.matches
            ? "SYSTEM_REDUCED_MOTION"
            : !compiled
              ? "COMPILING"
              : paused
                ? "PAUSED"
                : "ACTIVE";
    if (reason !== activity) {
      activity = reason;
      previous = null;
      playback?.activity(reason);
    }
    renderer.setAnimationLoop(reason === "ACTIVE" ? animate : null);
    if (compiled && reason === "PAUSED") {
      try {
        draw();
      } catch {
        fail("RENDER_ERROR");
      }
    } else if (compiled && reason === "SYSTEM_REDUCED_MOTION" && !document.hidden && visible) {
      try {
        draw();
      } catch {
        fail("RENDER_ERROR");
      }
    }
  }
  const size = new ResizeObserver(() => {
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    if (width && height) {
      camera.left = (-worldHeight * width) / height / 2;
      camera.right = -camera.left;
      camera.updateProjectionMatrix();
      try {
        renderer.setSize(width, height, false);
        for (const effect of effects) effect.update(elapsed);
      } catch {
        fail("RENDER_ERROR");
        return;
      }
    }
    sync();
  });
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    sync();
  });
  const lost = (e: Event) => {
    e.preventDefault();
    fail("WEBGL_CONTEXT_LOST");
  };
  const stopMotion = observeMotion(motion, sync);
  canvas.addEventListener("webglcontextlost", lost);
  document.addEventListener("visibilitychange", sync);
  size.observe(canvas);
  intersection.observe(canvas);
  const ready = Promise.resolve()
    .then(() => {
      if (disposed || stopped) return;
      playback?.compile();
      return renderer.compileAsync(scene, camera);
    })
    .then(() => {
      if (!disposed && !stopped) {
        compiled = true;
        sync();
      }
    });
  return {
    ready,
    setPaused(value) {
      paused = value;
      sync();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      size.disconnect();
      intersection.disconnect();
      stopMotion();
      document.removeEventListener("visibilitychange", sync);
      canvas.removeEventListener("webglcontextlost", lost);
      for (const effect of effects) effect.dispose();
      if (playback?.ephemeralCanvas) renderer.forceContextLoss();
      renderer.dispose();
    },
  };
}
