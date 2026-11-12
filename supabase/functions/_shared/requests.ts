import { z } from "zod";
import {
  date,
  employeeCsvSchema,
  personSchema,
  phaseSchema,
  questionSchema,
  resultSchema,
  uuid,
} from "./contracts.ts";
import { forestKindSchema } from "./forest.ts";

const short = z.string().trim().min(1).max(100);
export const commandSchema = z.object({
  command: z.enum([
    "pause",
    "resume",
    "waiting",
    "phase",
    "start_person",
    "next_person",
    "restart_person",
    "hint",
    "reveal",
    "taste_question",
    "taste_reveal",
    "undo",
  ]),
  revision: z.number().int().min(0),
  rehearsal: z.boolean().default(false),
  phase: phaseSchema.optional(),
  round_id: uuid.optional(),
  taste_id: uuid.optional(),
});
export const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("bootstrap"), payload: z.object({}) }),
  z.object({ action: z.literal("recaps"), payload: z.object({}) }),
  z.object({ action: z.literal("dashboard"), payload: z.object({}) }),
  z.object({ action: z.literal("export"), payload: z.object({}) }),
  z.object({
    action: z.literal("save_survey"),
    payload: z.object({
      answers: z.record(z.string().max(40), z.string().trim().min(1).max(500)),
      consent: z.boolean(),
      excluded: z.array(z.string().max(40)).max(30),
    }),
  }),
  z.object({
    action: z.literal("nominate"),
    payload: z.object({ nominee_id: uuid, reason: z.string().trim().max(300) }),
  }),
  z.object({ action: z.literal("command"), payload: commandSchema }),
  z.object({
    action: z.literal("import"),
    payload: z.object({ employees: z.array(employeeCsvSchema).min(1).max(100) }),
  }),
  z.object({ action: z.literal("create_employee"), payload: employeeCsvSchema }),
  z.object({ action: z.literal("delete_employee"), payload: z.object({ id: uuid }) }),
  z.object({
    action: z.literal("forest_list"),
    payload: z.object({ before: z.number().int().positive().safe().optional() }),
  }),
  z.object({
    action: z.literal("forest_post"),
    payload: z.object({ kind: forestKindSchema, body: z.string().trim().min(1).max(2000) }).strict(),
  }),
  z.object({
    action: z.literal("forest_delete"),
    payload: z.object({ id: z.number().int().positive().safe() }),
  }),
  z.object({ action: z.literal("employee"), payload: personSchema }),
  z.object({
    action: z.literal("settings"),
    payload: z.object({
      event_start_at: z.iso.datetime({ offset: true }).nullable(),
      deletion_date: date.nullable(),
      survey_open: z.boolean(),
      nomination_open: z.boolean(),
      enabled: z.boolean(),
      welcome: z.string().trim().min(1).max(500),
      ending: z.string().trim().min(1).max(500),
    }),
  }),
  z.object({
    action: z.literal("question"),
    payload: questionSchema.extend({
      prompt: z.string().trim().min(1).max(200),
      choices: z.array(short).max(20),
      sort_order: z.number().int().min(0).max(100),
    }),
  }),
  z.object({
    action: z.literal("round"),
    payload: z.object({
      id: uuid.optional(),
      employee_id: uuid,
      question_keys: z.array(short).min(1).max(3),
      hints: z.array(z.string().trim().min(1).max(500)).min(1).max(3),
      approved: z.boolean(),
      sort_order: z.number().int().min(0).max(100),
    }),
  }),
  z.object({ action: z.literal("delete_round"), payload: z.object({ id: uuid }) }),
  z.object({
    action: z.literal("taste"),
    payload: z.object({
      id: uuid.optional(),
      question_id: short,
      prompt: z.string().trim().min(1).max(200),
      results: z.array(resultSchema).max(50).nullable(),
      approved: z.boolean(),
    }),
  }),
  z.object({
    action: z.literal("recap"),
    payload: z.object({
      id: uuid.optional(),
      caption: z.string().trim().min(1).max(500),
      asset_path: z.string().max(200).nullable(),
      published: z.boolean(),
      sort_order: z.number().int().min(0).max(100),
    }),
  }),
  z.object({ action: z.literal("delete_recap"), payload: z.object({ id: uuid }) }),
  z.object({ action: z.literal("logo"), payload: z.object({ asset_path: z.string().max(200).nullable() }) }),
  z.object({
    action: z.literal("review_reason"),
    payload: z.object({ voter_id: uuid, public_text: z.string().trim().max(300), approved: z.boolean() }),
  }),
  z.object({
    action: z.literal("purge"),
    payload: z.object({ confirmation: z.literal("개인정보 영구 삭제") }),
  }),
]);
export type PortalRequest = z.infer<typeof requestSchema>;
