import { type RefObject, useEffect, useRef } from "react";
import type { createInvitationScene } from "../../graphics/invitation";
import { invitationAnchor } from "../../graphics/invitation-layout";
import { type InvitationPhase, invitationMotion } from "../../lib/invitation";

type Props = {
  readonly letter: RefObject<HTMLElement | null>;
  readonly departing: boolean;
  readonly phase: (phase: InvitationPhase) => void;
  readonly failed: () => void;
  readonly complete: () => void;
};
export function InvitationScene({ letter, departing, phase, failed, complete }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const session = useRef<ReturnType<typeof createInvitationScene> | null>(null);
  useEffect(() => {
    let live = true;
    const fail = () => {
      if (live) {
        live = false;
        session.current?.dispose();
        session.current = null;
        failed();
      }
    };
    const timer = setTimeout(fail, invitationMotion.preparationTimeout);
    void import("../../graphics/invitation")
      .then(async ({ createInvitationScene }) => {
        if (!live || !canvas.current || !letter.current) return;
        const surface = canvas.current;
        const content = letter.current;
        try {
          const created = createInvitationScene(
            surface,
            () => invitationAnchor(surface.getBoundingClientRect(), content.getBoundingClientRect()),
            {
              phase(next) {
                if (!live) return;
                if (next === "reading") session.current?.setPaused(true);
                phase(next);
              },
              failed: fail,
              complete() {
                if (live) complete();
              },
            },
          );
          session.current = created;
          await created.ready;
          if (!live) return;
          clearTimeout(timer);
          created.start();
        } catch {
          fail();
        } // Optional graphics boundary: the complete HTML invitation is the fallback.
      })
      .catch(fail);
    return () => {
      live = false;
      clearTimeout(timer);
      session.current?.dispose();
      session.current = null;
    };
  }, [letter, phase, failed, complete]);
  useEffect(() => {
    if (departing) session.current?.depart();
  }, [departing]);
  return (
    <div aria-hidden="true">
      <canvas className="invite-canvas" ref={canvas} />
    </div>
  );
}
