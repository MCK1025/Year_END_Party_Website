import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { call, command, env } from "./qa-session.mjs";

await mkdir("artifacts/screens", { recursive: true });
let data = await call("dashboard");
const day = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
await call("settings", {
  ...data.settings,
  enabled: true,
  survey_open: true,
  nomination_open: true,
  event_start_at: `${day}T18:00:00+09:00`,
});
await command("waiting");
const browser = await chromium.launch();
const guestContext = await browser.newContext({
  viewport: { width: 375, height: 900 },
  reducedMotion: "reduce",
});
const page = await guestContext.newPage();
const issues = [];
const captures = [];
page.on("pageerror", (e) => issues.push({ kind: "page-error", message: e.message }));
async function capture(target, name) {
  for (const width of [320, 375, 768, 1280]) {
    await target.setViewportSize({ width, height: 900 });
    await target.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await target.screenshot({
      path: `artifacts/screens/${name}-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    const geometry = await target.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      inputs: [...document.querySelectorAll("input,button,select,textarea")]
        .filter((e) => e.getBoundingClientRect().width > 0)
        .map((e) => ({ tag: e.tagName, height: Math.round(e.getBoundingClientRect().height) })),
    }));
    captures.push({
      name,
      width,
      path: `artifacts/screens/${name}-${width}.png`,
      overflow: geometry.scrollWidth > width,
    });
  }
}
try {
  await page.goto("http://127.0.0.1:4173/#/login");
  await capture(page, "01-login");
  await page.getByLabel("비밀번호", { exact: true }).fill("900101");
  await page.getByRole("button", { name: "우리의 자리로" }).click();
  await page.getByRole("link", { name: "나의 이야기" }).waitFor();
  await page.getByRole("link", { name: "나의 이야기" }).click();
  await page.getByRole("heading", { name: "아직 들려주지 않은 당신의 이야기." }).waitFor();
  await capture(page, "02-survey");
  await page.getByRole("link", { name: "고마운 동료", exact: true }).click();
  await page.getByLabel("추천할 동료").waitFor();
  await capture(page, "03-nominate");
  await page.getByRole("link", { name: "행사장", exact: true }).click();
  await capture(page, "04-waiting");
  await call("recap", {
    caption: "우리가 함께 완성한 첫 프로젝트. 그날의 수고와 웃음을 기억합니다.",
    asset_path: null,
    published: true,
    sort_order: 0,
  });
  await command("phase", { phase: "RECAP" });
  await page.getByRole("heading", { name: "함께여서 남은 우리의 장면들." }).waitFor();
  await capture(page, "05-recap");
  // Use only an existing synthetic consenting employee and freshly approved answers.
  data = await call("dashboard");
  const person = data.employees.find((e) =>
    data.surveys.some((s) => s.employee_id === e.id && s.consent && s.excluded.length === 0),
  );
  if (!person) throw new Error("Run integration fixtures before visual QA");
  const survey = data.surveys.find((s) => s.employee_id === person.id);
  await call("round", {
    employee_id: person.id,
    question_keys: ["dream", "surprise", "moment"],
    hints: [survey.answers.dream, survey.answers.surprise, survey.answers.moment],
    approved: true,
    sort_order: 80,
  });
  data = await call("dashboard");
  const round = data.rounds.find((r) => r.employee_id === person.id && r.sort_order === 80);
  await command("phase", { phase: "WHO_AM_I" });
  await command("start_person", { round_id: round.id });
  await page.getByText("첫 번째 힌트가 곧 도착합니다.").waitFor();
  await capture(page, "06-game-ready");
  for (let i = 1; i <= 3; i++) {
    await command("hint");
    await page.getByText(`CLUE 0${i}`, { exact: true }).waitFor();
    await capture(page, `07-hint-${i}`);
  }
  await command("pause");
  await page.getByText("잠시 쉬어갑니다.", { exact: false }).waitFor();
  await capture(page, "08-paused");
  await command("resume");
  await command("reveal");
  await page.getByRole("heading", { name: person.name }).waitFor();
  await capture(page, "09-revealed");
  await call("taste", {
    question_id: "food",
    prompt: "우리 회사의 저녁, 가장 많은 선택은?",
    results: null,
    approved: true,
  });
  data = await call("dashboard");
  await command("phase", { phase: "TASTES" });
  await command("taste_question", { taste_id: data.tastes.at(-1).id });
  await page.getByRole("heading", { name: "우리 회사의 저녁, 가장 많은 선택은?" }).waitFor();
  await capture(page, "10-taste-question");
  await command("taste_reveal");
  await page.locator(".bar-row").first().waitFor();
  await capture(page, "11-taste-results");
  data = await call("dashboard");
  await call("settings", { ...data.settings, nomination_open: false, survey_open: false });
  await command("phase", { phase: "AWARDS" });
  await page.getByText("동료들의 마음이 가장 많이 모인 분을 소개합니다.").waitFor();
  await capture(page, "12-awards");
  await command("phase", { phase: "END" });
  await page.getByRole("heading", { name: "다음 한 걸음도, 함께." }).waitFor();
  await capture(page, "13-ending");
  await page.getByRole("link", { name: "나의 이야기" }).click();
  await page.getByText("설문이 마감되었습니다.", { exact: false }).waitFor();
  await capture(page, "14-survey-closed");
  const organizer = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  await organizer.goto("http://127.0.0.1:4173/#/admin");
  await organizer.getByLabel("관리자 이메일").waitFor();
  await capture(organizer, "15-admin-login");
  await organizer.getByLabel("관리자 이메일").fill(env.ADMIN_EMAIL);
  await organizer.getByLabel("비밀번호", { exact: true }).fill(env.ADMIN_PASSWORD);
  await organizer.getByRole("button", { name: "운영 화면으로" }).click();
  await organizer.getByRole("heading", { name: "우리의 저녁을 준비합니다." }).waitFor();
  for (const [i, label] of [
    "실시간 진행",
    "사원 관리",
    "설문·추천",
    "질문 관리",
    "1년 회고",
    "인물 맞히기",
    "취향 통계",
    "리허설",
    "설정·내보내기",
  ].entries()) {
    await organizer
      .getByRole("navigation", { name: "운영 메뉴" })
      .getByRole("button", { name: label, exact: true })
      .click();
    await capture(organizer, `16-admin-${i}`);
  }
  // Inspect actual downloads: the XLSX must be a real ZIP workbook, not a renamed CSV.
  await organizer.getByRole("button", { name: "엑셀 내려받기" }).click();
  await capture(organizer, "17-export-confirm");
  const downloading = organizer.waitForEvent("download");
  await organizer.getByRole("dialog").getByRole("button", { name: "확인", exact: true }).click();
  const download = await downloading;
  const bytes = await readFile(await download.path());
  if (bytes[0] !== 80 || bytes[1] !== 75) throw new Error("Invalid XLSX output");
  await organizer.close();
  // Produce browser-rendered contact sheets for independent visual review.
  for (const width of [320, 375, 768, 1280]) {
    const subset = captures.filter((c) => c.width === width);
    const sheet = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const figures = await Promise.all(
      subset.map(
        async (c) =>
          `<figure><figcaption>${c.name} · ${width}px</figcaption><img src="data:image/png;base64,${(await readFile(c.path)).toString("base64")}" /></figure>`,
      ),
    );
    await sheet.setContent(
      `<html><head><style>body{background:#ddd;font:14px sans-serif;display:grid;grid-template-columns:repeat(5,1fr);gap:16px}figure{margin:0;background:white}figcaption{padding:8px}img{width:100%;height:auto;display:block}</style></head><body>${figures.join("")}</body></html>`,
    );
    await sheet.screenshot({ path: `artifacts/screens/contact-${width}.png`, fullPage: true });
    await sheet.close();
  }
  await writeFile(
    "artifacts/visual-qa.json",
    JSON.stringify(
      {
        captures,
        issues,
        xlsxDownload: "valid ZIP signature",
        pages: new Set(captures.map((c) => c.name)).size,
      },
      null,
      2,
    ),
  );
  console.log({ captures: captures.length, overflow: captures.filter((c) => c.overflow), issues });
} finally {
  await browser.close();
  await command("waiting");
}
