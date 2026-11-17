import { z } from "zod";
import { ITEM_STATUSES, ROLES } from "./labels";
import { parseDateInput, toCents } from "./format";

/**
 * Error messages are keys under `validation` in messages/*.json; `runAction`
 * translates them into the user's language.
 */
export type ValidationKey =
  | "required"
  | "tooLong"
  | "invalidEmail"
  | "invalidDate"
  | "invalidAmount"
  | "passwordTooShort"
  | "chooseOption"
  | "invalid";

const m = (key: ValidationKey) => ({ message: key });

// Form inputs arrive as strings; empty strings mean "not provided".
const required = (max = 200) =>
  z
    .string({ required_error: "required", invalid_type_error: "invalid" })
    .trim()
    .min(1, m("required"))
    .max(max, m("tooLong"));

const optional = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, m("tooLong"))
    .optional()
    .transform((v) => (v ? v : undefined));

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, m("invalidDate"));

const requiredDate = z
  .string({ required_error: "required" })
  .min(1, m("required"))
  .pipe(dateString)
  .transform(parseDateInput);

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(dateString.optional())
  .transform((v) => (v ? parseDateInput(v) : undefined));

const money = z
  .string()
  .optional()
  .refine((v) => !v || /^\d+([.,]\d{1,2})?$/.test(v.trim()), m("invalidAmount"))
  .transform((v) => toCents(v));

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

const email = required(200).pipe(z.string().email(m("invalidEmail"))).transform((v) => v.toLowerCase());

const choice = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values, { errorMap: () => m("chooseOption") });

export const itemSchema = z.object({
  assetTag: required(50),
  serialNumber: optional(100),
  categoryId: required(),
  brand: optional(100),
  model: optional(100),
  description: required(500),
  notes: optional(1000),
  purchasePrice: money,
  purchasedAt: optionalDate,
});
export type ItemInput = z.infer<typeof itemSchema>;

export const assignSchema = z.object({
  personId: required(),
  jobTitle: optional(100),
  location: optional(100),
  occurredAt: requiredDate,
  notes: optional(1000),
});
export type AssignInput = z.infer<typeof assignSchema>;

export const unassignSchema = z.object({
  toStatus: choice(["IN_STORAGE", "IN_REPAIR", "RETIRED"] as const),
  occurredAt: requiredDate,
  notes: optional(1000),
});
export type UnassignInput = z.infer<typeof unassignSchema>;

export const repairSchema = z.object({
  occurredAt: requiredDate,
  notes: required(1000),
  condition: optional(1000),
});
export type RepairInput = z.infer<typeof repairSchema>;

export const statusSchema = z.object({
  toStatus: choice(ITEM_STATUSES),
  occurredAt: requiredDate,
  notes: optional(1000),
});
export type StatusInput = z.infer<typeof statusSchema>;

export const noteSchema = z.object({
  occurredAt: requiredDate,
  notes: required(1000),
  setCondition: checkbox,
});
export type NoteInput = z.infer<typeof noteSchema>;

export const personSchema = z.object({
  name: required(100),
  email,
});
export type PersonInput = z.infer<typeof personSchema>;

export const categorySchema = z.object({
  name: required(50),
});

const password = z.string({ required_error: "required" }).min(8, m("passwordTooShort")).max(200, m("tooLong"));

export const userSchema = z.object({
  name: required(100),
  email,
  role: choice(ROLES),
  password,
});

export const passwordSchema = z.object({ password });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

/** Turn FormData into a plain object; skips Next.js internal `$ACTION_*` keys. */
export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
