export const reduceQuery = "(prefers-reduced-motion: reduce)";
export const motionMedia = () =>
  typeof window.matchMedia === "function" ? window.matchMedia(reduceQuery) : undefined;
export function observeMotion(media: MediaQueryList | undefined, change: () => void) {
  if (media?.addEventListener) {
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }
  media?.addListener(change);
  return () => media?.removeListener(change);
}
export function motionPolicy(reduced: boolean | undefined, pageOff = false) {
  return reduced === undefined
    ? "PREFERENCE_UNKNOWN"
    : reduced
      ? "SYSTEM_REDUCED_MOTION"
      : pageOff
        ? "USER_PAGE_EFFECTS_DISABLED"
        : "ALLOWED";
}
export function activeSeconds(deltaMs: number, fixedDuration: boolean) {
  const delta = Math.max(0, deltaMs) / 1000;
  return fixedDuration ? delta : Math.min(delta, 0.05);
}
export function safeRoute(route: unknown) {
  return typeof route === "string" &&
    ["/", "/invite", "/login", "/survey", "/nominate", "/forest", "/event", "/tree", "/admin"].includes(route)
    ? route
    : "other";
}
