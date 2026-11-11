import { z } from "zod";

export const uuid = z.uuid();
const short = z.string().trim().min(1).max(100);
export const date = z.iso.date();
export const personSchema = z.object({
  id: uuid,
  name: z.string(),
  department: z.string(),
  active: z.boolean(),
});
export const questionSchema = z.object({
  id: short,
  prompt: z.string(),
  choices: z.array(z.string()),
  sort_order: z.number().int(),
  active: z.boolean(),
});
export const surveySchema = z.object({
  employee_id: uuid,
  answers: z.record(z.string(), z.string()),
  consent: z.boolean(),
  excluded: z.array(z.string()),
  updated_at: z.string(),
});
export const nominationSchema = z.object({
  voter_id: uuid,
  nominee_id: uuid,
  reason: z.string(),
  updated_at: z.string(),
});
export const resultSchema = z.object({
  label: z.string().trim().min(1).max(500),
  count: z.number().int().min(0).max(100),
});
export const winnerSchema = z.object({
  id: uuid,
  name: z.string(),
  department: z.string(),
  votes: z.number(),
  reasons: z.array(z.string()),
});
export const phaseSchema = z.enum(["PRE_SURVEY", "WAITING", "RECAP", "WHO_AM_I", "TASTES", "AWARDS", "END"]);
export const stateSchema = z.object({
  phase: phaseSchema,
  revision: z.number().int(),
  paused: z.boolean(),
  updated_at: z.string().optional(),
  payload: z.object({
    round_id: uuid.optional(),
    round_index: z.number().optional(),
    hints: z.array(z.string()).optional(),
    person: z.object({ name: z.string(), department: z.string() }).nullable().optional(),
    taste_id: uuid.optional(),
    question: z.string().optional(),
    results: z.array(resultSchema).optional(),
    winners: z.array(winnerSchema).optional(),
    message: z.string().optional(),
  }),
});
export const settingsSchema = z.object({
  event_start_at: z.string().nullable(),
  deletion_date: z.string().nullable(),
  survey_open: z.boolean(),
  nomination_open: z.boolean(),
  welcome: z.string(),
  logo_path: z.string().nullable(),
});
export const recapSchema = z.object({
  id: uuid,
  caption: z.string(),
  asset_path: z.string().nullable(),
  published: z.boolean(),
  sort_order: z.number(),
});
export const roundSchema = z.object({
  id: uuid,
  employee_id: uuid,
  question_keys: z.array(z.string()),
  hints: z.array(z.string()),
  approved: z.boolean(),
  sort_order: z.number(),
  eligible: z.boolean(),
});
export const tasteSchema = z.object({
  id: uuid,
  question_id: z.string(),
  prompt: z.string(),
  results: z.array(resultSchema),
  approved: z.boolean(),
});
export const bootstrapSchema = z.object({
  self: personSchema,
  questions: z.array(questionSchema),
  directory: z.array(personSchema),
  survey: surveySchema.nullable(),
  nomination: nominationSchema.nullable(),
  settings: settingsSchema,
  state: stateSchema,
  server_time: z.string(),
});
export const adminSettingsSchema = settingsSchema.extend({
  enabled: z.boolean(),
  require_admin_mfa: z.boolean(),
  ending: z.string(),
});
export const dashboardSchema = z.object({
  settings: adminSettingsSchema,
  employees: z.array(personSchema.extend({ employee_no: z.string(), online: z.boolean() })),
  surveys: z.array(surveySchema),
  nominations: z.array(nominationSchema),
  reviews: z.array(z.object({ voter_id: uuid, public_text: z.string(), approved: z.boolean() })),
  questions: z.array(questionSchema),
  rounds: z.array(roundSchema),
  tastes: z.array(tasteSchema),
  recaps: z.array(recapSchema),
  winners: z.array(winnerSchema),
  state: stateSchema,
  rehearsal: stateSchema.nullable(),
  logs: z.array(z.object({ id: z.number(), action: z.string(), created_at: z.string() })),
});
export const issuedSchema = z.object({
  ok: z.literal(true),
  issued: z.array(z.object({ employee_no: z.string(), name: z.string(), access_code: z.string() })),
});
export const okSchema = z.object({ ok: z.literal(true) });
export const loginSchema = z.object({
  name: z.string().trim().min(1).max(60),
  date_of_birth: date,
  access_code: z.string().trim().min(8).max(80),
});
export const employeeCsvSchema = z.object({
  employee_no: short,
  name: z.string().trim().min(1).max(60),
  department: short,
  date_of_birth: date,
});
export type { PortalRequest } from "./requests.ts";
export type Bootstrap = z.infer<typeof bootstrapSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type EventState = z.infer<typeof stateSchema>;
export type Phase = z.infer<typeof phaseSchema>;
