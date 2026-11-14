import { type EnvelopeEvents, envelopeEffect } from "./effects/envelope";
import { type InvitationAnchor, invitationWorldHeight } from "./invitation-layout";
import { createGraphicsSession } from "./service";

export function createInvitationScene(
  canvas: HTMLCanvasElement,
  anchor: () => InvitationAnchor,
  events: EnvelopeEvents & { readonly failed: () => void },
) {
  const effect = envelopeEffect(anchor, events);
  const session = createGraphicsSession(canvas, [effect.factory], events.failed, invitationWorldHeight);
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
