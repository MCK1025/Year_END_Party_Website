import { type PointerEvent, useRef } from "react";

export function usePageSwipe(move: (direction: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  return {
    onPointerDown(e: PointerEvent) {
      if (!e.isPrimary || e.button !== 0 || (e.target instanceof Element && e.target.closest("button"))) {
        start.current = null;
        return;
      }
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    },
    onPointerCancel() {
      start.current = null;
    },
    onPointerUp(e: PointerEvent) {
      const point = start.current;
      start.current = null;
      if (!point || point.id !== e.pointerId) return;
      const dx = e.clientX - point.x;
      const dy = e.clientY - point.y;
      if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.6) move(dx < 0 ? 1 : -1);
    },
  };
}
