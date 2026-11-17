import { z } from "zod";
import { ITEM_STATUSES, ROLES } from "./labels";
import { parseDateInput, toCents } from "./format";

// Form inputs arrive as strings; empty strings mean "not provided".
const required = (label: string, max = 200) =>
  z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`).max(max);

const optional = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

const requiredDate = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .min(1, `${label} is required`)
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
  .refine((v) => !v || /^\d+([.,]\d{1,2})?$/.test(v.trim()), "Enter an amount like 1299.99")
  .transform((v) => toCents(v));

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

export const itemSchema = z.object({
  assetTag: required("Asset tag", 50),
  serialNumber: optional(100),
  categoryId: required("Category"),
  brand: optional(100),
  model: optional(100),
  description: required("Description", 500),
  notes: optional(1000),
  purchasePrice: money,
  purchasedAt: optionalDate,
});
export type ItemInput = z.infer<typeof itemSchema>;

export const assignSchema = z.object({
  personId: required("Person"),
  jobTitle: optional(100),
  location: optional(100),
  occurredAt: requiredDate("Date"),
  notes: optional(1000),
});
export type AssignInput = z.infer<typeof assignSchema>;

export const unassignSchema = z.object({
  toStatus: z.enum(["IN_STORAGE", "IN_REPAIR", "RETIRED"], { message: "Choose where the item goes" }),
  occurredAt: requiredDate("Date"),
  notes: optional(1000),
});
export type UnassignInput = z.infer<typeof unassignSchema>;

export const repairSchema = z.object({
  occurredAt: requiredDate("Date"),
  notes: required("Repair details", 1000),
  condition: optional(1000),
});
export type RepairInput = z.infer<typeof repairSchema>;

export const statusSchema = z.object({
  toStatus: z.enum(ITEM_STATUSES, { message: "Choose a status" }),
  occurredAt: requiredDate("Date"),
  notes: optional(1000),
});
export type StatusInput = z.infer<typeof statusSchema>;

export const noteSchema = z.object({
  occurredAt: requiredDate("Date"),
  notes: required("Note", 1000),
  setCondition: checkbox,
});
export type NoteInput = z.infer<typeof noteSchema>;

export const personSchema = z.object({
  name: required("Name", 100),
  email: required("Email", 200).pipe(z.string().email("Enter a valid email")).transform((v) => v.toLowerCase()),
});
export type PersonInput = z.infer<typeof personSchema>;

export const categorySchema = z.object({
  name: required("Name", 50),
});

const password = z.string().min(8, "Password must be at least 8 characters").max(200);

export const userSchema = z.object({
  name: required("Name", 100),
  email: required("Email", 200).pipe(z.string().email("Enter a valid email")).transform((v) => v.toLowerCase()),
  role: z.enum(ROLES),
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
