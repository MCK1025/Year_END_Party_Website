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
    turn.currentTime = Number(turn.effect.getTiming().duration) * 0.6;
    await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
    const style = getComputedStyle(leaf);
    const hinge = parseFloat(style.transformOrigin);
    const edgeX = turn.id.endsWith("next") ? leaf.clientWidth : 0;
    const tip = new DOMPoint(edgeX - hinge, 0).matrixTransform(new DOMMatrix(style.transform));
    return { hinge: hinge / leaf.clientWidth, depth: tip.z, projection: tip.w };
  });
}
