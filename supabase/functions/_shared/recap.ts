import { z } from "zod";

export const detailSchema = z.object({
  id: z.uuid(),
  asset_path: z.string().min(1).max(200).nullable(),
  title: z.string().max(160),
  description: z.string().max(500),
  date: z.union([z.iso.date(), z.literal("")]),
});
export const albumSchema = z.object({
  introduction: z.string().max(500),
  cover_path: z.string().min(1).max(200).nullable(),
  fit: z.enum(["contain", "cover"]),
  x: z.number().int().min(0).max(100),
  y: z.number().int().min(0).max(100),
  slides: z.array(detailSchema).refine((slides) => new Set(slides.map((s) => s.id)).size === slides.length),
});
export type Album = z.infer<typeof albumSchema>;
export type Detail = z.infer<typeof detailSchema>;
