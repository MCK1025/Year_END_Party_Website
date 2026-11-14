import { OrthographicCamera, Scene, WebGLRenderer } from "three";
import type { EffectFactory, GraphicsSession } from "./types";

/** One lifecycle owner per canvas; scenes are composed from independently disposable effects. */
export function createGraphicsSession(
  canvas: HTMLCanvasElement,
  factories: readonly EffectFactory[],
  failed: () => void,
  worldHeight = 6,
): GraphicsSession {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new Scene();
  const camera = new OrthographicCamera(
    -worldHeight / 2,
    worldHeight / 2,
    worldHeight / 2,
    -worldHeight / 2,
    0.1,
    30,
  );
  camera.position.set(0, 0, 10);
  const effects = factories.map((factory) => factory({ scene, camera }));
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let paused = false;
  let visible = true;
  let lost = false;
  let disposed = false;
  let compiled = false;
  let elapsed = 0;
  let previous: number | null = null;
  const draw = () => renderer.render(scene, camera);
  const animate = (time: number) => {
    elapsed += previous === null ? 0 : Math.min((time - previous) / 1000, 0.05);
    previous = time;
    for (const effect of effects) effect.update(elapsed);
    draw();
  };
  const sync = () => {
    if (disposed) return;
    previous = null;
    renderer.setAnimationLoop(null);
    if (lost || !compiled) return;
    if (!paused && !motion.matches && visible && !document.hidden) renderer.setAnimationLoop(animate);
    else draw();
  };
  const size = new ResizeObserver(() => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    camera.left = (-worldHeight * width) / height / 2;
    camera.right = -camera.left;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    for (const effect of effects) effect.update(elapsed);
    sync();
  });
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    sync();
  });
  const contextLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    renderer.setAnimationLoop(null);
    failed();
  };
  canvas.addEventListener("webglcontextlost", contextLost);
  document.addEventListener("visibilitychange", sync);
  motion.addEventListener("change", sync);
  size.observe(canvas);
  intersection.observe(canvas);
  for (const effect of effects) effect.update(0);
  const ready = renderer.compileAsync(scene, camera).then(() => {
    compiled = true;
    sync();
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
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
      canvas.removeEventListener("webglcontextlost", contextLost);
      for (const effect of effects) effect.dispose();
      renderer.dispose();
    },
  };
}
