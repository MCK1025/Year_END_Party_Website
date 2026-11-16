import { toCanvas } from "html-to-image";

// Cache only the bundled public font files. Page images and text are transaction-local.
const fonts = new Map<string, Promise<string>>();
function fontData(url: string) {
  let item = fonts.get(url);
  if (!item) {
    item = fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error("font unavailable");
        const blob = await r.blob();
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      })
      .catch((error) => {
        fonts.delete(url);
        throw error;
      });
    fonts.set(url, item);
  }
  return item;
}
async function embeddedFonts() {
  const sheet = document.querySelector<HTMLLinkElement>("link[data-book-font]")?.sheet;
  if (!sheet?.href) return "/* system font */";
  const rules = [...sheet.cssRules].filter((rule) => rule instanceof CSSFontFaceRule);
  const family = rules[0]?.style.getPropertyValue("font-family").replace(/["']/g, "");
  const loaded = new Set(
    [...document.fonts]
      .filter((f) => f.status === "loaded" && f.family.replace(/["']/g, "") === family)
      .map((f) => f.unicodeRange.toLowerCase().replaceAll(" ", "")),
  );
  if (!loaded.size) return "/* system font */";
  const jobs: Promise<string>[] = [];
  for (const rule of rules) {
    if (!loaded.has(rule.style.getPropertyValue("unicode-range").toLowerCase().replaceAll(" ", ""))) continue;
    const src = rule.style.getPropertyValue("src").match(/url\(["']?([^)"']+)/)?.[1];
    if (!src || !/^\.\/[\w.-]+\.woff2$/.test(src)) continue;
    jobs.push(fontData(new URL(src, sheet.href).href).then((data) => rule.cssText.replace(src, data)));
  }
  if (!jobs.length) throw new Error("font embedding unavailable");
  return (await Promise.all(jobs)).join("\n");
}
export async function rasterPaper(node: HTMLElement, signal: AbortSignal) {
  const fontEmbedCSS = await embeddedFonts();
  signal.throwIfAborted();
  const scale = Math.min(
    1.5,
    devicePixelRatio,
    Math.sqrt(1_800_000 / (node.clientWidth * node.clientHeight)),
    2048 / Math.max(node.clientWidth, node.clientHeight),
  );
  const canvas = await toCanvas(node, {
    fontEmbedCSS,
    pixelRatio: scale,
    width: node.clientWidth,
    height: node.clientHeight,
    style: { position: "relative", inset: "auto", transform: "none" },
    cacheBust: false,
  });
  signal.throwIfAborted();
  // Reject transparent/blank SVG rasterizations (some browsers decode without painting the content).
  const probe = document.createElement("canvas");
  probe.width = 80;
  probe.height = 80;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("capture unavailable");
  ctx.drawImage(canvas, 0, 0, 80, 80);
  const bytes = ctx.getImageData(0, 0, 80, 80).data;
  let paper = 0,
    ink = 0;
  for (let i = 0; i < bytes.length; i += 4)
    if ((bytes[i + 3] ?? 0) > 245) {
      if ((bytes[i] ?? 0) > 200) paper++;
      else if ((bytes[i] ?? 255) < 170) ink++;
    }
  if (!paper || ink < 3) throw new Error("empty capture");
  return canvas;
}
