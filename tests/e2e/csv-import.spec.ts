import { expect, test } from "@playwright/test";
import { env } from "../integration/helpers";

const header = "employee_no,name,department,date_of_birth\r\n";
const cp949 = Buffer.from([
  ...Buffer.from(`${header}TEST-CP949,`),
  176,
  161,
  187,
  243,
  193,
  247,
  191,
  248,
  44,
  148,
  238,
  ...Buffer.from(",1990-01-01\r\n"),
]);
test("previews Excel CP949 and UTF-8 CSVs without importing, and clears invalid selections", async ({
  page,
}) => {
  // Given: only synthetic data is selected; no registration is submitted.
  const errors: string[] = [];
  let imports = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() === "POST" && request.postDataJSON()?.action === "import") imports += 1;
  });
  await page.goto("/#/admin");
  await page.getByLabel("관리자 이메일").fill(env.ADMIN_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "운영 화면으로" }).click();
  await page.getByRole("button", { name: "사원 관리", exact: true }).click();
  const input = page.getByLabel("직원 CSV 파일");
  const confirm = page.getByRole("button", { name: "이 명단으로 등록·수정" });
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const capture = async (state: string) => {
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `artifacts/screens/csv-fix/${width}-${state}.png`, fullPage: true });
    };
    // When: CP949 includes a syllable outside the original EUC-KR repertoire.
    await input.setInputFiles({ name: "synthetic-cp949.csv", mimeType: "text/csv", buffer: cp949 });
    // Then: browser TextDecoder preserves all Korean fields, including extended CP949.
    await expect(page.getByText("TEST-CP949 · 가상직원 · 뷁 · 1990-01-01", { exact: true })).toBeVisible();
    await expect(confirm).toBeVisible();
    await capture("cp949");
    for (const bom of [false, true]) {
      await input.setInputFiles({
        name: `synthetic-utf8-${bom}.csv`,
        mimeType: "text/csv",
        buffer: Buffer.from(`${bom ? "\uFEFF" : ""}${header}TEST-UTF8,가상직원,기획팀,1990-01-01`),
      });
      await expect(
        page.getByText("TEST-UTF8 · 가상직원 · 기획팀 · 1990-01-01", { exact: true }),
      ).toBeVisible();
      await capture(`utf8-${bom}`);
    }
    await input.setInputFiles({ name: "corrupt.csv", mimeType: "text/csv", buffer: Buffer.from([255]) });
    await expect(page.getByRole("alert")).toContainText("CSV 인코딩");
    await expect(confirm).toHaveCount(0);
    await expect(page.getByText(/명 · 업로드 미리보기/)).toHaveCount(0);
    await capture("invalid");
    await input.setInputFiles({ name: "empty.csv", mimeType: "text/csv", buffer: Buffer.from(header) });
    await expect(page.getByRole("alert")).toContainText("직원 데이터가 없습니다");
    await expect(confirm).toHaveCount(0);
    await capture("empty");
  }
  expect(imports).toBe(0);
  expect(errors).toEqual([]);
});
