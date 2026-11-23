import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { okSchema, recapSchema } from "../../supabase/functions/_shared/contracts";
import { admin, call, dashboard, employee, env, signAdmin } from "../integration/helpers";
import { localDatabase } from "./local-db";
import { sampleFold } from "./sample-fold";

async function openEditor(page: Page, query = "") {
  await page.goto(`/#/admin?tab=${encodeURIComponent("1년 회고")}${query}`);
  await page.getByLabel("관리자 이메일").fill(env.ADMIN_EMAIL);
  await page.getByLabel("비밀번호", { exact: true }).fill(env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "운영 화면으로" }).click();
  await page.getByLabel("Moment 제목", { exact: true }).waitFor();
}
test("opens the shared album preview directly after admin login", async ({ page }) => {
  await openEditor(page, "&preview=album");
  await expect(page.getByRole("button", { name: "오프닝 다시 보기" })).toBeVisible();
  await page.getByRole("button", { name: "미리보기 닫기" }).click();
  await expect(page).not.toHaveURL(/preview=album/);
  await expect(page.getByRole("button", { name: "저장된 전체 회고 미리보기" })).toBeVisible();
});
test("saves independent cover and ordered photos, reloads them, gates private media and confirms deletion", async ({
  page,
  browser,
}) => {
  const sql = localDatabase();
  await signAdmin();
  const storage = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const name = `QA 앨범 ${crypto.randomUUID()}`;
  const uploads: string[] = [];
  const previous = await dashboard();
  await sql`update private.settings set enabled=true,event_start_at=now()-interval '1 hour' where id`;
  await sql`update public.event_public_state set phase='RECAP',revision=revision+1 where id`;
  const guest = await employee(0);
  const other = await browser.newContext();
  try {
    await openEditor(page);
    page.on("response", async (r) => {
      if (r.url().endsWith("/upload-media") && r.ok()) {
        const v = z.object({ path: z.string() }).parse(await r.json());
        uploads.push(v.path);
      }
    });
    await page.getByLabel("Moment 제목", { exact: true }).fill(name);
    await page.getByLabel("짧은 소개 (선택)").fill("가상 앨범 소개");
    async function photo(label: string, width: number, height: number) {
      const b64 = await page.evaluate(
        ([w, h]) => {
          const c = document.createElement("canvas");
          c.width = w ?? 1;
          c.height = h ?? 1;
          const ctx = c.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#8babab";
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.fillStyle = "#bfa36b";
            ctx.fillRect(0, 0, c.width / 3, c.height / 2);
          }
          return c.toDataURL().split(",")[1] ?? "";
        },
        [width, height],
      );
      const count = uploads.length;
      await page
        .getByLabel(`${label} 업로드`)
        .setInputFiles({ name: "qa.png", mimeType: "image/png", buffer: Buffer.from(b64, "base64") });
      await expect.poll(() => uploads.length).toBe(count + 1);
      await expect(page.getByRole("img", { name: `${label} 미리보기` })).toBeVisible();
    }
    await photo("대표 사진", 400, 200);
    await page.getByLabel("대표 사진 표시").selectOption("cover");
    await page.getByLabel("사진 가로 위치").fill("68");
    await page.getByRole("button", { name: "상세 장면 추가" }).click();
    await page.locator(".recap-details-editor summary").first().click();
    await photo("상세 1 사진", 200, 400);
    await page.getByLabel("상세 설명 (선택)").fill("세로형 테스트");
    await page.getByLabel("날짜 (선택)").fill("2026-09-01");
    await page.getByRole("button", { name: "상세 장면 추가" }).click();
    await page.locator(".recap-details-editor summary").nth(1).click();
    await page.getByLabel("상세 제목 (선택)").nth(1).fill("가로형 테스트");
    await photo("상세 2 사진", 480, 240);
    await page.locator(".recap-details-editor").nth(1).getByRole("button", { name: "앞으로" }).click();
    await page.getByRole("checkbox").uncheck();
    await page.getByRole("button", { name: "Moment 저장", exact: true }).click();
    await expect(page.getByText("회고 앨범에 반영했습니다.")).toBeVisible();
    const moment = (await dashboard()).recaps.find((r) => r.caption === name);
    if (!moment?.album) throw new Error("Saved album missing");
    expect(moment.album.cover_path).toBe(uploads[0]);
    expect(moment.album.x).toBe(68);
    expect(moment.album.slides.map((s) => s.asset_path)).toEqual([uploads[2], uploads[1]]);
    const read = () => call(guest, { action: "recaps", payload: {} }, z.array(recapSchema));
    expect((await read()).some((r) => r.id === moment.id)).toBe(false);
    for (const path of uploads)
      expect((await guest.storage.from("event-media").createSignedUrl(path, 60)).error).toBeTruthy();

    const fresh = await other.newPage();
    await openEditor(fresh);
    await fresh.getByLabel("편집할 Moment").selectOption(moment.id);
    await fresh.setViewportSize({ width: 390, height: 844 });
    await expect(fresh.getByLabel("Moment 제목", { exact: true })).toHaveValue(name);
    await expect(fresh.getByRole("checkbox")).not.toBeChecked();
    await fresh.locator("form.recap-editor").screenshot({ path: "artifacts/screens/recap-album/editor.png" });
    await fresh.getByRole("checkbox").check();
    await fresh.getByRole("button", { name: "Moment 저장", exact: true }).click();
    await expect.poll(async () => (await read()).some((r) => r.id === moment.id)).toBe(true);
    await sql`update public.event_public_state set phase='COMPLETED',revision=revision+1 where id`;
    expect((await read()).some((r) => r.id === moment.id)).toBe(true);
    for (const path of uploads)
      expect((await guest.storage.from("event-media").createSignedUrl(path, 60)).error).toBeNull();
    const stale = await admin.functions.invoke("portal", {
      body: { action: "recap", payload: { ...moment, expected_version: moment.album_version } },
    });
    expect(stale.error?.context.status).toBe(409);
    await fresh.getByRole("button", { name: "편집 중인 Moment 미리보기" }).click();
    const view = fresh.getByRole("region", { name: "1년 회고", exact: true });
    await view.getByRole("button", { name: "오프닝 건너뛰기" }).click();
    await expect(view.locator(".album-image-slot:not([hidden]) img")).toHaveCSS("object-fit", "cover");
    await view.getByRole("button", { name: /다음/ }).click();
    expect((await sampleFold(fresh, ".album-volume > .turn-window", "next")).hinge).toBeCloseTo(0);
    await expect(view.getByRole("heading", { name: "가로형 테스트" })).toBeVisible();
    await expect(view.locator(".album-volume > .album-page .album-image-slot:not([hidden]) img")).toHaveCSS(
      "object-fit",
      "contain",
    );
    await fresh.getByRole("button", { name: "미리보기 닫기" }).click();
    await fresh.getByRole("button", { name: "저장된 전체 회고 미리보기" }).click();
    await expect(view.locator(".album-hardback")).toBeVisible();
    await view.getByRole("button", { name: "오프닝 건너뛰기" }).click();
    await fresh.getByRole("button", { name: "오프닝 다시 보기" }).click();
    await expect(view.locator(".album-hardback")).toBeVisible();
    await fresh.getByRole("button", { name: "미리보기 닫기" }).click();
    const secondDetail = fresh.locator(".recap-details-editor").nth(1);
    await secondDetail.locator("summary").click();
    await secondDetail.getByRole("button", { name: "등록된 사진 선택" }).click();
    await secondDetail.getByLabel("상세 2 사진 선택").selectOption(uploads[0] ?? "");
    await expect(fresh.getByRole("button", { name: "편집 취소" })).toBeVisible();
    await fresh.getByRole("button", { name: "Moment 저장", exact: true }).click();
    await expect(fresh.getByRole("button", { name: "편집 취소" })).toHaveCount(0);
    await expect
      .poll(
        async () => (await dashboard()).recaps.find((r) => r.id === moment.id)?.album?.slides[1]?.asset_path,
      )
      .toBe(uploads[0]);
    const firstDetail = fresh.locator(".recap-details-editor").first();
    await firstDetail.locator("summary").click();
    await firstDetail.getByRole("button", { name: "상세 장면 제거" }).click();
    await fresh.getByRole("button", { name: "Moment 저장", exact: true }).click();
    await expect
      .poll(async () => (await dashboard()).recaps.find((r) => r.id === moment.id)?.album?.slides.length)
      .toBe(1);
    await fresh.getByRole("button", { name: "Moment 삭제" }).click();
    await fresh.getByRole("dialog").getByRole("button", { name: "취소" }).click();
    await expect(fresh.getByLabel("Moment 제목", { exact: true })).toHaveValue(name);
    await fresh.getByRole("button", { name: "Moment 삭제" }).click();
    await fresh.getByRole("dialog").getByRole("button", { name: "확인" }).click();
    await expect.poll(async () => (await dashboard()).recaps.some((r) => r.id === moment.id)).toBe(false);
  } finally {
    await other.close();
    for (const r of (await dashboard()).recaps.filter((r) => r.caption === name))
      await call(admin, { action: "delete_recap", payload: { id: r.id } }, okSchema);
    if (uploads.length) await storage.storage.from("event-media").remove(uploads);
    await sql`update private.settings set enabled=${previous.settings.enabled},event_start_at=${previous.settings.event_start_at} where id`;
    await sql`update public.event_public_state set phase=${previous.state.phase},revision=revision+1 where id`;
    await guest.auth.signOut();
    await sql.end();
  }
});
