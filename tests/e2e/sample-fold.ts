import type { Page } from "@playwright/test";

export async function sampleFold(page: Page, selector: string, direction: "next" | "previous") {
  const handle = await page.waitForFunction(
    ({ selector, direction }) =>
      document
        .querySelector(selector)
        ?.getAnimations()
        .find((a) => a.id === `browse-turn-${direction}`),
    { selector, direction },
    { timeout: 7500 },
  );
  return handle.evaluate(async (turn) => {
    if (!turn || !(turn.effect instanceof KeyframeEffect) || !turn.effect.target)
      throw new Error("Missing animated sheet");
    const leaf = turn.effect.target;
    turn.pause();
    await turn.ready;
    const duration = Number(turn.effect.getTiming().duration);
    turn.currentTime = duration * 0.3;
    const earlyAlignment = new DOMMatrix(getComputedStyle(leaf).transform).m11;
    turn.currentTime = duration * (turn.id.endsWith("previous") ? 0.4 : 0.6);
    await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
    const style = getComputedStyle(leaf);
    const hinge = parseFloat(style.transformOrigin);
    const matrix = new DOMMatrix(style.transform);
    const tip = new DOMPoint(leaf.clientWidth - hinge, 0).matrixTransform(matrix);
    return {
      hinge: hinge / leaf.clientWidth,
      depth: tip.z,
      projection: tip.w,
      closing: matrix.m11 > earlyAlignment,
    };
  });
}
