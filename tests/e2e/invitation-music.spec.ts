import { expect, test } from "@playwright/test";
import { fixture } from "./notebook-fixture";

test.use({ launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] } });

test("the invitation starts the supplied track, loops and carries the same player into the notebook", async ({
  page,
}) => {
  await fixture(page);
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      document.documentElement.dataset.firstMusicPhase ??=
        document.querySelector(".invite-page")?.getAttribute("data-phase") ?? "";
      return play.call(this);
    };
  });
  await page.goto("/#/invite");
  const audio = page.locator("audio");
  await expect(page.getByRole("button", { name: "배경음악", pressed: true })).toBeVisible({ timeout: 12000 });
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(0);
  await expect(page.locator("html")).toHaveAttribute("data-first-music-phase", "opening");
  await expect(page.locator(".invite-letter .letter-heart")).toBeVisible();
  await expect(page.locator(".invite-letter img")).toHaveCount(0);
  const player = await audio.elementHandle();
  await audio.evaluate((el: HTMLAudioElement) => {
    el.currentTime = el.duration - 0.35;
  });
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeLessThan(2);
  await page.getByRole("button", { name: "바로 입장하기" }).click();
  await page.goto("/#/survey");
  await expect(page.getByRole("button", { name: "배경음악", pressed: true })).toBeVisible();
  expect(
    await player?.evaluate(
      (el) => el instanceof HTMLAudioElement && el === document.querySelector("audio") && !el.paused,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "배경음악", pressed: true }).click();
  await expect(audio).toHaveJSProperty("paused", true);
  await page.reload();
  await expect(page.getByRole("button", { name: "배경음악", pressed: false })).toBeVisible();
  await expect(audio).toHaveJSProperty("paused", true);
  await page.getByRole("button", { name: "배경음악", pressed: false }).click();
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(0);
});

test("when autoplay is denied the first tap can start music and entry remains usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    let tapped = false;
    window.addEventListener(
      "click",
      (event) => {
        if (event.isTrusted) tapped = true;
      },
      true,
    );
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!tapped) return Promise.reject(new DOMException("Test autoplay policy", "NotAllowedError"));
      return nativePlay.call(this);
    };
  });
  await page.goto("/#/invite");
  await expect(page.getByRole("button", { name: "배경음악", pressed: true })).toHaveText("음악 켜짐");
  await expect(page.getByRole("button", { name: "탭하여 재생" })).toBeVisible();
  await expect(page.locator("audio")).toHaveJSProperty("paused", true);
  await expect(page.locator("audio")).toHaveJSProperty("muted", false);
  await page.getByRole("button", { name: "배경음악", pressed: true }).click();
  await expect(page.getByRole("button", { name: "배경음악", pressed: false })).toHaveText("음악 꺼짐");
  await expect(page.getByRole("button", { name: "탭하여 재생" })).toHaveCount(0);
  await page.reload();
  await expect(page.locator("audio")).toHaveJSProperty("muted", true);
  await page.getByRole("button", { name: "배경음악", pressed: false }).click();
  await expect
    .poll(() => page.locator("audio").evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "탭하여 재생" })).toBeVisible();
  await page.getByRole("button", { name: "바로 입장하기" }).click();
  await expect(page).toHaveURL(/#\/login$/);
  await expect
    .poll(() => page.locator("audio").evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "배경음악", pressed: true }).click();
  await page.getByRole("link", { name: "초대장 다시 보기" }).click();
  await expect(page.locator("audio")).toHaveJSProperty("paused", true);
  await expect(page.getByRole("button", { name: "배경음악", pressed: false })).toBeVisible();
  await page.goto("/#/admin");
  await expect(page.locator("audio")).toHaveCount(0);
});
