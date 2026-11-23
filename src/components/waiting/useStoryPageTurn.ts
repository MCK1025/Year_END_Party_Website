import { useCallback, useLayoutEffect, useRef } from "react";
import { motionMedia, motionPolicy } from "../../lib/motion";
import { mirrorPaper } from "../book/pageMirror";
import { turnReadingPage } from "../book/turnReadingPage";

export function useStoryPageTurn(index: number, enabled: boolean, still: boolean) {
  const sheet = useRef<HTMLDivElement>(null);
  const pending = useRef<{ forward: boolean; sheet: HTMLElement | undefined } | null>(null);
  const running = useRef<(() => void) | undefined>(undefined);

  const prepare = useCallback(
    (forward: boolean) => {
      running.current?.();
      pending.current = null;
      const paper = sheet.current;
      if (!enabled || !paper || document.hidden || motionPolicy(motionMedia()?.matches, still) !== "ALLOWED")
        return;
      const { width, height, left, top } = paper.getBoundingClientRect();
      const old = mirrorPaper(paper, { width, height, left, top, offset: 0 });
      pending.current = { forward, sheet: old?.clip };
    },
    [enabled, still],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Commit only after the requested scene's HTML replaces the previous illustration.
  useLayoutEffect(() => {
    const turn = pending.current;
    pending.current = null;
    if (!turn || !sheet.current || !enabled) return;
    running.current = turnReadingPage(sheet.current, turn.forward, still, { sheet: turn.sheet });
    return () => {
      running.current?.();
      running.current = undefined;
    };
  }, [index, enabled, still]);
  return { sheet, prepare };
}
