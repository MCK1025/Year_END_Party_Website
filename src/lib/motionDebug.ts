import { motionMedia } from "./motion";
export const debuggingMotion =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("motionDebug") === "1";
type Detail = Readonly<Record<string, string | number | boolean | null>>;
type Scope = "invitation" | "book";
const rows: { ms: number; scope: Scope; attempt: number; event: string; details: Detail }[] = [];
let sequence = 0;
const run = debuggingMotion ? Math.random().toString(36).slice(2, 10) : "";
export function traceMotion(scope: Scope) {
  const attempt = debuggingMotion ? ++sequence : 0;
  return (event: string, details: Detail = {}) => {
    if (!debuggingMotion) return;
    rows.push({ ms: Math.round(performance.now()), scope, attempt, event, details });
    if (rows.length > 150) rows.shift();
  };
}
export type MotionTrace = ReturnType<typeof traceMotion>;
export function geometry(el: HTMLElement): Detail {
  const style = getComputedStyle(el),
    r = el.getBoundingClientRect();
  return {
    width: Math.round(r.width),
    height: Math.round(r.height),
    display: style.display,
    visibility: style.visibility,
    opacity: Number(style.opacity),
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
    visualWidth: Math.round(window.visualViewport?.width ?? innerWidth),
    visualHeight: Math.round(window.visualViewport?.height ?? innerHeight),
  };
}
export function errorKind(error: unknown) {
  const name = error instanceof Error ? error.name : "unknown";
  return [
    "TypeError",
    "Error",
    "SyntaxError",
    "NotSupportedError",
    "AbortError",
    "SecurityError",
    "InvalidStateError",
  ].includes(name)
    ? name
    : "unknown";
}
export function clearMotion() {
  rows.length = 0;
}
export function motionReport(pageEffectsOff: boolean) {
  const asset = Array.from(document.scripts)
    .map((s) => s.src.match(/\/assets\/index-([a-zA-Z0-9_-]+)\.js(?:$|\?)/)?.[1])
    .find(Boolean);
  return {
    schemaVersion: 1,
    run,
    build: asset ?? "unknown",
    userAgent: navigator.userAgent,
    viewport: [innerWidth, innerHeight],
    visualViewport: window.visualViewport
      ? [window.visualViewport.width, window.visualViewport.height]
      : null,
    dpr: devicePixelRatio,
    reduced: motionMedia()?.matches ?? null,
    pageEffectsOff,
    hidden: document.hidden,
    capabilities: {
      matchMedia: typeof window.matchMedia === "function",
      waapi: typeof Element.prototype.animate === "function",
      resizeObserver: typeof ResizeObserver === "function",
      intersectionObserver: typeof IntersectionObserver === "function",
      css3d: window.CSS?.supports("transform", "rotateY(12deg)") ?? null,
    },
    events: rows.slice(),
  };
}
