import { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { ZodError } from "zod";
import type messages from "../../messages/es.json";
import { DomainError } from "./errors";

export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Bumped on each successful submit so clients can react (close dialog, toast). */
  ts?: number;
};

export type ToastKey = keyof (typeof messages)["toast"];
type DuplicateField = keyof (typeof messages)["errors"]["field"];

const DUPLICATE_FIELDS: readonly string[] = ["assetTag", "serialNumber", "email", "name"] satisfies DuplicateField[];

/**
 * Runs a server-action body and converts expected failures into form state,
 * translated into the current user's language. Unexpected errors are re-thrown
 * so they surface in logs / error boundaries.
 */
export async function runAction(fn: () => Promise<unknown>, toast: ToastKey = "saved"): Promise<ActionState> {
  const t = await getTranslations();
  try {
    await fn();
    return { ok: true, message: t(`toast.${toast}`), ts: Date.now() };
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const [field, keys] of Object.entries(e.flatten().fieldErrors)) {
        fieldErrors[field] = (keys ?? []).map((key) => {
          const k = `validation.${key}` as "validation.invalid";
          return t.has(k) ? t(k) : t("validation.invalid");
        });
      }
      return { error: t("errors.fixFields"), fieldErrors };
    }
    if (e instanceof DomainError) {
      return { error: t(`errors.${e.code}`, e.params as Record<string, string>) };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = (e.meta?.target as string[] | string | undefined) ?? [];
      const first = (Array.isArray(target) ? target : [target]).find((f) => DUPLICATE_FIELDS.includes(f));
      const field = t(`errors.field.${(first ?? "value") as DuplicateField}`);
      return { error: t("errors.duplicate", { field }) };
    }
    throw e;
  }
}
