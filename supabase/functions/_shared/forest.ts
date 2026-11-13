import { z } from "zod";

export const forestKindSchema = z.enum(["wish", "thanks", "regret"]);
export const forestPostSchema = z.object({
  id: z.number().int().positive().safe(),
  kind: forestKindSchema,
  body: z.string(),
  day: z.iso.date(),
});
export const forestListSchema = z.array(forestPostSchema);
export const forestTreeSchema = z.object({ notes: forestListSchema, total: z.number().int().nonnegative() });
export type ForestPost = z.infer<typeof forestPostSchema>;
export const forestKinds = {
  wish: "바라는 점",
  thanks: "고마운 점",
  regret: "아쉬운 점",
} as const;
