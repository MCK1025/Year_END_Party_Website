import { expect, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";

for (const policy of ["turn", "site-off", "reduce"] as const) {
  test(`published event hints update the actual paper with motion policy ${policy}`, async ({ page }) => {
    const updates = { revision: 2, paused: false, hints: ["처음 공개된 단서"] };
    if (policy === "site-off")
      await page.addInitScript(() => localStorage.setItem("hyeseong:2026:book-view", "pen:still"));
    if (policy === "reduce") await page.emulateMedia({ reducedMotion: "reduce" });
    await fixture(page, updates);
    await page.goto("/#/event");
    const paper = page.locator(".book-surface");
    const active = () =>
      paper.evaluate((el) => el.getAnimations().filter((a) => a.id === "live-page-turn").length);
    await expect(paper).toContainText("처음 공개된 단서");
    expect(await active()).toBe(0);
    updates.hints.push("두 번째로 공개된 단서");
    updates.revision++;
    const refresh = () => page.evaluate(() => window.dispatchEvent(new Event("online")));
    await refresh();
    await expect(paper).toContainText("두 번째로 공개된 단서");
    if (policy === "turn") {
      await expect.poll(active).toBe(1);
      await paper.evaluate((el) => {
        const turn = el.getAnimations().find((a) => a.id === "live-page-turn");
        if (!turn) throw Error("Missing live turn");
        turn.pause();
        turn.currentTime = 180;
      });
      expect(await paper.evaluate((el) => getComputedStyle(el).transform)).not.toBe("none");
      await page.screenshot({ path: "artifacts/screens/live-progress/employee-mid-turn.png" });
    } else expect(await active()).toBe(0);
    updates.paused = true;
    updates.revision++;
    await refresh();
    await expect(paper).toContainText("잠시 쉬어갑니다");
    expect(await active()).toBe(0);
    await page.reload();
    await expect(paper).toContainText("두 번째로 공개된 단서");
    expect(await active()).toBe(0);
  });
}
