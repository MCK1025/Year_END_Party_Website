import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

await mkdir("artifacts/primitives", { recursive: true });
const browser = await chromium.launch();
const findings = [];
for (const width of [375, 768, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto("http://127.0.0.1:5173/#/showcase");
  await page.getByRole("heading", { name: "작은 대화의 시작" }).waitFor();
  await page.screenshot({ path: `artifacts/primitives/${width}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await page.getByRole("button", { name: "확인 창 열기" }).click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: `artifacts/primitives/${width}-dialog.png` });
  await page.getByRole("button", { name: "취소", exact: true }).click();
  findings.push({
    width,
    overflow,
    dialog: "opened and canceled",
    inputs: await page.locator("input").count(),
  });
  await page.close();
}
await browser.close();
await writeFile("artifacts/primitives/results.json", JSON.stringify(findings, null, 2));
console.log(findings);
