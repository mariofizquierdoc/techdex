import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AuthzError } from "./authz";
import { DomainError } from "./inventory";

export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Bumped on each successful submit so clients can react (close dialog, toast). */
  ts?: number;
};

export const initialState: ActionState = {};

const UNIQUE_FIELD_LABEL: Record<string, string> = {
  assetTag: "asset tag",
  serialNumber: "serial number",
  email: "email",
  name: "name",
};

/**
 * Runs a server-action body and converts expected failures into form state.
 * Unexpected errors are re-thrown so they surface in logs / error boundaries.
 */
export async function runAction(fn: () => Promise<unknown>, message = "Saved"): Promise<ActionState> {
  try {
    await fn();
    return { ok: true, message, ts: Date.now() };
  } catch (e) {
    if (e instanceof ZodError) {
      return { error: "Please fix the highlighted fields.", fieldErrors: e.flatten().fieldErrors };
    }
    if (e instanceof DomainError || e instanceof AuthzError) return { error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = (e.meta?.target as string[] | string | undefined) ?? [];
      const fields = (Array.isArray(target) ? target : [target]).map((f) => UNIQUE_FIELD_LABEL[f] ?? f);
      return { error: `That ${fields.join(", ") || "value"} is already in use.` };
    }
    throw e;
  }
}
