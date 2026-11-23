import { Component, type ReactNode, type RefObject } from "react";
import { motionMedia, motionPolicy } from "../../lib/motion";
import { mirrorPaper, visiblePaper } from "./pageMirror";

type Props = {
  children: ReactNode;
  route: string;
  enabled: boolean;
  still: boolean;
  surface: RefObject<HTMLElement | null>;
  snapshot: RefObject<HTMLElement | undefined>;
};

/** Read the outgoing DOM before React replaces it, including during browser Back and Forward. */
export class ChapterSurface extends Component<Props> {
  getSnapshotBeforeUpdate(previous: Props) {
    const { enabled, still, route, surface } = this.props;
    if (
      previous.route !== route &&
      previous.enabled &&
      enabled &&
      surface.current &&
      !document.hidden &&
      motionPolicy(motionMedia()?.matches, still) === "ALLOWED"
    ) {
      // A second navigation can arrive while the live destination is still tilted.
      for (const turn of surface.current.getAnimations?.() ?? [])
        if (turn.id === "browse-turn-previous" || turn.id === "browse-turn-next") turn.cancel();
      return mirrorPaper(surface.current, visiblePaper(surface.current), true)?.clip ?? null;
    }
    return null;
  }

  componentDidUpdate(_previous: Props, _state: unknown, snapshot: HTMLElement | null) {
    this.props.snapshot.current = snapshot ?? undefined;
  }

  render() {
    return this.props.children;
  }
}
