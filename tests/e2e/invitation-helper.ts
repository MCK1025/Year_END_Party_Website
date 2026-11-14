import type { Page } from "@playwright/test";

/** Existing feature scenarios enter through the same optional invitation as employees. */
export async function openLogin(page: Page) {
  await page.goto("/#/login");
  const password = page.getByLabel("비밀번호", { exact: true });
  const skip = page.getByRole("button", { name: "바로 입장하기" });
  await Promise.race([password.waitFor(), skip.waitFor()]);
  if (await skip.isVisible()) await skip.click();
  await password.waitFor();
}
