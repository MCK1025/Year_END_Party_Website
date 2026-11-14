export const invitationWorldHeight = 6;
export type InvitationAnchor = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly viewportWidth: number;
};
export function invitationAnchor(stage: DOMRectReadOnly, letter: DOMRectReadOnly): InvitationAnchor {
  const unit = invitationWorldHeight / Math.max(1, stage.height);
  return {
    x: (letter.left - stage.left + letter.width / 2 - stage.width / 2) * unit,
    y: (stage.height / 2 - (letter.top - stage.top + letter.height / 2)) * unit,
    width: letter.width * unit,
    height: letter.height * unit,
    viewportWidth: stage.width * unit,
  };
}
