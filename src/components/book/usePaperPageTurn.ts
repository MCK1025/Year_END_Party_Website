import { useCallback, useLayoutEffect, useRef } from "react";
import { motionMedia, motionPolicy } from "../../lib/motion";
import { mirrorPaper } from "./pageMirror";
import { settleReadingTurns, turnReadingPage } from "./turnReadingPage";

export function usePaperPageTurn(
  pageId: number | string | undefined,
  enabled: boolean,
  still: boolean,
  content?: object,
) {
  const sheet = useRef<HTMLDivElement>(null);
  const pending = useRef<{
    forward: boolean;
    sheet: HTMLElement | undefined;
    content: object | undefined;
  } | null>(null);
  const running = useRef<(() => void) | undefined>(undefined);

  const prepare = useCallback(
    (forward: boolean) => {
      running.current?.();
      pending.current = null;
      const paper = sheet.current;
      if (!enabled || !paper || document.hidden || motionPolicy(motionMedia()?.matches, still) !== "ALLOWED")
        return;
      const chapter = paper.closest<HTMLElement>(".book-surface");
      if (chapter) settleReadingTurns(chapter);
      const { width, height, left, top } = paper.getBoundingClientRect();
      const old = mirrorPaper(paper, { width, height, left, top, offset: 0 }, true);
      pending.current = { forward, sheet: old?.clip, content };
    },
    [enabled, still, content],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Commit only after the requested scene's HTML replaces the previous illustration.
  useLayoutEffect(() => {
    const turn = pending.current;
    pending.current = null;
    if (!turn || !sheet.current || !enabled || turn.content !== content) return;
    running.current = turnReadingPage(sheet.current, turn.forward, still, turn.sheet);
    return () => {
      running.current?.();
      running.current = undefined;
    };
  }, [pageId, enabled, still, content]);
  return { sheet, prepare };
}
