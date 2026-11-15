import { type EnvelopeEvents, envelopeEffect } from "./effects/envelope";
import { type InvitationAnchor, invitationWorldHeight } from "./invitation-layout";
import { createGraphicsSession, type GraphicsFailure } from "./service";

export function createInvitationScene(
  canvas: HTMLCanvasElement,
  anchor: () => InvitationAnchor,
  events: EnvelopeEvents & {
    readonly failed: (reason: GraphicsFailure) => void;
    readonly firstFrame: () => void;
    readonly activity: (reason: string) => void;
    readonly compile: () => void;
  },
) {
  const effect = envelopeEffect(anchor, events);
  const session = createGraphicsSession(
    canvas,
    [effect.factory],
    events.failed,
    invitationWorldHeight,
    events,
  );
  session.setPaused(true);
  return {
    ...session,
    start() {
      effect.controller.start();
      session.setPaused(false);
    },
    depart() {
      effect.controller.depart();
      session.setPaused(false);
    },
  };
}
