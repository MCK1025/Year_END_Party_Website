import { expect, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";

test.use({ launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] } });

test("the invitation starts the supplied track, loops and carries the same player into the notebook", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/#/invite");
  const audio = page.locator("audio");
  await expect(page.getByRole("button", { name: "음소거" })).toBeVisible({ timeout: 12000 });
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(0);
  await expect(page.locator(".invite-letter .letter-heart")).toBeVisible();
  await expect(page.locator(".invite-letter img")).toHaveCount(0);
  const player = await audio.elementHandle();
  await audio.evaluate((el: HTMLAudioElement) => {
    el.currentTime = el.duration - 0.35;
  });
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeLessThan(2);
  await page.getByRole("button", { name: "바로 입장하기" }).click();
  await page.goto("/#/survey");
  await expect(page.getByRole("button", { name: "음소거" })).toBeVisible();
  expect(
    await player?.evaluate(
      (el) => el instanceof HTMLAudioElement && el === document.querySelector("audio") && !el.paused,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "음소거" }).click();
  await expect(audio).toHaveJSProperty("paused", true);
  await page.reload();
  await expect(page.getByRole("button", { name: "음악 켜기" })).toBeVisible();
  await expect(audio).toHaveJSProperty("paused", true);
  await page.getByRole("button", { name: "음악 켜기" }).click();
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(0);
});

test("when autoplay is denied the first tap can start music and entry remains usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!navigator.userActivation.isActive)
        return Promise.reject(new DOMException("Test autoplay policy", "NotAllowedError"));
      return nativePlay.call(this);
    };
  });
  await page.goto("/#/invite");
  await expect(page.getByRole("button", { name: "음악 켜기" })).toBeVisible();
  await expect(page.locator("audio")).toHaveJSProperty("paused", true);
  await page.getByRole("button", { name: "바로 입장하기" }).click();
  await expect(page).toHaveURL(/#\/login$/);
  await expect
    .poll(() => page.locator("audio").evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "음소거" }).click();
  await page.getByRole("link", { name: "초대장 다시 보기" }).click();
  await expect(page.locator("audio")).toHaveJSProperty("paused", true);
  await expect(page.getByRole("button", { name: "음악 켜기" })).toBeVisible();
  await page.goto("/#/admin");
  await expect(page.locator("audio")).toHaveCount(0);
});
