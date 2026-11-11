import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import desktop from "lighthouse/core/config/desktop-config.js";

const reserve = createServer();
await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
const address = reserve.address();
if (!address || typeof address === "string") throw new Error("Debugging port unavailable");
const port = address.port;
await new Promise((resolve) => reserve.close(resolve));
const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
await mkdir("artifacts/performance", { recursive: true });
const results = [];
try {
  for (const mode of ["mobile", "desktop"]) {
    for (let run = 1; run <= 3; run++) {
      const report = await lighthouse(
        "http://127.0.0.1:4173/#/login",
        {
          port,
          output: "json",
          logLevel: "error",
          onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
        },
        mode === "desktop" ? desktop : undefined,
      );
      if (!report) throw new Error("Lighthouse report missing");
      const scores = Object.fromEntries(
        Object.entries(report.lhr.categories).map(([k, v]) => [k, Math.round((v.score ?? 0) * 100)]),
      );
      const failed = Object.entries(report.lhr.audits)
        .filter(([, a]) => a.score !== null && a.score < 1)
        .map(([id, a]) => ({ id, score: a.score, title: a.title }));
      results.push({ mode, run, scores, failed });
    }
  }
  await writeFile(
    "artifacts/performance/results.json",
    JSON.stringify(
      { browser: "Playwright Chromium", productionBuild: true, routes: ["/#/login"], results },
      null,
      2,
    ),
  );
  console.log(results.map(({ mode, run, scores }) => ({ mode, run, scores })));
} finally {
  await browser.close();
}
