import type { Page } from "@playwright/test";

export async function markPixels(
  page: Page,
  png: Buffer,
  box: { x: number; y: number; width: number; height: number },
  bright = true,
) {
  return page.evaluate(
    async ({ src, box, bright }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${src}`;
      await image.decode();
      const c = document.createElement("canvas");
      c.width = image.width;
      c.height = image.height;
      const ctx = c.getContext("2d");
      if (!ctx) throw Error("pixel read unavailable");
      ctx.drawImage(image, 0, 0);
      const bytes = ctx.getImageData(
        Math.round(box.x) + 3,
        Math.round(box.y) + 3,
        Math.round(box.width) - 6,
        Math.round(box.height) - 6,
      ).data;
      let count = 0;
      for (let i = 0; i < bytes.length; i += 4)
        if (bright ? (bytes[i] ?? 0) > 190 : (bytes[i] ?? 255) < 150) count++;
      return count;
    },
    { src: png.toString("base64"), box, bright },
  );
}

export async function paperDifference(
  page: Page,
  a: Buffer,
  b: Buffer,
  area: { x: number; y: number; width: number; height: number },
  from = 0,
  to = 1,
) {
  return page.evaluate(
    async ([left, right, rect, start, end]) => {
      async function pixels(src: string) {
        const img = new Image();
        img.src = `data:image/png;base64,${src}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        if (!ctx) throw Error("pixel read unavailable");
        ctx.drawImage(img, 0, 0);
        const x = Math.max(0, Math.round(rect.x + rect.width * start)),
          y = Math.max(0, Math.round(rect.y));
        const width = Math.min(c.width - x, Math.floor(rect.width * (end - start)));
        const height = Math.min(c.height - y, Math.floor(rect.height));
        return ctx.getImageData(x, y, width, height).data;
      }
      const [one, two] = await Promise.all([pixels(left), pixels(right)]);
      let sum = 0;
      for (let i = 0; i < one.length; i += 4) sum += Math.abs((one[i] ?? 0) - (two[i] ?? 0));
      return sum / (one.length / 4);
    },
    [a.toString("base64"), b.toString("base64"), area, from, to] as const,
  );
}
