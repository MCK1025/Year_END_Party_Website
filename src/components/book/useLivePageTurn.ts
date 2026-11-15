import { type RefObject, useLayoutEffect, useRef } from "react";
import type { EventState } from "../../../supabase/functions/_shared/contracts";
import { motionMedia, motionPolicy, observeMotion } from "../../lib/motion";
import { useBookView } from "./preferences";

// Only public presentation steps turn a page. Polls, connection status and
// administrative revisions can update independently of what the guest reads.
function publicStep(state: EventState | null) {
  if (!state || state.paused || state.tree_open) return null;
  const { phase, payload } = state;
  if (phase === "WHO_AM_I")
    return `${phase}/${payload.round_id ?? ""}/${payload.hints?.length ?? 0}/${Boolean(payload.person)}`;
  if (phase === "TASTES") return `${phase}/${payload.taste_id ?? ""}/${Boolean(payload.results)}`;
  return phase;
}

export function useLivePageTurn(surface: RefObject<HTMLElement | null>, state: EventState | null) {
  const { still } = useBookView();
  const step = publicStep(state);
  const revision = state?.revision;
  const previous = useRef({ step, revision });
  const running = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const prior = previous.current;
    previous.current = { step, revision };
    const paper = surface.current;
    const media = motionMedia();
    if (
      !paper ||
      !step ||
      !prior.step ||
      prior.step === step ||
      step === "WAITING" ||
      step === "PRE_SURVEY" ||
      prior.revision === undefined ||
      revision !== prior.revision + 1 ||
      document.hidden ||
      motionPolicy(media?.matches, still) !== "ALLOWED" ||
      typeof paper.animate !== "function"
    )
      return;

    // Turn the incoming HTML itself; withdrawn hints and signed photos never
    // linger in an outgoing copy, even when the organizer advances rapidly.
    const pivot = "var(--binding-width, 0px) 50%";
    let turn: Animation;
    try {
      turn = paper.animate(
        [
          { transformOrigin: pivot, transform: "perspective(1450px) rotateY(-76deg)" },
          { transformOrigin: pivot, transform: "perspective(1450px) rotateY(0deg)" },
        ],
        { id: "live-page-turn", duration: 580, easing: "cubic-bezier(.19,.72,.24,1)" },
      );
    } catch {
      return;
    }
    running.current = turn;
    const cancel = () => turn.cancel();
    const stop = observeMotion(media, cancel);
    document.addEventListener("visibilitychange", cancel);
    return () => {
      cancel();
      stop();
      document.removeEventListener("visibilitychange", cancel);
      running.current = null;
    };
  }, [revision, step, still, surface]);
  return running;
}
